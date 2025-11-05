import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        // Simplified chunking - let Vite auto-chunk to prevent React duplication
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
    },
    // Force single React instance to prevent "Cannot read properties of null" errors
    dedupe: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
    ],
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
    ],
    force: true,
    esbuildOptions: {
      // Ensure all JSX is handled by the same React instance
      jsx: 'automatic',
    },
  },
  // Clear all caches on startup to prevent React duplication
  cacheDir: '.vite-' + Date.now(),
}));
