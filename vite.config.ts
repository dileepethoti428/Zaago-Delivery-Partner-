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
  optimizeDeps: {
    // Ensure React is deduplicated and properly shared
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure consistent hashing for better caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: (id) => {
          // Ensure React and all React-dependent libraries are in the same chunk
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui') || id.includes('next-themes')) {
              return 'vendor-react'; // Keep with React to avoid duplicate instances
            }
            if (id.includes('mapbox-gl')) {
              return 'vendor-maps';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('@supabase/supabase-js')) {
              return 'vendor-supabase';
            }
            // All other node_modules
            return 'vendor';
          }
        },
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
  },
}));
