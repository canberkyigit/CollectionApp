import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

function markDesktopRuntime() {
  const desktopBridge = window.collectVaultDesktop;
  const isElectron = /Electron/i.test(window.navigator.userAgent);

  if (!desktopBridge?.isDesktop && !isElectron) return;

  document.documentElement.classList.add('desktop-app');

  if (desktopBridge?.platform === 'darwin' || /Mac/i.test(window.navigator.platform)) {
    document.documentElement.classList.add('desktop-app-mac');
  }
}

markDesktopRuntime();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
