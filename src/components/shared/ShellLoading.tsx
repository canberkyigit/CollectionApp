import { BrandMark } from '@/components/shared/BrandMark';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

/** Full-screen placeholder while auth resolves or a route chunk loads (original brand + spinner look). */
export function ShellLoading({ className, fullScreen = true }: { className?: string; fullScreen?: boolean }) {
  const t = useT();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center',
        fullScreen && 'surface-page min-h-screen',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
        <BrandMark
          className="size-14 rounded-[0.82rem] shadow-[0_18px_40px_rgba(79,70,229,0.28)] animate-pulse motion-reduce:animate-none"
          title=""
        />
        <div
          className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    </div>
  );
}
