import React from 'react';
import ReactDOM from 'react-dom/client';

// Styles, in order (design-system/17-governance: tokens.css, then bundle.css, then app CSS).
// 1. The design system: single source of truth for every formatting and design decision.
import './styles/design-system/tokens.css';
import './styles/design-system/bundle.css';
// 3. Legacy variable names re-pointed at design-system tokens, then app-level layout.
import './styles/legacy-aliases.css';
import './styles/app.css';
// 4. window.SongNodes helpers (format, camelot, compat, status, prefs, icons).
import { SN } from './lib/songnodes';
import App from './App';

SN.prefs.init();

// Right-click on the graph canvas opens the app's own context menu, not the browser's.
document.addEventListener('contextmenu', (e) => {
  if (e.target instanceof HTMLCanvasElement) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
