import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet, enablePatches } from 'immer';
import './index.css';
import { initTheme } from './styles/theme';
import { requestPersistentStorage } from './db/db';
import App from './App';

enablePatches();
enableMapSet();

// Apply saved mode + preset before first render (no flash).
initTheme();
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
