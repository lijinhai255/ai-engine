# AI Engine Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `packages/ai-engine` into an installable workspace package that passes type checking and tests and emits consumable ESM, CommonJS, declaration, and sourcemap artifacts.

**Architecture:** Keep all runtime code and tests under `packages/ai-engine/src`, and make `packages/ai-engine` the only package/configuration boundary. Restore the missing Ark model adapter required by existing executors, then validate the compiled public entry points and packed file list without changing workflow behavior.

**Tech Stack:** pnpm 10.24, TypeScript 5.9, tsup 8, Vitest 4, OpenAI JavaScript SDK 7, Node.js 22

## Global Constraints

- The package name is exactly `@miaoma-aiflow-demo/ai-engine`.
- Preserve version `1.0.0`, the existing public exports, and current workflow runtime behavior.
- Runtime dependencies remain in `dependencies`; build and test tools remain in `devDependencies`.
- Generate ESM at `build/esm/index.js`, CommonJS at `build/cjs/index.cjs`, TypeScript declarations, and sourcemaps.
- Do not add node types, retrieval features, provider algorithms, application integration, or registry publication.
- Tests must not require running Ollama, Qdrant, or Ark services.

## File Map

- Modify `packages/ai-engine/package.json`: canonical package metadata, dependency ownership, scripts, and export map.
- Create `packages/ai-engine/tsconfig.json`: package-level type-check boundary.
- Create `packages/ai-engine/tsup.config.ts`: ESM/CommonJS build definitions.
- Create `packages/ai-engine/vitest.config.ts`: test discovery and Node environment.
- Delete `packages/ai-engine/src/package.json`: remove the accidental nested package boundary.
- Delete `packages/ai-engine/src/tsconfig.json`: remove the misplaced compiler config.
- Delete `packages/ai-engine/src/tsup.config.ts`: remove the misplaced bundler config.
- Delete `packages/ai-engine/src/vitest.config.ts`: remove the misplaced test config.
- Create `packages/ai-engine/src/models/ark-chat-client.ts`: Ark OpenAI-compatible chat adapter.
- Create `packages/ai-engine/src/models/index.ts`: internal model adapter exports consumed by node executors.
- Create `packages/ai-engine/src/models/__tests__/ark-chat-client.test.ts`: offline configuration/error regression test.
- Modify `pnpm-lock.yaml`: record the AI Engine workspace importer and resolved dependencies.

---

### Task 1: Normalize the workspace package boundary and install dependencies

**Files:**

- Modify: `packages/ai-engine/package.json`
- Create: `packages/ai-engine/tsconfig.json`
- Create: `packages/ai-engine/tsup.config.ts`
- Create: `packages/ai-engine/vitest.config.ts`
- Delete: `packages/ai-engine/src/package.json`
- Delete: `packages/ai-engine/src/tsconfig.json`
- Delete: `packages/ai-engine/src/tsup.config.ts`
- Delete: `packages/ai-engine/src/vitest.config.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: pnpm workspace discovery from `pnpm-workspace.yaml` and source entry `packages/ai-engine/src/index.ts`.
- Produces: package `@miaoma-aiflow-demo/ai-engine` with scripts `build`, `build:watch`, `clean`, `typecheck`, `test`, and `test:watch`, plus `.` export conditions `types`, `import`, and `require`.

- [ ] **Step 1: Demonstrate the current package boundary is broken**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine test
```

Expected: FAIL with `Error: no test specified`, proving pnpm sees the empty root package rather than the configuration under `src`.

- [ ] **Step 2: Replace the root package manifest**

Set `packages/ai-engine/package.json` to:

