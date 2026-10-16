import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Home } from './pages/Home.jsx';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Home />
    </StrictMode>,
  );
}
