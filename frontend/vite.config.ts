/// <reference types="vitest" />
/** @format */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                index: 'index.html',
                sw: 'src/background.ts',
                content: 'src/content.ts',
                inject: 'src/inject.ts',
            },
            output: {
                entryFileNames: (chunk) => {
                    // 2. Ensure both sw and content don't get hashes
                    if (chunk.name === 'sw') return 'background.js'
                    if (chunk.name === 'content') return 'content.js'
                    if (chunk.name === 'inject') return 'inject.js'
                    return 'assets/[name]-[hash].js'
                },
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setupTest.ts',
    },
})
