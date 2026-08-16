# AI Engine 构建设计

## 目标

将 `packages/ai-engine` 整理为 pnpm workspace 可识别、可测试、可类型检查和可构建的标准 TypeScript 包。包名统一为 `@miaoma-aiflow-demo/ai-engine`，保留现有公开 API 和运行行为，不在本次工作中扩展业务功能。

## 当前问题

AI Engine 的核心源码已经位于 `packages/ai-engine/src`，但完整的包清单和构建配置也被误放在该目录中。pnpm workspace 实际识别的是 `packages/ai-engine/package.json`，而该文件仍是初始化空壳，仅包含一个必然失败的测试脚本。因此依赖、构建脚本、类型检查和测试配置均未在真正的工作区包边界生效。

## 方案选择

采用标准化包根目录方案：

- `packages/ai-engine/package.json` 作为唯一包清单。
- `tsconfig.json`、`tsup.config.ts`、`vitest.config.ts` 位于 `packages/ai-engine`。
- TypeScript 业务源码和测试继续位于 `packages/ai-engine/src`。
- 删除 `src` 下误放的包清单与工具配置，避免形成嵌套包边界。

没有采用根脚本转发到嵌套包的方案，因为它会使依赖归属、发布内容和工具工作目录持续混乱。也不提升业务源码到包根，因为这会造成不必要的大范围路径改动。

## 包与构建接口

包名为 `@miaoma-aiflow-demo/ai-engine`，版本保持 `1.0.0`，模块类型保持 ESM。包清单提供以下命令：

- `build`：生成正式构建物。
- `build:watch`：监听源码并增量构建。
- `clean`：删除构建目录。
- `typecheck`：执行 TypeScript 静态检查但不生成文件。
- `test`：运行全部 Vitest 测试。
- `test:watch`：监听并运行测试。

构建入口为 `src/index.ts`。产物包含：

- ESM：`build/esm/index.js`
- CommonJS：`build/cjs/index.cjs`
- TypeScript 声明文件
- 对应 sourcemap

`package.json` 使用 `exports` 明确声明 import、require 和 types 入口，同时保留 `main`、`module` 与 `types` 字段，兼容常见工具链。发布文件范围限制为 `build`，避免把源码测试和内部配置意外作为包内容发布。

## TypeScript 与依赖

包级 TypeScript 配置继承仓库的共享配置，并将 `src` 作为检查范围。配置路径从包根解析，不在 `src` 内建立第二个项目边界。

现有引擎使用的运行时依赖归属于包的 `dependencies`；构建、测试和本地执行工具归属于 `devDependencies`。迁移后通过 pnpm 更新锁文件，使工作区依赖关系与包清单一致。

## 行为与错误处理

本次不改变工作流执行、节点注册、变量解析、日志、验证器或知识库模块的行为。若类型检查、测试或打包暴露已有缺陷，只做通过构建所需的最小修复，并保持现有导出名称与调用语义。

构建错误应直接导致命令以非零状态退出；测试不依赖 Ollama 或 Qdrant 实例，外部服务交互继续使用现有 mock。任何无法在本地隔离的外部服务依赖都视为测试设计问题，而不是要求启动基础设施。

## 验证

完成条件如下：

1. `pnpm --filter @miaoma-aiflow-demo/ai-engine typecheck` 通过。
2. `pnpm --filter @miaoma-aiflow-demo/ai-engine test` 全部通过。
3. `pnpm --filter @miaoma-aiflow-demo/ai-engine build` 通过。
4. ESM、CommonJS、声明文件和 sourcemap 均在声明的路径生成。
5. 使用 Node 分别加载 ESM 与 CommonJS 入口，确认 `VERSION` 和核心工厂函数可访问。
6. `pnpm pack --dry-run` 仅包含预期的包元数据与构建产物。

## 非目标

- 不新增节点类型或工作流能力。
- 不调整 AI、向量数据库或检索算法。
- 不修改其他应用以接入 AI Engine。
- 不发布包到任何 registry。
