import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheKeyWillBeUsed: async ({ request }) => {
                return `${request.url}?version=1`;
              },
            },
          },
        ],
      },
      manifest: {
        name: 'SongNodes - Music Graph Visualization',
        short_name: 'SongNodes',
        description: 'Interactive music relationship graph visualization',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@store': resolve(__dirname, 'src/store'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@constants': resolve(__dirname, 'src/constants'),
      '@services': resolve(__dirname, 'src/services'),
      '@assets': resolve(__dirname, 'src/assets'),
      '@theme': resolve(__dirname, 'src/theme'),
    },
  },
  define: {
    global: 'globalThis',
    // Enable PIXI deprecation filtering in production builds
    'import.meta.env.VITE_FILTER_PIXI_DEPRECATIONS': JSON.stringify(process.env.NODE_ENV === 'production' ? 'true' : 'false'),
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'd3',
      'pixi.js',
      '@reduxjs/toolkit',
      'react-redux',
      'framer-motion',
      'lodash-es',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          d3: ['d3', 'd3-force', 'd3-selection', 'd3-zoom', 'd3-drag'],
          pixi: ['pixi.js', '@pixi/react'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          ui: ['framer-motion', 'react-window', 'react-virtualized-auto-sizer'],
          utils: ['lodash-es'],
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/img/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
  },
  server: {
    port: 3006,
    open: false,
    cors: true,
    proxy: {
      '/api/v1/graph': {
        target: process.env.VITE_VISUALIZATION_API_URL,
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/visualization': {
        target: process.env.VITE_VISUALIZATION_API_URL,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://api-gateway',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'http://api-gateway',
        changeOrigin: true,
        secure: false,
      },
      '/metrics': {
        target: process.env.VITE_API_URL || 'http://api-gateway',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://enhanced-visualization-service',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3006,
    host: '0.0.0.0',
    open: false,
    cors: true,
    proxy: {
      '/api/v1/graph': {
        target: process.env.VITE_VISUALIZATION_API_URL,
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/visualization': {
        target: process.env.VITE_VISUALIZATION_API_URL,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://api-gateway',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'http://api-gateway',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
      ],
    },
  },
});