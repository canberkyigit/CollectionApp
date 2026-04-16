export interface UpdaterProgressInfo {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdaterVersionInfo {
  version: string;
}

export interface UpdaterErrorInfo {
  message: string;
}

export interface CollectVaultUpdaterApi {
  onAvailable: (cb: (info: UpdaterVersionInfo) => void) => void;
  onProgress: (cb: (info: UpdaterProgressInfo) => void) => void;
  onDownloaded: (cb: (info: UpdaterVersionInfo) => void) => void;
  onNotAvailable: (cb: (info: UpdaterVersionInfo) => void) => void;
  onError: (cb: (info: UpdaterErrorInfo) => void) => void;
  removeListeners: () => void;
  startDownload: () => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => Promise<void>;
}

declare global {
  interface Window {
    collectVaultDesktop?: {
      isDesktop?: boolean;
      platform?: string;
      version?: string;
      openExternal?: (url: string) => Promise<boolean>;
      localSync?: CollectVaultLocalSyncApi;
      updater?: CollectVaultUpdaterApi;
    };
  }
}

export interface LocalSyncManifestCounts {
  categories: number;
  items: number;
  libraries: number;
  wishlist: number;
  activityLog: number;
  contributors: number;
}

export interface LocalSyncAssetIssue {
  source: string;
  reason: string;
}

export interface LocalSyncStatus {
  exists: boolean;
  path: string;
  sizeBytes: number;
  syncedAt: string | null;
  appVersion?: string;
  counts: LocalSyncManifestCounts | null;
  assetCount: number;
  failedAssets: LocalSyncAssetIssue[];
}

export interface CollectVaultLocalSyncApi {
  getStatus: () => Promise<LocalSyncStatus>;
  syncSnapshot: (snapshot: unknown) => Promise<LocalSyncStatus>;
  restoreSnapshot: () => Promise<unknown>;
  openFolder: () => Promise<boolean>;
}

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;

  return Boolean(window.collectVaultDesktop?.isDesktop)
    || /Electron/i.test(window.navigator.userAgent);
}

export function getDesktopLocalSyncApi(): CollectVaultLocalSyncApi | null {
  if (!isDesktopApp()) return null;
  return window.collectVaultDesktop?.localSync ?? null;
}
