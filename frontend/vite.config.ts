/// <reference types="vitest" />
/** @format */

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * content.js and inject.js are registered through chrome.scripting as CLASSIC
 * content scripts (see src/lib/scripts.ts), which cannot use ESM `import`.
 * Once they began sharing src/lib/extractors.ts, a single multi-entry build
 * hoisted that shared code into its own chunk and emitted `import` statements
 * into both files — which breaks them at runtime, silently.
 *
 * So they are built one at a time, each as a self-contained IIFE, via
 * BUILD_TARGET (see the `build` script in package.json). The popup and the
 * service worker stay in the default pass; the worker is a real module.
 */
const target = process.env.BUILD_TARGET as 'content' | 'inject' | undefined

const standalone = (name: 'content' | 'inject') =>
    defineConfig({
        base: './',
        build: {
            outDir: 'dist',
            emptyOutDir: false, // the default pass already cleaned dist
            rollupOptions: {
                input: { [name]: `src/${name}.ts` },
                output: {
                    format: 'iife',
                    inlineDynamicImports: true,
                    entryFileNames: `${name}.js`,
                },
            },
            modulePreload: false,
        },
    })

export default target
    ? standalone(target)
    : defineConfig({
          base: './',
          plugins: [react(), tailwindcss()],
          build: {
              outDir: 'dist',
              rollupOptions: {
                  input: {
                      index: 'index.html',
                      sw: 'src/background.ts',
                  },
                  output: {
                      entryFileNames: (chunk) =>
                          chunk.name === 'sw'
                              ? 'background.js'
                              : 'assets/[name]-[hash].js',
                      assetFileNames: 'assets/[name]-[hash][extname]',
                  },
              },
              modulePreload: false,
          },
          test: {
              environment: 'jsdom',
              globals: true,
              setupFiles: './src/test/setupTest.ts',
          },
      })
