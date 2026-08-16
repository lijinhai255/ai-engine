/*
 *   Copyright (c) 2026 妙码学院 @Heyi
 *   All rights reserved.
 *   妙码学院官方出品，作者 @Heyi，供学员学习使用，可用作练习，可用作美化简历，不可开源。
 */

import type { VariableStore } from '../types'

/**
 * 匹配文本中的变量占位符，格式为 `${nodeId.variableName}`。
 *
 * 捕获组说明：
 *
 * 1. `([^.}]+)` 捕获节点 ID，节点 ID 至少包含一个字符，且不能包含 `.` 或 `}`；
 * 2. `([^}]+)` 捕获变量名，变量名至少包含一个字符，直到遇到右花括号为止。
 *
 * @example
 * `${llm-1.output}` 会捕获 `llm-1` 和 `output`。
 *
 * @example
 * `${http-1.response.data}` 会捕获 `http-1` 和 `response.data`。这里不会自动读取对象的
 * `response.data` 嵌套属性，而是把完整字符串 `response.data` 作为变量名传给 `VariableStore.get`。
 *
 * @remarks
 * 正则带有全局 `g` 标志，因此重复使用前必须把 `lastIndex` 重置为 `0`。本文件中的
 * {@link VariableResolver.resolveText} 和 {@link VariableResolver.extractVariables} 都会主动重置。
 */
const VARIABLE_REGEX = /\$\{([^.}]+)\.([^}]+)\}/g

/**
 * 工作流变量表达式解析器。
 *
 * 解析器负责把工作流配置中的 `${nodeId.variableName}` 引用交给 {@link VariableStore} 查询，
 * 支持以下三种使用场景：
 *
 * 1. {@link resolveExpression}：解析只包含一个变量引用的完整表达式，并保留值的原始类型；
 * 2. {@link resolveText}：替换普通文本中的一个或多个变量引用，最终始终返回字符串；
 * 3. {@link extractVariables}：只提取引用信息，不访问变量存储。
 *
 * 该类本身不保存执行状态，也不缓存变量值，同一实例可以在多个文本之间重复使用。
 *
 * @example
 * 假设变量存储中存在以下值：
 *
 * ```ts
 * store.set('start-1', 'name', '小明')
 * store.set('llm-1', 'score', 95)
 * store.set('http-1', 'payload', { success: true })
 *
 * const resolver = new VariableResolver()
 *
 * resolver.resolveExpression('${llm-1.score}', store)
 * // => { value: 95, found: true }，数字类型保持不变
 *
 * resolver.resolveText('用户：${start-1.name}，得分：${llm-1.score}', store)
 * // => '用户：小明，得分：95'
 *
 * resolver.resolveText('响应：${http-1.payload}', store)
 * // => '响应：{"success":true}'
 * ```
 */
