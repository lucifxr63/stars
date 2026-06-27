/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Fuente de la cifra fiscal del /dashboard. Default (ausente) = 'rpc'. */
  readonly VITE_FISCAL_SOURCE?: 'rpc' | 'heuristic';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
