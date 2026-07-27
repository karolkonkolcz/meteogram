import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { SettingsProvider } from './settings/SettingsContext';
import './styles/tokens.css';
import './styles/base.css';

const container = document.getElementById('root');
if (!container) throw new Error('Chýba #root v index.html');

// Predpoveď sa mení dvakrát denne; opakované dotazy pri prepínaní okien
// by len zbytočne zaťažovali Open-Meteo (docs §4).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      gcTime: 60 * 60 * 1000,
    },
  },
});

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// Offline režim je doplnok, nie podmienka behu – zlyhanie registrácie
// nesmie zhodiť aplikáciu.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
