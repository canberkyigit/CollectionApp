import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isDesktopApp } from '@/lib/runtime';

function BrowserPWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(() => { registration.update(); }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
      <RefreshCw className="size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-medium">Update available</p>
        <p className="text-xs text-muted-foreground">Refresh to get the latest version</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="h-7 text-xs" onClick={() => updateServiceWorker(true)}>
          Update
        </Button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PWAUpdatePrompt() {
  if (isDesktopApp()) return null;
  return <BrowserPWAUpdatePrompt />;
}
