import './app/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { captureSessionToken } from './api/session-token.ts';
import { App } from './app/app.tsx';
import { initI18n } from './i18n/i18n.ts';

captureSessionToken();
await initI18n();

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html has no #root element');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
