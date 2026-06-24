import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { initSentry } from '@/lib/sentry';
import '@/index.css';

// Inicializa observabilidad antes de montar (no-op si VITE_SENTRY_DSN no está).
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
