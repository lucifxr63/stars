import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Puerto propio para convivir con el dev de Validus (5173). Este redirect
  // (http://localhost:5174/auth/callback) está en la allowlist de Supabase Auth.
  // strictPort: si 5174 está ocupado, Vite FALLA en vez de saltar a 5175 — un
  // puerto distinto rompería el OAuth (redirect_to no estaría en la allowlist y
  // Supabase caería al site_url de Validus).
  server: { port: 5174, strictPort: true },
});
