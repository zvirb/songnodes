import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Cache busting comes from the content hashes in asset file names (build.rollupOptions.output).
// Do not append ?v= query strings to the entry script: lazy chunks import the entry by its
// plain URL, so a query string makes the browser load and run the app a second time.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  define: {
    '__HMR_CONFIG_NAME__': JSON.stringify('default'),
  },
  server: {
    port: 3006,
    host: true,
    cors: true,
    allowedHosts: ['alienware', 'localhost', '127.0.0.1', '.local'],
    headers: {
      // Completely disable caching
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
    },
    proxy: {
      '/api/v1/graph': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/v1\/graph/, '/api/graph'),
      },
      '/api/graph': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Cache busting with content hashes to force browser updates
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        codeSplitting: {
          // Vendor groups come first: an earlier group takes the modules its members import.
          groups: [
            {
              name: 'pixi-vendor',
              test: /node_modules[\\/]pixi\.js[\\/]/,
            },
            {
              name: 'd3-vendor',
              test: /node_modules[\\/]d3-(force|quadtree)[\\/]/,
            },
            {
              name: 'graph-visualization',
              test: /[\\/]src[\\/]components[\\/]GraphVisualization\.tsx$/,
            },
            {
              name: 'ui-components',
              test: /[\\/]src[\\/]components[\\/](DJInterface|SetlistBuilder|StatsPanel)\.tsx$/,
            },
          ],
        },
      },
    },
    target: 'esnext',
    minify: 'oxc',
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase threshold to 1MB for large components
    // CRITICAL: Fix PIXI.js worker loading
    assetsInlineLimit: 0, // Don't inline workers
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'pixi.js', 'd3-force', 'd3-quadtree', 'fuse.js', 'zustand'],
    exclude: []
  },
});