```json
{
    "name": "@miaoma-aiflow-demo/ai-engine",
    "version": "1.0.0",
    "private": true,
    "license": "MIAOMAEDU",
    "description": "AI 应用引擎",
    "keywords": ["miaoma", "aiflow", "typescript"],
    "type": "module",
    "files": ["build"],
    "source": "src/index.ts",
    "main": "build/cjs/index.cjs",
    "module": "build/esm/index.js",
    "types": "build/esm/index.d.ts",
    "exports": {
        ".": {
            "types": "./build/esm/index.d.ts",
            "import": "./build/esm/index.js",
            "require": "./build/cjs/index.cjs"
        }
    },
    "scripts": {
        "build": "rimraf build && tsup",
        "build:watch": "tsup --watch",
        "clean": "rimraf build",
        "typecheck": "tsc --noEmit",
        "test": "vitest run",
        "test:watch": "vitest"
    },
    "dependencies": {
        "@langchain/core": "^1.0.3",
        "@langchain/langgraph": "^1.0.0",
        "@langchain/ollama": "^1.0.0",
        "@qdrant/js-client-rest": "^1.16.2",
        "openai": "7.4.0",
        "zod": "^3.25.76"
    },
    "devDependencies": {
        "rimraf": "^6.0.1",
        "tsup": "^8.5.1",
        "tsx": "^4.19.2",
        "vitest": "^4.0.16"
    }
}
```

- [ ] **Step 3: Move tool configuration to the package root**

Create `packages/ai-engine/tsconfig.json`:

```json
{
    "extends": "../../tsconfig.client.json",
    "compilerOptions": {
        "rootDir": "src",
        "types": ["node", "vitest/globals"]
    },
    "include": ["src/**/*.ts"],
    "exclude": ["build", "node_modules"]
}
```

Create `packages/ai-engine/tsup.config.ts`:

```ts
import { defineConfig } from 'tsup'

const shared = {
    entry: ['src/index.ts'],
    bundle: true,
    clean: false,
    dts: true,
    minify: true,
    sourcemap: true,
}

export default defineConfig([
    {
        ...shared,
        format: ['esm'],
        outDir: 'build/esm',
    },
    {
        ...shared,
        format: ['cjs'],
        outDir: 'build/cjs',
        outExtension: () => ({ js: '.cjs' }),
    },
])
```

Create `packages/ai-engine/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        exclude: ['node_modules', 'build'],
        include: ['src/**/__tests__/**/*.test.ts'],
        testTimeout: 30000,
    },
})
```

Delete the four same-purpose configuration files from `packages/ai-engine/src`.

- [ ] **Step 4: Install all workspace dependencies and update the lock file**

Run:

```bash
pnpm install
```

Expected: exit 0, create the workspace `node_modules` links, and replace the `packages/ai-engine: {}` importer in `pnpm-lock.yaml` with the declared runtime and development dependencies.

- [ ] **Step 5: Verify pnpm resolves the canonical package**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine exec pwd
pnpm --filter @miaoma-aiflow-demo/ai-engine exec vitest --version
```

Expected: the first command prints a path ending in `/packages/ai-engine`; the second prints Vitest `4.x`.

- [ ] **Step 6: Commit package normalization**

```bash
git add packages/ai-engine/package.json packages/ai-engine/tsconfig.json packages/ai-engine/tsup.config.ts packages/ai-engine/vitest.config.ts packages/ai-engine/src/package.json packages/ai-engine/src/tsconfig.json packages/ai-engine/src/tsup.config.ts packages/ai-engine/src/vitest.config.ts pnpm-lock.yaml
git commit -m "build(ai-engine): normalize package configuration"
```

### Task 2: Restore the missing Ark chat adapter

**Files:**

- Create: `packages/ai-engine/src/models/ark-chat-client.ts`
- Create: `packages/ai-engine/src/models/index.ts`
- Create: `packages/ai-engine/src/models/__tests__/ark-chat-client.test.ts`

**Interfaces:**

- Consumes: `openai` default export and environment variables `ARK_API_KEY` and optional `ARK_BASE_URL`.
- Produces: `ArkChatClient.complete(options: ArkChatCompletionOptions): Promise<ArkChatCompletionResult>` and `ArkChatMessage`, used by `LLMExecutor` and `ConditionExecutor`.

- [ ] **Step 1: Confirm the existing executor regression tests fail at the missing module**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine test -- src/nodes/executors/__tests__/llm-executor.test.ts src/nodes/executors/__tests__/condition-executor.test.ts
```

