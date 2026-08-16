# AI Engine Build Repair Design

## Goal

Make `packages/ai-engine` a conventional pnpm workspace package that can be type-checked, tested, and built from the repository root without changing its runtime behavior.

## Current problem

The workspace recognizes `packages/ai-engine/package.json`, which has no build script or dependencies. The actual package metadata and build configuration were created one directory too deep under `packages/ai-engine/src`. From that location, the configured source entry resolves to the nonexistent `src/src/index.ts`, and the TypeScript base configuration resolves to the nonexistent `packages/tsconfig.client.json`. The package also does not declare the `tsup` and `rimraf` tools used by its scripts.

## Chosen design

- Keep one workspace package rooted at `packages/ai-engine`.
- Preserve its existing workspace identity: `@miaoma-aiflow-demo/ai-engine`.
- Merge the inner package metadata into the root package manifest, including module outputs, scripts, runtime dependencies, and build dependencies.
- Move `tsconfig.json`, `tsup.config.ts`, and `vitest.config.ts` to the package root without changing application source locations.
- Remove the nested `src/package.json` so pnpm and Node do not encounter a second package boundary inside the source tree.
- Keep source code under `packages/ai-engine/src` and build output under `packages/ai-engine/build`.

## Build outputs

The build will continue to generate bundled ESM and CommonJS outputs:

- `build/esm/index.js` and declarations
- `build/cjs/index.cjs` and declarations

The package manifest will expose these files through `main`, `module`, and `types`.

## Dependency handling

Runtime dependencies from the nested manifest will become dependencies of the workspace package. `tsup`, `rimraf`, `typescript`, `tsx`, and `vitest` will be development dependencies. The repository lockfile will be updated through pnpm rather than edited manually.

## Validation

The existing failing build is the regression reproduction. After the structural repair:

1. Install workspace dependencies.
2. Run the package type check.
3. Run the package tests.
4. Run the production build through the workspace filter.
5. Confirm the declared ESM, CommonJS, and type entry files exist.

If compilation exposes source-level errors, address only errors required for this package to type-check and build, with a failing test or compiler reproduction before each change.

## Out of scope

- Renaming the package to `@aiflow/ai-engine`.
- Refactoring workflow behavior or public APIs.
- Modifying the API server or workflow application.
- Publishing the package.
