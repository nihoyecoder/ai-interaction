import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/panel/App';
import '@/panel/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
