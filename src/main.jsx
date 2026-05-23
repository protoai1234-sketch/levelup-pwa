import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

// Register service worker — wrapped so a SW failure never crashes the app
try {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ onNeedRefresh() {}, onOfflineReady() {} });
  }).catch(() => {});
} catch (_) {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
