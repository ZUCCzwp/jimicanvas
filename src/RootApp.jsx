import { useState } from 'react';
import App from './App.jsx';
import { CanvasHome } from './pages/CanvasHome.jsx';
import { resolveInitialView } from './lib/routing.js';

export default function RootApp() {
  const [view] = useState(() => resolveInitialView());
  if (view === 'editor') return <App />;
  return <CanvasHome />;
}
