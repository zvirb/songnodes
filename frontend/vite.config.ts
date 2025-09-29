import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3006,
    host: true,
    cors: true,
    headers: {
      // Completely disable caching
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    },
    proxy: {
      '/api/v1/graph': {
        target: process.env.VITE_VISUALIZATION_API_URL || 'http://graph-visualization-api:8084',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/v1\/graph/, '/api/graph'),
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://api-gateway:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // No cache busting - let browser handle it
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        manualChunks: {
          // Split large visualization components
          'graph-visualization': ['./src/components/GraphVisualization.tsx'],
          'pixi-vendor': ['pixi.js'],
          'd3-vendor': ['d3-force', 'd3-quadtree'],
          'ui-components': [
            './src/components/DJInterface.tsx',
            './src/components/SetlistBuilder.tsx',
            './src/components/StatsPanel.tsx'
          ]
        }
      },
    },
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase threshold to 1MB for large components
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'pixi.js', 'd3-force', 'd3-quadtree', 'fuse.js', 'zustand'],
    exclude: []
  },
});