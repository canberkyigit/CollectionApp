declare global {
  interface Window {
    collectVaultDesktop?: {
      isDesktop?: boolean;
      platform?: string;
      version?: string;
      openExternal?: (url: string) => Promise<boolean>;
    };
  }
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;

  return Boolean(window.collectVaultDesktop?.isDesktop)
    || /Electron/i.test(window.navigator.userAgent);
}

