import { createElement, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  X,
} from 'lucide-react';

import { conditionLabel } from '@/components/collections/conditionLabel';
import { useT } from '@/i18n';
import type { ExhibitionSlide } from '@/lib/exhibition';
import { getCategoryIcon } from '@/lib/icons';
import { cn, formatCurrency } from '@/lib/utils';
import { getItemCurrentValue } from '@/lib/valuation';
import { QRCodeSVG } from 'qrcode.react';
import { getPublicItemUrl } from '@/lib/publicUrl';

interface ExhibitionStageProps {
  slides: ExhibitionSlide[];
  startIndex?: number;
  intervalSeconds: number;
  autoplay: boolean;
  showValues: boolean;
  /** Small QR code in the corner that opens the current piece on a phone. */
  showQr?: boolean;
  /**
   * Kiosk: plays in a loop, keeps the screen awake and hides the cursor and
   * controls after a few seconds without input (they return on any movement).
   */
  kiosk?: boolean;
  displayCurrency: string;
  onExit: () => void;
}

const KIOSK_IDLE_MS = 3000;

const CONTROL_BUTTON =
  'inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

/**
 * Full-screen slideshow for presenting a collection: large photo over a
 * blurred copy of itself, a glass caption panel and keyboard controls
 * (←/→ navigate, Space play/pause, I caption, T thumbnails, F full screen, Esc exit).
 */
