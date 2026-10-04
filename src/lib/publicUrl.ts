/**
 * Public web origin of the app, for links that must open on other devices
 * (QR codes on printed labels, shared links).
 *
 * In the desktop app `window.location.origin` is `http://localhost:<port>`
 * (or `file://`), which a phone scanning a label cannot reach. Resolution:
 *   1. `VITE_PUBLIC_APP_URL` when set;
 *   2. on localhost / 127.0.0.1 / file: → `https://<VITE_FIREBASE_PROJECT_ID>.web.app`;
 *   3. otherwise the current origin.
 */

interface PublicUrlEnv {
  VITE_PUBLIC_APP_URL?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
}

interface LocationLike {
  origin: string;
  protocol: string;
  hostname: string;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

function isLocalLocation(location: LocationLike): boolean {
  return location.protocol === 'file:'
    || LOCAL_HOSTNAMES.has(location.hostname)
    || location.origin === 'null';
}

export function resolvePublicAppOrigin(
  env: PublicUrlEnv,
  location: LocationLike | undefined,
): string {
  const configured = env.VITE_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!location || isLocalLocation(location)) {
    if (projectId) return `https://${projectId}.web.app`;
    return location?.origin && location.origin !== 'null' ? location.origin : '';
  }

  return location.origin;
}

export function getPublicAppOrigin(): string {
  const env = import.meta.env as unknown as PublicUrlEnv;
  const location = typeof window !== 'undefined' ? window.location : undefined;
  return resolvePublicAppOrigin(env, location);
}

/** Absolute public URL for an in-app path such as `/items/abc`. */
export function getPublicAppUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicAppOrigin()}${normalizedPath}`;
}

export function getPublicItemUrl(itemId: string): string {
  return getPublicAppUrl(`/items/${encodeURIComponent(itemId)}`);
}
