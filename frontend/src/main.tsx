import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry.ts';
import { AppErrorBoundary } from './components/common/ErrorBoundary.tsx';

// Initialize frontend Sentry tracking
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

