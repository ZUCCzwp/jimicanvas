import React from 'react';
import ReactDOM from 'react-dom/client';
import RootApp from './RootApp.jsx';
import { bootstrapFromUrl } from './lib/urlBootstrap';
import { clearLegacyCanvasCache } from './lib/storage';
import { initTheme } from './lib/theme';
import './styles.css';

initTheme();
clearLegacyCanvasCache();
bootstrapFromUrl();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