Expected: FAIL because imports of `src/models` cannot be resolved.

- [ ] **Step 2: Add an offline failing test for lazy credential validation**

Create `packages/ai-engine/src/models/__tests__/ark-chat-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ArkChatClient } from '../ark-chat-client'

describe('ArkChatClient', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('constructs without credentials and reports missing credentials on request', async () => {
        vi.stubEnv('ARK_API_KEY', '')
        const client = new ArkChatClient()

        await expect(
            client.complete({
                model: 'glm-test',
                messages: [{ role: 'user', content: 'hello' }],
            })
        ).rejects.toThrow('ARK_API_KEY is required')
    })
})
```

- [ ] **Step 3: Run the new test to verify it fails**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine test -- src/models/__tests__/ark-chat-client.test.ts
```

Expected: FAIL because `../ark-chat-client` does not exist.

- [ ] **Step 4: Implement the minimal OpenAI-compatible Ark adapter**

Create `packages/ai-engine/src/models/ark-chat-client.ts`:

```ts
import OpenAI from 'openai'

export interface ArkChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface ArkChatCompletionOptions {
    model: string
    messages: ArkChatMessage[]
    temperature?: number
    maxTokens?: number
}

export interface ArkChatCompletionResult {
    content: string
    totalTokens?: number
}

export interface ArkChatClientConfig {
    apiKey?: string
    baseURL?: string
}

export class ArkChatClient {
    constructor(private readonly config: ArkChatClientConfig = {}) {}

    async complete(options: ArkChatCompletionOptions): Promise<ArkChatCompletionResult> {
        const apiKey = this.config.apiKey ?? process.env.ARK_API_KEY
        if (!apiKey) {
            throw new Error('ARK_API_KEY is required')
        }

        const client = new OpenAI({
            apiKey,
            baseURL: this.config.baseURL ?? process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3',
        })
        const completion = await client.chat.completions.create({
            model: options.model,
            messages: options.messages,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
        })

        return {
            content: completion.choices[0]?.message.content ?? '',
            totalTokens: completion.usage?.total_tokens,
        }
    }
}
```

Create `packages/ai-engine/src/models/index.ts`:

```ts
export { ArkChatClient } from './ark-chat-client'
export type { ArkChatClientConfig, ArkChatCompletionOptions, ArkChatCompletionResult, ArkChatMessage } from './ark-chat-client'
```

- [ ] **Step 5: Run the adapter and executor tests**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine test -- src/models/__tests__/ark-chat-client.test.ts src/nodes/executors/__tests__/llm-executor.test.ts src/nodes/executors/__tests__/condition-executor.test.ts
```

Expected: 3 test files pass without an external Ark request; the executor tests inject their mock `complete` implementation.

- [ ] **Step 6: Commit the model adapter**

```bash
git add packages/ai-engine/src/models
git commit -m "fix(ai-engine): restore Ark chat adapter"
```

### Task 3: Verify source correctness and produce package artifacts

**Files:**

- Modify only a source or test file identified by a failing command, and only after reproducing that failure with its narrowest existing test.
- Generated, not committed: `packages/ai-engine/build/**`

**Interfaces:**

- Consumes: canonical scripts from Task 1 and `ArkChatClient` from Task 2.
- Produces: a type-safe source tree, a green Vitest suite, and the four declared ESM/CommonJS JavaScript and declaration entry points.

- [ ] **Step 1: Run TypeScript validation**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine typecheck
```

Expected: exit 0 with no TypeScript diagnostics. If a diagnostic appears, invoke the `systematic-debugging` skill, reproduce it with the narrowest affected test or `tsc`, add a regression test when behavior is involved, and make only the root-cause fix before rerunning this command.

- [ ] **Step 2: Run the complete offline test suite**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine test
```

