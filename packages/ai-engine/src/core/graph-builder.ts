/*
 *   Copyright (c) 2026 妙码学院 @Heyi
 *   All rights reserved.
 *   妙码学院官方出品，作者 @Heyi，供学员学习使用，可用作练习，可用作美化简历，不可开源。
 */

import type { WorkflowDefinition, WorkflowNode } from '../types'

/**
 * 工作流执行图构建器。
 *
 * 该类把 {@link WorkflowDefinition} 中的节点和边预处理为适合执行阶段查询的图结构，
 * 主要提供以下能力：
 *
 * 1. 使用 Kahn 算法生成节点的拓扑执行顺序；
 * 2. 在条件节点命中某个输出分支后，排除其他分支独占的后续节点；
 * 3. 查询节点的直接上游节点或全部上游节点；
 * 4. 使用深度优先搜索检测工作流中是否存在有向环。
 *
 * 构造完成后，邻接表和入度表描述的是原始工作流结构。分支选择只会把节点记录到
 * `excludedNodes` 中，不会修改传入的工作流、邻接表或入度表。因此可以在每次分支选择后
 * 重新调用 {@link getExecutionOrder}，基于同一张原始图得到裁剪后的执行顺序。
 *
 * @remarks
 * 一个 `GraphBuilder` 实例对应一次工作流图状态。多次调用 {@link selectBranch} 会累积排除结果；
 * 如需恢复未经分支裁剪的状态，应基于原工作流创建新的实例。
 */
export class GraphBuilder {
    /** 原始工作流定义，用于按节点 ID 取回完整节点信息以及读取边的分支句柄。 */
    private workflow: WorkflowDefinition

    /** 正向邻接表：节点 ID -> 该节点直接指向的后继节点 ID 列表。 */
    private adjacencyList: Map<string, string[]>

    /** 反向邻接表：节点 ID -> 直接指向该节点的前驱节点 ID 列表。 */
    private reverseAdjacencyList: Map<string, string[]>

    /** 原始图入度表：节点 ID -> 指向该节点的边数量。 */
    private inDegree: Map<string, number>

    /** 条件分支选择后不应再参与执行的节点 ID 集合。 */
    private excludedNodes: Set<string>

    /**
     * 创建工作流执行图，并立即完成邻接表与入度表的初始化。
     *
     * @param workflow 要分析和执行的工作流定义。构建器只读取该对象，不会修改它。
     */
    constructor(workflow: WorkflowDefinition) {
        this.workflow = workflow
        this.adjacencyList = new Map()
        this.reverseAdjacencyList = new Map()
        this.inDegree = new Map()
        this.excludedNodes = new Set()

        this.buildGraph()
    }

    /**
     * 根据工作流节点和边构建内部图索引。
     *
     * 构建分为两个阶段：先为每个已声明节点创建空的邻接记录和零入度记录，再遍历所有边，
     * 同时填充正向邻接表、反向邻接表并累计目标节点的入度。两个方向的邻接表分别服务于
     * 后继遍历和上游/汇合关系查询。
     *
     * @remarks
     * 此方法只在构造函数中调用。它假定工作流已经过验证；如果边引用了未声明的节点，
     * `Map#get` 的回退值仍会为该边创建索引，但该节点不会出现在最终返回的节点对象列表中。
     */
    private buildGraph(): void {
        // 先注册全部节点，确保孤立节点也拥有完整的图索引并能参与拓扑排序。
        for (const node of this.workflow.nodes) {
            this.adjacencyList.set(node.id, [])
            this.reverseAdjacencyList.set(node.id, [])
            this.inDegree.set(node.id, 0)
        }

        // 每条有向边 source -> target 同时更新正向关系、反向关系和 target 的入度。
        for (const edge of this.workflow.edges) {
            const targets = this.adjacencyList.get(edge.source) || []
            targets.push(edge.target)
            this.adjacencyList.set(edge.source, targets)

            const sources = this.reverseAdjacencyList.get(edge.target) || []
            sources.push(edge.source)
            this.reverseAdjacencyList.set(edge.target, sources)

            const degree = this.inDegree.get(edge.target) || 0
            this.inDegree.set(edge.target, degree + 1)
        }
    }

