import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// HARD CACHE CLEAR TRIGGER - 2025-11-05 08:12:30 - Force complete rebuild
// This comment change forces Vite to invalidate all cached dependencies
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    minify: 'esbuild',
    chunkSizeWarningLimit: 500,
    sourcemap: false,
  },
  preview: {
    port: 8080,
    host: "::",
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, './node_modules/@tanstack/react-query'),
    },
    // Force single React instance to prevent "Cannot read properties of null" errors
    dedupe: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@tanstack/react-query',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
    ],
  },
  optimizeDeps: {
    force: true, // Force re-optimization to clear any cached issues
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@tanstack/react-query',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
    ],
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
  cacheDir: '.vite-cache-' + Date.now(), // New cache directory to force clean rebuild
}));
