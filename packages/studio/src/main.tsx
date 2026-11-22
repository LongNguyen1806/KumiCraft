import './app/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { captureSessionToken } from './api/session-token.ts';
import { App } from './app/app.tsx';
import { applyRememberedTheme } from './app/theme.ts';
import { setBridgePayloadDispatcher } from './core/bridge-channel.ts';
import { watchProjectSwitch } from './features/project/project-switch.ts';
import { dispatchBridgePayload } from './features/selection/bridge-payload-handlers.ts';
import { initI18n } from './i18n/i18n.ts';

captureSessionToken();
// The Bridge channel lives in core; what each Bridge message does belongs to the features.
setBridgePayloadDispatcher(dispatchBridgePayload);
applyRememberedTheme();
watchProjectSwitch();
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
