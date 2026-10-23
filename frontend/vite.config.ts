import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// ✅ NUCLEAR CACHE-BUST: Add build timestamp to ALL script/CSS/preload URLs
const timestampPlugin = () => {
  return {
    name: 'timestamp-inject',
    transformIndexHtml(html: string) {
      const timestamp = Date.now();
      // Add ?v=timestamp to ALL script tags, CSS links, and module preloads
      return html
        .replace(/(<script[^>]+src="[^"]+)(")/g, `$1?v=${timestamp}$2`)
        .replace(/(<link[^>]+href="[^"]+\.css)(")/g, `$1?v=${timestamp}$2`)
        .replace(/(<link[^>]+href="[^"]+\.js)(")/g, `$1?v=${timestamp}$2`);
    },
  };
};

export default defineConfig({
  plugins: [react(), timestampPlugin()],
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
          groups: [
            {
              name: 'graph-visualization',
              test: /[\\/]src[\\/]components[\\/]GraphVisualization\.tsx$/,
            },
            {
              name: 'pixi-vendor',
              test: /node_modules[\\/]pixi\.js[\\/]/,
            },
            {
              name: 'd3-vendor',
              test: /node_modules[\\/]d3-(force|quadtree)[\\/]/,
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