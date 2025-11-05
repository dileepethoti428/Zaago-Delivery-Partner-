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
    dedupe: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },
  optimizeDeps: {
    force: true, // TEMPORARY: Force rebuild to clear duplicate React cache
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@tanstack/react-query',
    ],
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
}));
