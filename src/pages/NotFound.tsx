import { Link } from 'react-router-dom';
import { ArrowRight, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

export default function NotFound() {
  const t = useT();

  return (
    <div className="flex items-center justify-center py-16 sm:py-24">
      <div className="surface-2 relative w-full max-w-lg overflow-hidden rounded-2xl border px-6 py-12 text-center sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.12),transparent_60%)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-background shadow-[0_18px_40px_rgba(79,70,229,0.16)] ring-1 ring-border/60">
          <MapPinOff className="size-8 text-primary/80" aria-hidden="true" />
        </div>
        <p className="relative mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
          {t('shell.notFound.eyebrow')}
        </p>
        <h1 className="relative mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('shell.notFound.title')}
        </h1>
        <p className="relative mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          {t('shell.notFound.description')}
        </p>
        <Button asChild className="relative mt-8 gap-2 shadow-[0_12px_28px_rgba(79,70,229,0.24)]">
          <Link to="/collections">
            {t('shell.error.goToCollections')}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