export function ExhibitionStage({
  slides,
  startIndex = 0,
  intervalSeconds,
  autoplay,
  showValues,
  showQr = false,
  kiosk = false,
  displayCurrency,
  onExit,
}: ExhibitionStageProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.min(Math.max(startIndex, 0), Math.max(slides.length - 1, 0)));
  const [playing, setPlaying] = useState((autoplay || kiosk) && slides.length > 1);
  const [uiVisible, setUiVisible] = useState(true);
  const chromeHidden = kiosk && !uiVisible;
  const [showCaption, setShowCaption] = useState(true);
  const [showThumbs, setShowThumbs] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Caption height, so phones can lift the photo above the caption instead of hiding it behind.
  const [captionEl, setCaptionEl] = useState<HTMLDivElement | null>(null);
  const [captionHeight, setCaptionHeight] = useState(0);
  const captionRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setCaptionEl(node);
  }, []);

  useEffect(() => {
    if (!captionEl || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (captionEl.isConnected) setCaptionHeight(captionEl.getBoundingClientRect().height);
    });
    observer.observe(captionEl);
    return () => observer.disconnect();
  }, [captionEl]);

  const count = slides.length;
  const slide = slides[index];
  const go = useCallback((delta: number) => {
    if (count === 0) return;
    setIndex((current) => (current + delta + count) % count);
  }, [count]);

  // Autoplay: advance after the interval; restarting on every slide keeps the progress bar in sync.
  useEffect(() => {
    if (!playing || count < 2) return undefined;
    const timer = window.setTimeout(() => go(1), intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, index, intervalSeconds, count, go]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen?.();
    } catch {
      // Full screen is optional (some browsers/app views refuse it); the overlay already fills the window.
    }
  }, []);

  // Kiosk: hide the chrome after a few idle seconds; any input brings it back.
  useEffect(() => {
    if (!kiosk) return undefined;
    let timer = window.setTimeout(() => setUiVisible(false), KIOSK_IDLE_MS);
    const wake = () => {
      setUiVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setUiVisible(false), KIOSK_IDLE_MS);
    };
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'];
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, [kiosk]);

  // Kiosk: keep the screen awake while the show runs (re-acquired when the tab becomes visible again).
  useEffect(() => {
    if (!kiosk || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (disposed) void lock.release();
      } catch {
        // Not granted (battery saver, unsupported view) — the show still runs.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => undefined);
    };
  }, [kiosk]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    void stageRef.current?.requestFullscreen?.().catch(() => undefined);
    stageRef.current?.focus();
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
          event.preventDefault(); go(1); break;
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault(); go(-1); break;
        case ' ':
          event.preventDefault(); setPlaying((value) => !value); break;
        case 'Home':
          event.preventDefault(); setIndex(0); break;
        case 'End':
          event.preventDefault(); setIndex(Math.max(count - 1, 0)); break;
        case 'i':
        case 'I':
          setShowCaption((value) => !value); break;
        case 't':
        case 'T':
          setShowThumbs((value) => !value); break;
        case 'f':
        case 'F':
          void toggleFullscreen(); break;
        case 'Escape':
          // When in browser full screen, Esc first leaves it (handled by the browser); exit on the next press.
          if (!document.fullscreenElement) onExit();
          break;
        default:
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, go, onExit, toggleFullscreen]);

  if (!slide) return null;

  const { item, category, image, highlights } = slide;
  const categoryIcon = (className: string, strokeWidth?: number) => createElement(
    getCategoryIcon(category?.icon ?? 'Package'),
    { className, strokeWidth, 'aria-hidden': true },
  );
  const value = getItemCurrentValue(item, displayCurrency);
  const year = highlights.find((entry) => /year/i.test(entry.key))?.value;

  return (
    <div
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('exhibition.stageLabel')}
      tabIndex={-1}
      className={cn('fixed inset-0 z-[90] overflow-hidden bg-black text-white outline-none', chromeHidden && 'cursor-none')}
    >
      {/* Blurred backdrop of the current photo */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`bg-${item.id}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8 }}
          aria-hidden="true"
        >
          {image ? (
            <img src={image} alt="" className="size-full scale-125 object-cover opacity-45 blur-3xl" />
          ) : (
            <div className="size-full bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.55),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.45),transparent_50%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/80" />
        </motion.div>
      </AnimatePresence>

      {/* Main photo */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center px-4 pt-24 sm:px-16',
          showThumbs ? 'pb-48' : 'pb-28',
          showCaption && (showThumbs ? 'max-sm:pb-[calc(var(--caption-h)+12.75rem)]' : 'max-sm:pb-[calc(var(--caption-h)+7.75rem)]'),
        )}
        style={{ '--caption-h': `${Math.round(captionHeight)}px` } as CSSProperties}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={item.id}
            className="relative flex h-full w-full items-center justify-center"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: 'easeOut' }}
          >
            {image ? (
              <motion.img
                src={image}
                alt={item.title}
                className="h-full w-full object-contain [filter:drop-shadow(0_40px_80px_rgba(0,0,0,0.6))]"
                initial={{ scale: 1 }}
                animate={{ scale: reduceMotion || !playing ? 1 : 1.05 }}
                transition={{ duration: reduceMotion ? 0 : intervalSeconds, ease: 'linear' }}
              />
            ) : (
              <div className="flex aspect-square h-[min(60vh,28rem)] items-center justify-center rounded-[2rem] border border-white/15 bg-white/5 backdrop-blur-xl">
                {categoryIcon('size-28 text-white/70', 1.2)}
              </div>
            )}
          </motion.figure>
        </AnimatePresence>

        {/* Click zones for prev / next */}
        <button
          type="button"
          className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize focus:outline-none"
          aria-label={t('exhibition.previous')}
          onClick={() => go(-1)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize focus:outline-none"
          aria-label={t('exhibition.next')}
          onClick={() => go(1)}
        />
      </div>

      {/* Top bar: progress, counter, exit */}
      <div className="absolute inset-x-0 top-0 z-10 px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8">
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-white/15">
          {playing && count > 1 ? (
            <motion.div
              key={`progress-${index}`}
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: intervalSeconds, ease: 'linear' }}
            />
          ) : (
            <div className="h-full rounded-full bg-white/50" style={{ width: `${((index + 1) / count) * 100}%` }} />
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-md">
              {categoryIcon('size-4')}
            </span>
            <p className="truncate text-sm font-semibold tracking-[0.02em] text-white/80">
              {category?.name ?? t('exhibition.allCollections')}
            </p>
          </div>
          <div className={cn('flex shrink-0 items-center gap-3 transition-opacity duration-500', chromeHidden && 'pointer-events-none opacity-0')}>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums ring-1 ring-white/15 backdrop-blur-md" aria-live="polite">
              {t('exhibition.counter', { current: index + 1, total: count })}
            </span>
            <button type="button" className={cn(CONTROL_BUTTON, 'size-9')} onClick={onExit} aria-label={t('exhibition.exit')}>
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Caption */}
      <AnimatePresence initial={false}>
        {showCaption && (
          <motion.div
            key={`caption-${item.id}`}
            ref={captionRef}
            className={cn('absolute left-4 right-4 z-10 transition-[bottom] duration-300 sm:left-8 sm:right-auto sm:max-w-xl', showThumbs ? 'bottom-48' : 'bottom-28')}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : 0.15 }}
          >
            <div className="rounded-[1.75rem] border border-white/15 bg-black/35 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {year && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">{year}</span>
                )}
                {item.condition && (
                  <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold text-white/85 ring-1 ring-white/15">
                    {conditionLabel(t, item.condition)}
                  </span>
                )}
                {item.isFavorite && (
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-300/30">
                    {t('exhibition.favorite')}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl">{item.title}</h2>
              {highlights.filter((entry) => entry.value !== year).length > 0 && (
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  {highlights.filter((entry) => entry.value !== year).map((entry) => (
                    <div key={entry.key} className="flex min-w-0 items-baseline gap-1.5">
                      <dt className="text-xs font-medium text-white/55">{entry.label}</dt>
                      <dd className="truncate font-medium text-white/90">{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {item.description && (
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/75 sm:text-[15px]">{item.description}</p>
              )}
              {showValues && value > 0 && (
                <p className="mt-4 inline-flex items-baseline gap-2 rounded-2xl bg-white/10 px-3.5 py-2 ring-1 ring-white/15">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">{t('exhibition.value')}</span>
                  <span className="text-lg font-semibold tabular-nums">{formatCurrency(value, displayCurrency)}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thumbnails */}
      <AnimatePresence>
        {showThumbs && (
          <motion.div
            className="absolute inset-x-0 bottom-24 z-20 px-4 sm:px-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto rounded-2xl border border-white/15 bg-black/45 p-2 backdrop-blur-xl scrollbar-thin" role="listbox" aria-label={t('exhibition.thumbnails')}>
              {slides.map((entry, slideIndex) => (
                <button
                  key={entry.item.id}
                  type="button"
                  role="option"
                  aria-selected={slideIndex === index}
                  aria-label={entry.item.title}
                  onClick={() => setIndex(slideIndex)}
                  className={cn(
                    'relative size-14 shrink-0 overflow-hidden rounded-xl ring-2 transition-all',
                    slideIndex === index ? 'ring-indigo-400 shadow-[0_0_18px_rgba(129,140,248,0.6)]' : 'ring-transparent opacity-60 hover:opacity-100',
                  )}
                >
                  {entry.image ? (
                    <img src={entry.image} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-white/10 text-[10px] font-semibold">{slideIndex + 1}</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR code: scan to open the current piece */}
      {showQr && (
        <div
          className={cn(
            'absolute bottom-28 right-4 z-10 hidden flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/40 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[bottom] duration-300 sm:flex sm:right-8',
            showThumbs && 'bottom-48',
          )}
        >
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={getPublicItemUrl(item.id)} size={96} level="M" aria-label={t('exhibition.qrLabel', { title: item.title })} role="img" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">{t('exhibition.qrHint')}</p>
        </div>
      )}

      {/* Controls */}
      <div className={cn(
        'absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] transition-opacity duration-500',
        chromeHidden && 'pointer-events-none opacity-0',
      )}>
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/40 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <button type="button" className={CONTROL_BUTTON} onClick={() => go(-1)} aria-label={t('exhibition.previous')}>
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className={cn(CONTROL_BUTTON, 'size-12 bg-gradient-to-br from-indigo-500 to-blue-600 shadow-[0_10px_30px_rgba(79,70,229,0.55)] hover:from-indigo-400 hover:to-blue-500')}
            onClick={() => setPlaying((current) => !current)}
            aria-label={playing ? t('exhibition.pause') : t('exhibition.play')}
            aria-pressed={playing}
            disabled={count < 2}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
          </button>
          <button type="button" className={CONTROL_BUTTON} onClick={() => go(1)} aria-label={t('exhibition.next')}>
            <ChevronRight className="size-5" />
          </button>
          <span className="mx-1 h-6 w-px bg-white/15" aria-hidden="true" />
          <button
            type="button"
            className={cn(CONTROL_BUTTON, showCaption && 'bg-white/25')}
            onClick={() => setShowCaption((current) => !current)}
            aria-label={t('exhibition.toggleCaption')}
            aria-pressed={showCaption}
          >
            <Info className="size-4" />
          </button>
          <button
            type="button"
            className={cn(CONTROL_BUTTON, showThumbs && 'bg-white/25')}
            onClick={() => setShowThumbs((current) => !current)}
            aria-label={t('exhibition.toggleThumbnails')}
            aria-pressed={showThumbs}
          >
            <GalleryHorizontal className="size-4" />
          </button>
          <button
            type="button"
            className={cn(CONTROL_BUTTON, 'hidden sm:inline-flex')}
            onClick={() => { void toggleFullscreen(); }}
            aria-label={isFullscreen ? t('exhibition.exitFullscreen') : t('exhibition.enterFullscreen')}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
