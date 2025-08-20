import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'text-summary',
        'json',
        'json-summary',
        'html',
        'lcov',
        'clover',
        'cobertura'
      ],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        '**/coverage/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/cypress/**',
        '**/e2e/**',
        '**/playwright/**',
        '**/*.stories.*',
        '**/storybook-static/**',
        '**/vite.config.*',
        '**/vitest.config.*',
        '**/tailwind.config.*',
        '**/postcss.config.*',
      ],
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
      ],
      // Coverage thresholds - CI will fail if not met
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Per-file thresholds for critical components
        'src/components/GraphCanvas/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'src/utils/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'src/store/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/hooks/': {
          branches: 88,
          functions: 88,
          lines: 88,
          statements: 88,
        },
      },
      // Enable all coverage options
      all: true,
      skipFull: false,
      // Watermarks for coverage reporting
      watermarks: {
        statements: [75, 90],
        functions: [75, 90],
        branches: [75, 90],
        lines: [75, 90],
      },
    },
    // Test timeout for coverage tests
    testTimeout: 10000,
    hookTimeout: 10000,
    // Pool configuration for coverage
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
  },
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
    },
  },
});