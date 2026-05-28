import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { bootstrapFromUrl } from './lib/urlBootstrap';
import { initTheme } from './lib/theme';
import './styles.css';

initTheme();
bootstrapFromUrl();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