export class VariableResolver {
    /**
     * 解析一个完整的变量表达式，并返回变量的原始值及命中状态。
     *
     * 只有整个字符串严格符合 `${nodeId.variableName}` 格式时才会查询变量存储；表达式前后
     * 存在普通文本或空白时均视为格式不匹配。查询成功后不会做字符串化，因此对象、数组、
     * 数字和布尔值都保持原始类型。
     *
     * @param expression 要解析的完整变量表达式，例如 `${llm-1.output}`。
     * @param variableStore 提供节点输出值的变量存储。
     * @returns `value` 为查询到的原始值；`found` 表示值是否不等于 `undefined`。
     *
     * @example
     * ```ts
     * store.set('llm-1', 'output', { answer: '你好' })
     *
     * resolver.resolveExpression('${llm-1.output}', store)
     * // => { value: { answer: '你好' }, found: true }
     * ```
     *
     * @example
     * 非完整表达式不会被替换，原字符串会作为 `value` 返回：
     *
     * ```ts
     * resolver.resolveExpression('结果：${llm-1.output}', store)
     * // => { value: '结果：${llm-1.output}', found: false }
     * ```
     *
     * @example
     * 未找到变量时，`value` 为 `undefined`：
     *
     * ```ts
     * resolver.resolveExpression('${unknown.output}', store)
     * // => { value: undefined, found: false }
     * ```
     *
     * @remarks
     * 存储中明确保存的 `undefined` 与变量不存在无法区分，两种情况的 `found` 都是 `false`。
     */
    resolveExpression(expression: string, variableStore: VariableStore): { value: unknown; found: boolean } {
        // 使用首尾锚点确保输入只能是单个完整表达式，不能夹带其他文本。
        const match = expression.match(/^\$\{([^.}]+)\.([^}]+)\}$/)

        // 格式无效时不访问变量存储，并原样返回输入，方便调用方自行决定后续处理方式。
        if (!match) {
            return { value: expression, found: false }
        }

        // 第一个捕获组是节点 ID，第二个捕获组是完整变量名。
        const [, nodeId, variableName] = match
        const value = variableStore.get(nodeId, variableName)

        // undefined 被定义为“未找到”；null、false、0 和空字符串都属于有效值。
        return { value, found: value !== undefined }
    }

    /**
     * 替换文本中的全部变量占位符。
     *
     * 每个匹配项都会独立查询变量存储。基础类型通过 `String(value)` 转换；对象、数组和 `null`
     * 通过 `JSON.stringify(value)` 序列化；值为 `undefined` 时保留原始占位符，便于发现尚未产生
     * 输出的节点或拼写错误的变量名。
     *
     * @param text 包含零个、一个或多个变量占位符的文本。
     * @param variableStore 提供节点输出值的变量存储。
     * @returns 完成替换后的新字符串；输入不含有效占位符时原样返回。
     *
     * @example
     * 同时替换多个不同类型的值：
     *
     * ```ts
     * store.set('start-1', 'name', '小明')
     * store.set('score-1', 'value', 95)
     * store.set('check-1', 'passed', true)
     *
     * resolver.resolveText(
     *     '姓名=${start-1.name}，得分=${score-1.value}，通过=${check-1.passed}',
     *     store
     * )
     * // => '姓名=小明，得分=95，通过=true'
     * ```
     *
     * @example
     * 对象和数组会序列化为紧凑 JSON：
     *
     * ```ts
     * store.set('http-1', 'body', { items: [1, 2] })
     * resolver.resolveText('接口结果：${http-1.body}', store)
     * // => '接口结果：{"items":[1,2]}'
     * ```
     *
     * @example
     * 找不到值时保留占位符，其他可用变量仍会正常替换：
     *
     * ```ts
     * resolver.resolveText('${start-1.name} / ${missing.value}', store)
     * // => '小明 / ${missing.value}'
     * ```
     *
     * @remarks
     * `JSON.stringify` 可能在值包含循环引用或不支持序列化的 `BigInt` 时抛出异常；本方法不会
     * 捕获该异常。变量解析不递归处理替换结果中新增的占位符，只扫描调用时传入的原始文本。
     */
    resolveText(text: string, variableStore: VariableStore): string {
        // VARIABLE_REGEX 是全局正则；重置游标，保证连续调用时始终从文本开头扫描。
        VARIABLE_REGEX.lastIndex = 0

        return text.replace(VARIABLE_REGEX, (match, nodeId, variableName) => {
            const value = variableStore.get(nodeId, variableName)

            if (value === undefined) {
                // 未找到变量时保留原始表达式，而不是替换成字符串 "undefined"。
                return match
            }

            // 对象和数组使用 JSON，避免默认字符串化后只得到 "[object Object]"。
            if (typeof value === 'object') {
                return JSON.stringify(value)
            }

            // 数字、布尔值、字符串、BigInt、Symbol 和函数统一使用标准字符串转换。
            return String(value)
        })
    }

    /**
     * 提取文本中出现的全部变量引用，但不解析变量值。
     *
     * 返回数组遵循占位符在原文本中的出现顺序。同一个引用出现多次时会保留多条记录，
     * 本方法不负责去重，也不会验证对应节点或变量是否真实存在。
     *
     * @param text 要扫描的文本。
     * @returns 由节点 ID 和变量名组成的引用列表；没有匹配项时返回空数组。
     *
     * @example
     * ```ts
     * resolver.extractVariables(
     *     '${start-1.name} 调用了 ${http-1.body}，再次引用 ${start-1.name}'
     * )
     * // => [
     * //   { nodeId: 'start-1', variableName: 'name' },
     * //   { nodeId: 'http-1', variableName: 'body' },
     * //   { nodeId: 'start-1', variableName: 'name' }
     * // ]
     * ```
     *
     * @example
     * 变量名可以包含额外的点，并会被整体返回：
     *
     * ```ts
     * resolver.extractVariables('${http-1.response.data}')
     * // => [{ nodeId: 'http-1', variableName: 'response.data' }]
     * ```
     */
    extractVariables(text: string): Array<{ nodeId: string; variableName: string }> {
        const variables: Array<{ nodeId: string; variableName: string }> = []

        // VARIABLE_REGEX 是全局正则；每次扫描前必须清除上一次执行留下的游标。
        VARIABLE_REGEX.lastIndex = 0

        // exec 会从 lastIndex 继续查找，直到没有更多匹配并返回 null。
        let match
        while ((match = VARIABLE_REGEX.exec(text)) !== null) {
            variables.push({
                nodeId: match[1],
                variableName: match[2],
            })
        }

        return variables
    }

    /**
     * 验证字符串是否为单个完整的变量表达式。
     *
     * 该方法只检查语法格式，不查询变量存储，也不验证节点 ID 或变量名是否实际存在。
     *
     * @param expression 要验证的字符串。
     * @returns 严格符合 `${nodeId.variableName}` 格式时返回 `true`，否则返回 `false`。
     *
     * @example
     * ```ts
     * resolver.isValidExpression('${llm-1.output}')
     * // => true
     *
     * resolver.isValidExpression('结果：${llm-1.output}')
     * // => false，表达式之外包含普通文本
     *
     * resolver.isValidExpression('${llm-1}')
     * // => false，缺少变量名
     *
     * resolver.isValidExpression('${llm.1.output}')
     * // => true，节点 ID 为 llm，变量名为 1.output
     * ```
     */
    isValidExpression(expression: string): boolean {
        return /^\$\{[^.}]+\.[^}]+\}$/.test(expression)
    }
}

/**
 * 创建一个无状态的变量解析器实例。
 *
 * 这是 {@link VariableResolver} 构造函数的便捷工厂，适合通过模块统一入口创建解析器的调用方。
 *
 * @returns 新的 {@link VariableResolver} 实例。
 *
 * @example
 * ```ts
 * const resolver = createVariableResolver()
 * const references = resolver.extractVariables('回答：${llm-1.output}')
 * // => [{ nodeId: 'llm-1', variableName: 'output' }]
 * ```
 */
export function createVariableResolver(): VariableResolver {
    return new VariableResolver()
}
