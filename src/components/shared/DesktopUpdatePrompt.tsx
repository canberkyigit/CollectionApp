import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, ExternalLink, RefreshCw, X, Zap } from 'lucide-react';
import { isDesktopApp } from '@/lib/runtime';
import type { UpdaterProgressInfo } from '@/lib/runtime';

type UpdatePhase =
  | { kind: 'idle' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; version: string; progress: UpdaterProgressInfo }
  | { kind: 'downloaded'; version: string }
  | { kind: 'installFailed'; version: string }
  | { kind: 'error'; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DesktopUpdatePrompt() {
  const [phase, setPhase] = useState<UpdatePhase>({ kind: 'idle' });
  const [visible, setVisible] = useState(false);
  const api = useRef(window.collectVaultDesktop?.updater);

  useEffect(() => {
    if (!isDesktopApp() || !api.current) return;
    const u = api.current;

    u.onAvailable((info) => {
      setPhase({ kind: 'available', version: info.version });
      setVisible(true);
    });

    u.onProgress((info) => {
      setPhase((prev) => ({
        kind: 'downloading',
        version: prev.kind === 'downloading' ? prev.version : (prev.kind === 'available' ? prev.version : ''),
        progress: info,
      }));
    });

    u.onDownloaded((info) => {
      setPhase({ kind: 'downloaded', version: info.version });
    });

    u.onError((info) => {
      setPhase({ kind: 'error', message: info.message });
      setTimeout(() => setVisible(false), 5000);
    });

    u.onInstallFailed((_info) => {
      setPhase((prev) => ({
        kind: 'installFailed',
        version: prev.kind === 'downloaded' ? prev.version : '',
      }));
    });

    return () => u.removeListeners();
  }, []);

  const handleDownload = async () => {
    if (!api.current || phase.kind !== 'available') return;
    const { version } = phase;
    setPhase({ kind: 'downloading', version, progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 } });
    await api.current.startDownload();
  };

  const handleInstall = async () => {
    if (!api.current) return;
    await api.current.install();
  };

  const handleDismiss = async () => {
    if (!api.current) return;
    await api.current.dismiss();
    setVisible(false);
  };

  if (!visible || phase.kind === 'idle') return null;

  const isDownloading = phase.kind === 'downloading';
  const isDownloaded = phase.kind === 'downloaded';
  const isInstallFailed = phase.kind === 'installFailed';
  const isError = phase.kind === 'error';
  const percent = isDownloading ? Math.round(phase.progress.percent) : 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="relative w-[400px] overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, oklch(0.16 0.01 260 / 0.97) 0%, oklch(0.12 0.015 265 / 0.97) 100%)',
          borderColor: 'oklch(0.35 0.04 265 / 0.5)',
          boxShadow: '0 0 0 1px oklch(0.5 0.12 265 / 0.15), 0 32px 64px -12px rgba(0,0,0,0.7), 0 0 80px -20px oklch(0.65 0.18 265 / 0.2)',
          animation: 'update-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, oklch(0.65 0.18 265 / 0.6), transparent)' }}
        />

        <div className="p-6">
          {/* Header */}
          <div className="mb-5 flex items-start gap-4">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: isError || isInstallFailed
                  ? 'oklch(0.4 0.15 25 / 0.15)'
                  : isDownloaded
                    ? 'oklch(0.55 0.15 145 / 0.15)'
                    : 'oklch(0.65 0.18 265 / 0.12)',
                border: isError || isInstallFailed
                  ? '1px solid oklch(0.5 0.15 25 / 0.3)'
                  : isDownloaded
                    ? '1px solid oklch(0.55 0.15 145 / 0.3)'
                    : '1px solid oklch(0.65 0.18 265 / 0.25)',
              }}
            >
              {isError || isInstallFailed ? (
                <X className="size-5" style={{ color: 'oklch(0.65 0.15 25)' }} />
              ) : isDownloaded ? (
                <CheckCircle2 className="size-5" style={{ color: 'oklch(0.7 0.15 145)' }} />
              ) : isDownloading ? (
                <RefreshCw className="size-5 animate-spin" style={{ color: 'oklch(0.65 0.18 265)' }} />
              ) : (
                <Zap className="size-5" style={{ color: 'oklch(0.65 0.18 265)' }} />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold leading-tight" style={{ color: 'oklch(0.95 0.01 260)' }}>
                {isError
                  ? 'Update failed'
                  : isInstallFailed
                    ? 'Auto-install unavailable'
                    : isDownloaded
                      ? 'Ready to install'
                      : isDownloading
                        ? 'Downloading update…'
                        : `Version ${(phase as { version: string }).version} is available`}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'oklch(0.58 0.02 260)' }}>
                {isError
                  ? phase.message
                  : isInstallFailed
                    ? 'This build is unsigned. Download the new version manually from GitHub.'
                    : isDownloaded
                      ? `CollectVault ${(phase as { version: string }).version} is ready. Restart to apply.`
                      : isDownloading
                        ? `${percent}% · ${formatBytes(phase.progress.bytesPerSecond)}/s · ${formatBytes(phase.progress.transferred)} of ${formatBytes(phase.progress.total)}`
                        : 'A new CollectVault build is available. Install it now?'}
              </p>
            </div>

            {!isDownloading && !isDownloaded && (
              <button
                type="button"
                onClick={handleDismiss}
                className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors"
                style={{ color: 'oklch(0.45 0.02 260)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.7 0.02 260)'; (e.currentTarget as HTMLElement).style.background = 'oklch(0.22 0.01 260)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.45 0.02 260)'; (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(isDownloading || isDownloaded) && (
            <div className="mb-5">
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: 'oklch(0.22 0.01 260)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: isDownloaded ? '100%' : `${percent}%`,
                    background: isDownloaded
                      ? 'oklch(0.65 0.15 145)'
                      : 'linear-gradient(90deg, oklch(0.55 0.18 265), oklch(0.72 0.2 265))',
                    boxShadow: isDownloaded
                      ? '0 0 8px oklch(0.65 0.15 145 / 0.5)'
                      : '0 0 8px oklch(0.65 0.18 265 / 0.5)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isError && (
            <div className="flex gap-2.5">
              {isInstallFailed ? (
                <>
                  <button
                    type="button"
                    onClick={() => window.collectVaultDesktop?.openExternal?.('https://github.com/canberkyigit/CollectionApp-Desktop/releases/latest')}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all duration-150"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.58 0.18 265), oklch(0.52 0.2 265))',
                      color: 'oklch(0.98 0 0)',
                      boxShadow: '0 2px 12px oklch(0.55 0.18 265 / 0.35)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                  >
                    <ExternalLink className="size-3.5" />
                    Open GitHub Releases
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex h-9 items-center justify-center rounded-xl px-4 text-xs font-medium transition-colors"
                    style={{ background: 'oklch(0.2 0.01 260)', color: 'oklch(0.6 0.02 260)', border: '1px solid oklch(0.28 0.01 260)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.8 0.02 260)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.6 0.02 260)'; }}
                  >
                    Dismiss
                  </button>
                </>
              ) : isDownloaded ? (
                <>
                  <button
                    type="button"
                    onClick={handleInstall}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all duration-150"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.58 0.18 265), oklch(0.52 0.2 265))',
                      color: 'oklch(0.98 0 0)',
                      boxShadow: '0 2px 12px oklch(0.55 0.18 265 / 0.35)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = ''; }}
                  >
                    <ArrowDownToLine className="size-3.5" />
                    Install & Restart
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex h-9 items-center justify-center rounded-xl px-4 text-xs font-medium transition-colors"
                    style={{ background: 'oklch(0.2 0.01 260)', color: 'oklch(0.6 0.02 260)', border: '1px solid oklch(0.28 0.01 260)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.8 0.02 260)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.38 0.02 260)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.6 0.02 260)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.28 0.01 260)'; }}
                  >
                    Later
                  </button>
                </>
              ) : !isDownloading ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all duration-150"
                    style={{
                      background: 'linear-gradient(135deg, oklch(0.58 0.18 265), oklch(0.52 0.2 265))',
                      color: 'oklch(0.98 0 0)',
                      boxShadow: '0 2px 12px oklch(0.55 0.18 265 / 0.35)',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.transform = ''; }}
                  >
                    <ArrowDownToLine className="size-3.5" />
                    Download Update
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex h-9 items-center justify-center rounded-xl px-4 text-xs font-medium transition-colors"
                    style={{ background: 'oklch(0.2 0.01 260)', color: 'oklch(0.6 0.02 260)', border: '1px solid oklch(0.28 0.01 260)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.8 0.02 260)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.38 0.02 260)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'oklch(0.6 0.02 260)'; (e.currentTarget as HTMLElement).style.borderColor = 'oklch(0.28 0.01 260)'; }}
                  >
                    Not now
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>

        <style>{`
          @keyframes update-pop {
            from { opacity: 0; transform: scale(0.92) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