    /**
     * 获取当前分支状态下的节点执行顺序。
     *
     * 使用 Kahn 拓扑排序算法：先将所有未排除的零入度节点放入队列，然后依次取出节点，
     * 降低其未排除后继节点的临时入度；后继入度降为零时即可进入队列。方法使用入度副本，
     * 因而不会污染构建器保存的原始入度，允许调用方在分支状态变化后重复计算。
     *
     * @returns 按依赖顺序排列的工作流节点。被条件分支排除的节点不会出现在结果中。
     *
     * @remarks
     * 该方法本身不抛出环错误。有向环中的节点无法降到零入度，因此不会进入结果；调用方应先
     * 使用 {@link hasCycle} 验证工作流。多个节点同时满足执行条件时，顺序由节点与边的插入顺序决定。
     */
    getExecutionOrder(): WorkflowNode[] {
        const result: WorkflowNode[] = []
        const visited = new Set<string>()
        const queue: string[] = []

        // 排序过程会持续递减入度，因此必须复制，保留可供后续重算的原始入度表。
        const inDegreeCopy = new Map(this.inDegree)

        // 零入度节点是本轮拓扑排序的入口；孤立节点同样会在这里入队。
        for (const [nodeId, degree] of inDegreeCopy) {
            if (degree === 0 && !this.excludedNodes.has(nodeId)) {
                queue.push(nodeId)
            }
        }

        while (queue.length > 0) {
            // while 条件已经保证队列非空，因此此处的非空断言是安全的。
            const nodeId = queue.shift()!

            // visited 防止重复入队造成重复输出；excludedNodes 应对排序期间已有的分支裁剪状态。
            if (visited.has(nodeId) || this.excludedNodes.has(nodeId)) {
                continue
            }

            visited.add(nodeId)

            // 邻接表保存的是 ID，返回结果需要映射回完整的节点定义。
            const node = this.workflow.nodes.find(n => n.id === nodeId)
            if (node) {
                result.push(node)
            }

            // 当前节点已经“移出”图，等价于删除它指向后继节点的边并递减后继入度。
            const successors = this.adjacencyList.get(nodeId) || []
            for (const successor of successors) {
                // 已排除节点不会执行，也无须再进入拓扑队列。
                if (this.excludedNodes.has(successor)) continue

                const degree = inDegreeCopy.get(successor)! - 1
                inDegreeCopy.set(successor, degree)

                if (degree === 0) {
                    queue.push(successor)
                }
            }
        }

        return result
    }

    /**
     * 记录条件节点的分支选择，并排除所有未命中分支独占的后续节点。
     *
     * 条件节点的每条出边通过 `sourceHandle` 标识所属分支。与 `selectedBranchId` 不相等的边
     * 会从其目标节点开始执行递归排除。排除操作只更新内部状态，不修改工作流的边集合；调用方
     * 通常应在本方法之后重新调用 {@link getExecutionOrder}。
     *
     * @param conditionNodeId 已完成判断的条件节点 ID。
     * @param selectedBranchId 条件执行器返回的已命中分支 ID，应与目标出边的 `sourceHandle` 对应。
     *
     * @remarks
     * 如果条件节点不存在、没有出边，或者所有出边都匹配，方法不会排除任何节点。
     * 多次选择分支的排除结果会在当前构建器实例中累积。
     */
    selectBranch(conditionNodeId: string, selectedBranchId: string): void {
        // 只检查指定条件节点的直接出边，后续传播由 excludeSubtree 负责。
        const edges = this.workflow.edges.filter(e => e.source === conditionNodeId)

        for (const edge of edges) {
            // 命中分支保留；其余分支从首个目标节点开始尝试递归排除。
            if (edge.sourceHandle !== selectedBranchId) {
                this.excludeSubtree(edge.target)
            }
        }
    }

    /**
     * 从指定节点开始递归标记不可执行的分支子图。
     *
     * 当前节点被排除后，会检查它的每个后继节点。如果某个后继的所有前驱都已经被排除，
     * 说明该后继只能由不可执行的路径到达，因此继续递归排除；只要仍存在一个未排除的前驱，
     * 就在该后继处停止传播，以保留来自其他有效路径的汇合节点。
     *
     * @param nodeId 本次排除传播的起始节点 ID。
     */
    private excludeSubtree(nodeId: string): void {
        // 同一节点可能被多个未选中分支到达；提前返回同时负责去重并防止异常图上的无限递归。
        if (this.excludedNodes.has(nodeId)) return

        this.excludedNodes.add(nodeId)

        const successors = this.adjacencyList.get(nodeId) || []
        for (const successor of successors) {
            // 汇合节点只在失去全部有效前驱后才随当前分支一起被排除。
            const predecessors = this.reverseAdjacencyList.get(successor) || []
            const hasActiveInEdge = predecessors.some(p => !this.excludedNodes.has(p))

            if (!hasActiveInEdge) {
                this.excludeSubtree(successor)
            }
        }
    }

