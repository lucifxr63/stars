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
    // @react-pdf/renderer usa workers internos que no deben pre-bundlearse con Vite
    exclude: ['@react-pdf/renderer'],
  },
})
