import { describe, expect, it } from 'vitest';

import { isDesktopApp } from '@/lib/runtime';

describe('runtime helpers', () => {
  it('detects desktop bridge and electron user agents', () => {
    const originalBridge = window.collectVaultDesktop;
    const originalUserAgent = window.navigator.userAgent;

    window.collectVaultDesktop = { isDesktop: true };
    expect(isDesktopApp()).toBe(true);

    window.collectVaultDesktop = undefined;
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Electron/28.0',
    });
    expect(isDesktopApp()).toBe(true);

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
    window.collectVaultDesktop = originalBridge;
  });
});
