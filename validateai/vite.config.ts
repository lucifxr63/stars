import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
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
    include: ['src/lib/privacy/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/privacy/**/*.ts'],
      exclude: ['src/lib/privacy/__tests__/**', 'src/lib/privacy/types.ts'],
      thresholds: {
        lines: 85,
        functions: 90,
        branches: 80,
      },
    },
    // Tests estadísticos necesitan más tiempo por Monte Carlo
    testTimeout: 30_000,
    reporters: ['verbose'],
  },
})
