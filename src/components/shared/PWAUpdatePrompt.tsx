import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { isDesktopApp } from '@/lib/runtime';

function BrowserPWAUpdatePrompt() {
  const t = useT();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => { void registration.update(); }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <RefreshCw className="size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{t('shell.pwa.title')}</p>
        <p className="text-xs text-muted-foreground">{t('shell.pwa.description')}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-7 text-xs" onClick={() => updateServiceWorker(true)}>
          {t('shell.pwa.update')}
        </Button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label={t('shell.pwa.dismiss')}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function PWAUpdatePrompt() {
  if (isDesktopApp()) return null;
  return <BrowserPWAUpdatePrompt />;
}
