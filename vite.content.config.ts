import { defineConfig } from 'vite'
import { resolve } from 'path'

// Separate build for the content script.
// Must be IIFE format — Chrome injects content scripts as plain scripts,
// not ES modules. No "type": "module" in the manifest for content scripts.

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // don't wipe the panel build
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'AIChatOrganizerContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        // Ensure no exports — pure side-effect script
        exports: 'none',
      },
    },
  },
})
