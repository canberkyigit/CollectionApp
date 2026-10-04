import { RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { isChunkLoadError } from './chunkLoadError';

export function ErrorFallback({
  error,
  fullScreen,
  onReload,
  onHome,
}: {
  error: Error;
  fullScreen?: boolean;
  onReload: () => void;
  onHome: () => void;
}) {
  const t = useT();
  const chunkError = isChunkLoadError(error);
  const Icon = chunkError ? RotateCw : TriangleAlert;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center justify-center px-4',
        fullScreen ? 'surface-page min-h-screen' : 'py-16',
      )}
    >
      <div className="surface-2 relative w-full max-w-md overflow-hidden rounded-2xl border px-6 py-10 text-center sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,rgba(79,70,229,0.10),transparent_70%)]" />
        <div
          className={cn(
            'relative mx-auto flex size-14 items-center justify-center rounded-2xl ring-1',
            chunkError
              ? 'bg-primary/10 text-primary ring-primary/20'
              : 'bg-destructive/10 text-destructive ring-destructive/20',
          )}
        >
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <p className="relative mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {chunkError ? t('shell.error.chunkEyebrow') : t('shell.error.eyebrow')}
        </p>
        <h2 className="relative mt-3 text-lg font-semibold tracking-tight text-foreground">
          {chunkError ? t('shell.error.chunkTitle') : t('shell.error.title')}
        </h2>
        <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          {chunkError ? t('shell.error.chunkDescription') : t('shell.error.description')}
        </p>
        <div className="relative mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={onReload} className="gap-2">
            <RotateCw className="size-4" aria-hidden="true" />
            {t('shell.error.reload')}
          </Button>
          <Button variant="outline" onClick={onHome}>{t('shell.error.goToCollections')}</Button>
        </div>
        {import.meta.env.DEV && !chunkError && (
          <p className="relative mt-6 break-words rounded-xl bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}