    /**
     * 获取指定节点的直接上游节点。
     *
     * @param nodeId 要查询的节点 ID。
     * @returns 所有直接前驱节点的 ID；节点不存在或没有入边时返回空数组。
     *
     * @remarks
     * 查询基于原始工作流结构，不会过滤 {@link selectBranch} 已排除的节点。
     */
    getUpstreamNodes(nodeId: string): string[] {
        return this.reverseAdjacencyList.get(nodeId) || []
    }

    /**
     * 获取指定节点可递归到达的全部上游节点。
     *
     * 从目标节点沿反向邻接表执行深度优先搜索，并使用集合去重。返回结果包含直接前驱和
     * 所有间接祖先，但不包含目标节点本身（正常无环图下）。
     *
     * @param nodeId 要查询的节点 ID。
     * @returns 去重后的全部上游节点 ID，顺序为深度优先遍历中的首次发现顺序。
     *
     * @remarks
     * 查询基于原始工作流结构，不过滤已排除节点。`visited` 还能保证存在异常环时搜索会终止。
     */
    getAllUpstreamNodes(nodeId: string): string[] {
        // result 保存最终上游集合；visited 保存已经展开过前驱关系的节点。
        const result = new Set<string>()
        const visited = new Set<string>()

        /** 沿反向边递归收集当前节点的全部祖先。 */
        const dfs = (id: string) => {
            if (visited.has(id)) return
            visited.add(id)

            const predecessors = this.reverseAdjacencyList.get(id) || []
            for (const pred of predecessors) {
                result.add(pred)
                dfs(pred)
            }
        }

        dfs(nodeId)
        return Array.from(result)
    }

    /**
     * 检查原始工作流图中是否存在有向环。
     *
     * 对所有连通分量执行深度优先搜索。`visited` 表示节点已经被搜索过，`inStack` 表示节点
     * 仍位于当前递归路径中；如果后续边再次指向 `inStack` 内的节点，就发现了一条回边，
     * 即可判定存在有向环。
     *
     * @returns 存在至少一个有向环时返回 `true`，否则返回 `false`。
     *
     * @remarks
     * 检测对象是完整的原始工作流，不会忽略条件分支已排除的节点。时间复杂度为 O(V + E)，
     * 额外空间复杂度为 O(V)，其中 V 为节点数，E 为边数。
     */
    hasCycle(): boolean {
        // visited 跨 DFS 调用复用，避免对已经完成检查的子图重复遍历。
        const visited = new Set<string>()
        // inStack 只记录当前递归链，用于区分“访问过”与“当前路径上的祖先”。
        const inStack = new Set<string>()

        /** 检查从 nodeId 出发的子图是否包含指向当前递归路径的回边。 */
        const dfs = (nodeId: string): boolean => {
            // 当前路径再次遇到同一节点，说明形成有向环。
            if (inStack.has(nodeId)) return true
            // 已完整检查且不在当前路径中的节点无需重复搜索。
            if (visited.has(nodeId)) return false

            visited.add(nodeId)
            inStack.add(nodeId)

            const successors = this.adjacencyList.get(nodeId) || []
            for (const successor of successors) {
                if (dfs(successor)) return true
            }

            // 当前节点的全部后继均无环，回溯前将它移出递归路径。
            inStack.delete(nodeId)
            return false
        }

        // 图可能包含多个互不连通的分量，因此需要逐个选择尚未访问的节点作为 DFS 起点。
        for (const node of this.workflow.nodes) {
            if (!visited.has(node.id)) {
                if (dfs(node.id)) return true
            }
        }

        return false
    }
}

/**
 * 创建工作流执行图构建器。
 *
 * 这是 {@link GraphBuilder} 构造函数的便捷工厂，适用于偏好函数式创建方式或需要统一导出入口的调用方。
 *
 * @param workflow 要构建图索引的工作流定义。
 * @returns 已完成邻接表和入度表初始化的 {@link GraphBuilder} 实例。
 */
export function createGraphBuilder(workflow: WorkflowDefinition): GraphBuilder {
    return new GraphBuilder(workflow)
}
