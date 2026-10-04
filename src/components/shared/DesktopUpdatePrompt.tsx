import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownToLine, CheckCircle2, ExternalLink, RefreshCw, TriangleAlert, X, Zap } from 'lucide-react';
import { useT } from '@/i18n';
import { isDesktopApp } from '@/lib/runtime';
import type { UpdaterProgressInfo } from '@/lib/runtime';
import { BRAND_NAME } from '@/lib/brand';
import { cn, formatNumber } from '@/lib/utils';

const RELEASES_URL = 'https://github.com/canberkyigit/CollectionApp-Desktop/releases/latest';

type UpdatePhase =
  | { kind: 'idle' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; version: string; progress: UpdaterProgressInfo }
  | { kind: 'downloaded'; version: string }
  | { kind: 'installFailed'; version: string }
  | { kind: 'error'; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${formatNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`;
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined;
}

export function DesktopUpdatePrompt() {
  const t = useT();
  const [phase, setPhase] = useState<UpdatePhase>({ kind: 'idle' });
  const [visible, setVisible] = useState(false);
  const api = useRef(window.collectVaultDesktop?.updater);
  const titleId = useId();
  const descriptionId = useId();

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
        version: prev.kind === 'downloading' || prev.kind === 'available' ? prev.version : '',
        progress: info,
      }));
    });

    u.onDownloaded((info) => {
      setPhase({ kind: 'downloaded', version: info.version });
    });

    u.onError((info) => {
      setPhase({ kind: 'error', message: info.message });
    });

    u.onInstallFailed(() => {
      setPhase((prev) => ({
        kind: 'installFailed',
        version: 'version' in prev ? prev.version : '',
      }));
    });

    return () => u.removeListeners();
  }, []);

  const fail = (error: unknown, fallbackKey: string) => {
    const message = errorMessage(error) ?? t(fallbackKey);
    setPhase({ kind: 'error', message });
    toast.error(t('shell.update.failedTitle'), { description: message });
  };

  const handleDownload = async () => {
    if (!api.current || phase.kind !== 'available') return;
    const { version } = phase;
    setPhase({ kind: 'downloading', version, progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 } });
    try {
      await api.current.startDownload();
    } catch (error) {
      fail(error, 'shell.update.downloadFailed');
    }
  };

  const handleInstall = async () => {
    if (!api.current || phase.kind !== 'downloaded') return;
    const { version } = phase;
    try {
      await api.current.install();
    } catch (error) {
      setPhase({ kind: 'installFailed', version });
      toast.error(t('shell.update.installFailedTitle'), {
        description: errorMessage(error) ?? t('shell.update.installFailedDescription'),
      });
    }
  };

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await api.current?.dismiss();
    } catch {
      // Nothing to recover — the prompt is already hidden.
    }
  };

  const openReleases = () => {
    void window.collectVaultDesktop?.openExternal?.(RELEASES_URL);
  };

  if (!visible || phase.kind === 'idle') return null;

  const isDownloading = phase.kind === 'downloading';
  const isDownloaded = phase.kind === 'downloaded';
  const isInstallFailed = phase.kind === 'installFailed';
  const isError = phase.kind === 'error';
  const percent = isDownloading ? Math.max(0, Math.min(100, Math.round(phase.progress.percent))) : 0;
  const version = 'version' in phase ? phase.version : '';

  const title = isError
    ? t('shell.update.failedTitle')
    : isInstallFailed
      ? t('shell.update.installFailedTitle')
      : isDownloaded
        ? t('shell.update.readyTitle')
        : isDownloading
          ? t('shell.update.downloadingTitle')
          : t('shell.update.availableTitle', { version });

  const description = isError
    ? phase.message
    : isInstallFailed
      ? t('shell.update.installFailedDescription')
      : isDownloaded
        ? t('shell.update.readyDescription', { brand: BRAND_NAME, version })
        : isDownloading
          ? phase.progress.total > 0
            ? t('shell.update.progress', {
                percent,
                speed: formatBytes(phase.progress.bytesPerSecond),
                transferred: formatBytes(phase.progress.transferred),
                total: formatBytes(phase.progress.total),
              })
            : t('shell.update.starting')
          : t('shell.update.availableDescription', { brand: BRAND_NAME });

  const isProblem = isError || isInstallFailed;
  const Icon = isProblem
    ? TriangleAlert
    : isDownloaded
      ? CheckCircle2
      : isDownloading
        ? RefreshCw
        : Zap;

  const primaryButton = cn(
    'flex h-9 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-[oklch(0.98_0_0)] transition-all duration-150',
    'bg-[linear-gradient(135deg,oklch(0.58_0.18_265),oklch(0.52_0.2_265))] shadow-[0_2px_12px_oklch(0.55_0.18_265/0.35)]',
    'hover:-translate-y-px hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.18_265/0.6)]',
  );
  const secondaryButton = cn(
    'flex h-9 items-center justify-center rounded-xl border px-4 text-xs font-medium transition-colors',
    'border-[oklch(0.28_0.01_260)] bg-[oklch(0.2_0.01_260)] text-[oklch(0.6_0.02_260)]',
    'hover:border-[oklch(0.38_0.02_260)] hover:text-[oklch(0.8_0.02_260)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.18_265/0.6)]',
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[12px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border shadow-2xl animate-[update-pop_0.22s_cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:animate-none"
        style={{
          background: 'linear-gradient(145deg, oklch(0.16 0.01 260 / 0.97) 0%, oklch(0.12 0.015 265 / 0.97) 100%)',
          borderColor: 'oklch(0.35 0.04 265 / 0.5)',
          boxShadow: '0 0 0 1px oklch(0.5 0.12 265 / 0.15), 0 32px 64px -12px rgba(0,0,0,0.7), 0 0 80px -20px oklch(0.65 0.18 265 / 0.2)',
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
                background: isProblem
                  ? 'oklch(0.4 0.15 25 / 0.15)'
                  : isDownloaded
                    ? 'oklch(0.55 0.15 145 / 0.15)'
                    : 'oklch(0.65 0.18 265 / 0.12)',
                border: isProblem
                  ? '1px solid oklch(0.5 0.15 25 / 0.3)'
                  : isDownloaded
                    ? '1px solid oklch(0.55 0.15 145 / 0.3)'
                    : '1px solid oklch(0.65 0.18 265 / 0.25)',
              }}
            >
              <Icon
                className={cn('size-5', isDownloading && 'animate-spin motion-reduce:animate-none')}
                style={{
                  color: isProblem
                    ? 'oklch(0.65 0.15 25)'
                    : isDownloaded
                      ? 'oklch(0.7 0.15 145)'
                      : 'oklch(0.65 0.18 265)',
                }}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={titleId} className="text-sm font-semibold leading-tight text-[oklch(0.95_0.01_260)]">
                {title}
              </h2>
              <p
                id={descriptionId}
                className="mt-0.5 text-xs leading-relaxed text-[oklch(0.58_0.02_260)] tabular-nums"
                aria-live="polite"
              >
                {description}
              </p>
            </div>

            {!isDownloading && !isDownloaded && (
              <button
                type="button"
                onClick={() => void handleDismiss()}
                aria-label={t('common.close')}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-[oklch(0.45_0.02_260)] transition-colors hover:bg-[oklch(0.22_0.01_260)] hover:text-[oklch(0.7_0.02_260)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.65_0.18_265/0.6)]"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(isDownloading || isDownloaded) && (
            <div className="mb-5">
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: 'oklch(0.22 0.01 260)' }}
                role="progressbar"
                aria-label={t('shell.update.progressLabel')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={isDownloaded ? 100 : percent}
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
          {!isDownloading && (
            <div className="flex gap-2.5">
              {isProblem ? (
                <>
                  <button type="button" onClick={openReleases} className={primaryButton}>
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    {t('shell.update.openReleases')}
                  </button>
                  <button type="button" onClick={() => void handleDismiss()} className={secondaryButton}>
                    {t('common.close')}
                  </button>
                </>
              ) : isDownloaded ? (
                <>
                  <button type="button" onClick={() => void handleInstall()} className={primaryButton} autoFocus>
                    <ArrowDownToLine className="size-3.5" aria-hidden="true" />
                    {t('shell.update.installRestart')}
                  </button>
                  <button type="button" onClick={() => void handleDismiss()} className={secondaryButton}>
                    {t('shell.update.later')}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => void handleDownload()} className={primaryButton} autoFocus>
                    <ArrowDownToLine className="size-3.5" aria-hidden="true" />
                    {t('shell.update.download')}
                  </button>
                  <button type="button" onClick={() => void handleDismiss()} className={secondaryButton}>
                    {t('shell.update.notNow')}
                  </button>
                </>
              )}
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
