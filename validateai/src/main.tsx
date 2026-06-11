import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import '@fontsource-variable/geist';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { initAnalytics } from '@/hooks/useAnalytics';
import { initSentry } from '@/lib/sentry';
import { installChunkReloadHandler } from '@/lib/chunkReload';

// Sentry antes que todo — captura errores de inicialización también
initSentry();
initAnalytics();

// Recupera de "stale deploy": si un chunk lazy falla por hash viejo, recarga.
installChunkReloadHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
