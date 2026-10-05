import { describe, expect, it } from 'vitest';

import { resolvePublicAppOrigin } from '@/lib/publicUrl';

const loc = (origin: string) => {
  const url = new URL(origin === 'file://' ? 'file:///index.html' : origin);
  return { origin: url.protocol === 'file:' ? 'null' : url.origin, protocol: url.protocol, hostname: url.hostname };
};

describe('resolvePublicAppOrigin', () => {
  it('prefers VITE_PUBLIC_APP_URL and trims trailing slashes', () => {
    expect(resolvePublicAppOrigin(
      { VITE_PUBLIC_APP_URL: 'https://curio.example.com/', VITE_FIREBASE_PROJECT_ID: 'curio-app' },
      loc('http://localhost:5173'),
    )).toBe('https://curio.example.com');
  });

  it('falls back to the Firebase hosting domain on localhost, 127.0.0.1 and file:', () => {
    const env = { VITE_FIREBASE_PROJECT_ID: 'curio-app' };
    expect(resolvePublicAppOrigin(env, loc('http://localhost:4173'))).toBe('https://curio-app.web.app');
    expect(resolvePublicAppOrigin(env, loc('http://127.0.0.1:8080'))).toBe('https://curio-app.web.app');
    expect(resolvePublicAppOrigin(env, loc('file://'))).toBe('https://curio-app.web.app');
  });

  it('keeps the current origin on a real host or when no project id exists', () => {
    expect(resolvePublicAppOrigin({ VITE_FIREBASE_PROJECT_ID: 'curio-app' }, loc('https://curio.example.org')))
      .toBe('https://curio.example.org');
    expect(resolvePublicAppOrigin({}, loc('http://localhost:5173'))).toBe('http://localhost:5173');
    expect(resolvePublicAppOrigin({ VITE_PUBLIC_APP_URL: '  ' }, loc('https://a.example'))).toBe('https://a.example');
  });
});
