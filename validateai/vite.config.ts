import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    // Sentry source maps — solo activo cuando SENTRY_AUTH_TOKEN está en el entorno (CI/CD)
    // Configura en Vercel: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org:        process.env.SENTRY_ORG,
      project:    process.env.SENTRY_PROJECT,
      authToken:  process.env.SENTRY_AUTH_TOKEN,
      telemetry:  false,
    })] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      '@react-pdf/renderer',
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/privacy/**/*.ts',
        'src/utils/biasDetector.ts',
        'src/lib/rateLimitHelpers.ts',
      ],
      exclude: ['src/**/__tests__/**', 'src/lib/privacy/types.ts'],
      thresholds: {
        lines: 80,
        functions: 85,
        branches: 75,
      },
    },
    testTimeout: 30_000,
    reporters: ['verbose'],
  },
})
