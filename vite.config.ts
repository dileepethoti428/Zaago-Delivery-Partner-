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
    },
    // Force single React instance to prevent "Cannot read properties of null" errors
    dedupe: ['react', 'react-dom', '@radix-ui/react-tooltip'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@radix-ui/react-tooltip'],
  },
}));