Expected: all test files pass with no Ollama, Qdrant, or Ark service running. If a test fails, invoke the `systematic-debugging` skill and preserve the failing test as the regression check for the minimal fix.

- [ ] **Step 3: Build both module formats**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine build
```

Expected: exit 0 and tsup reports successful ESM, CJS, and DTS builds.

- [ ] **Step 4: Assert the declared artifacts exist**

Run:

```bash
test -f packages/ai-engine/build/esm/index.js
test -f packages/ai-engine/build/esm/index.js.map
test -f packages/ai-engine/build/esm/index.d.ts
test -f packages/ai-engine/build/cjs/index.cjs
test -f packages/ai-engine/build/cjs/index.cjs.map
test -f packages/ai-engine/build/cjs/index.d.cts
```

Expected: every command exits 0. If tsup names the CJS declaration `index.d.ts`, align the `types`/`exports` declarations with the actual stable output and assert that exact file instead; do not duplicate declaration files manually.

- [ ] **Step 5: Smoke-test the ESM and CommonJS entry points**

Run:

```bash
node --input-type=module -e "const pkg = await import('./packages/ai-engine/build/esm/index.js'); if (pkg.VERSION !== '1.0.0' || typeof pkg.createWorkflowEngine !== 'function') process.exit(1)"
node -e "const pkg = require('./packages/ai-engine/build/cjs/index.cjs'); if (pkg.VERSION !== '1.0.0' || typeof pkg.createWorkflowEngine !== 'function') process.exit(1)"
```

Expected: both commands exit 0 without output and without requiring provider credentials.

- [ ] **Step 6: Commit any root-cause source fixes**

If Steps 1–5 required tracked-file changes, stage only those exact files and commit them:

```bash
git diff --name-only
git add packages/ai-engine/src packages/ai-engine/package.json packages/ai-engine/tsconfig.json packages/ai-engine/tsup.config.ts packages/ai-engine/vitest.config.ts
git commit -m "fix(ai-engine): resolve build validation errors"
```

If no tracked-file changes were required, skip this commit. Never add `packages/ai-engine/build`.

### Task 4: Inspect the package payload and run final verification

**Files:**

- Inspect: `packages/ai-engine/package.json`
- Inspect: temporary `.tgz` output outside the repository

**Interfaces:**

- Consumes: successfully built package from Task 3.
- Produces: evidence that only package metadata and `build/**` ship and the workspace is clean except for intentionally ignored build output.

- [ ] **Step 1: Pack into a fresh temporary directory and capture the manifest**

Run:

```bash
AI_ENGINE_PACK_DIR="$(mktemp -d /private/tmp/ai-engine-pack.XXXXXX)"
pnpm --dir packages/ai-engine pack --json --pack-destination "$AI_ENGINE_PACK_DIR"
```

Expected: JSON reports one `.tgz` under the fresh temporary directory. pnpm 10.24 does not expose a `--dry-run` option, so packing outside the repository is the non-mutating workspace equivalent.

- [ ] **Step 2: Inspect the tarball contents**

Resolve the single tarball created in Step 1 and inspect it:

```bash
AI_ENGINE_TARBALL="$(find "$AI_ENGINE_PACK_DIR" -maxdepth 1 -name '*.tgz' -print -quit)"
test -n "$AI_ENGINE_TARBALL"
tar -tzf "$AI_ENGINE_TARBALL"
```

Expected: entries are limited to `package/package.json`, `package/build/esm/**`, and `package/build/cjs/**`; no `src`, tests, or tool config is present.

- [ ] **Step 3: Run the final verification sequence**

Run:

```bash
pnpm --filter @miaoma-aiflow-demo/ai-engine typecheck
pnpm --filter @miaoma-aiflow-demo/ai-engine test
pnpm --filter @miaoma-aiflow-demo/ai-engine build
git diff --check
git status --short
```

Expected: type checking, tests, build, and whitespace validation all exit 0. Git status contains no unexpected changes; `packages/ai-engine/build` is ignored or otherwise absent from the tracked change set.
