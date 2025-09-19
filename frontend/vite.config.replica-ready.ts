import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// ================================================
// VITE CONFIGURATION FOR REPLICA-READY DEPLOYMENT
// ================================================
// This configuration ensures frontend works properly
// in a replica-ready environment with nginx load balancing
// ================================================

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 days
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
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'redux',
      'react-redux',
      '@reduxjs/toolkit',
      'd3',
      'three',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          redux: ['redux', 'react-redux', '@reduxjs/toolkit'],
          ui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          visualization: ['d3', 'three'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
  },
  server: {
    port: 3006,
    host: '0.0.0.0', // Allow connections from other containers
    open: false,
    cors: true,
    proxy: {
      // ================================================
      // REPLICA-READY PROXY CONFIGURATION
      // ================================================
      // In production, these requests will go through nginx
      // In development, they go directly to services for testing
      // All proxy targets use environment variables for flexibility
      // ================================================

      '/api/v1/graph': {
        target: process.env.VITE_VISUALIZATION_API_URL || 'http://enhanced-visualization-service:8085',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/api/v1/visualization': {
        target: process.env.VITE_VISUALIZATION_API_URL || 'http://enhanced-visualization-service:8085',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://api-gateway:8080',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'http://api-gateway:8080',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://enhanced-visualization-service:8085',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  // Preview server configuration (for production builds)
  preview: {
    port: 3006,
    host: '0.0.0.0',
    open: false,
    cors: true,
    proxy: {
      // Same proxy configuration for preview mode
      '/api/v1/graph': {
        target: process.env.VITE_VISUALIZATION_API_URL || 'http://enhanced-visualization-service:8085',
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/visualization': {
        target: process.env.VITE_VISUALIZATION_API_URL || 'http://enhanced-visualization-service:8085',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: process.env.VITE_API_URL || 'http://api-gateway:8080',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_API_URL || 'http://api-gateway:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});