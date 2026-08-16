/*
 *   Copyright (c) 2026 妙码学院 @Heyi
 *   All rights reserved.
 *   妙码学院官方出品，作者 @Heyi，供学员学习使用，可用作练习，可用作美化简历，不可开源。
 */
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
