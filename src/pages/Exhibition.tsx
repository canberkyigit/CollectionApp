import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Heart,
  Image as ImageIcon,
  Keyboard,
  Layers,
  Play,
  Presentation,
  Sparkles,
} from 'lucide-react';

import { EmptyState, PageHeader } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/i18n';
import {
  buildExhibitionSlides,
  countSlides,
  isSameSource,
  type ExhibitionSource,
} from '@/lib/exhibition';
import { getCategoryIcon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';

// The stage pulls in heavier motion code; load it when the show starts.
const ExhibitionStage = lazy(() => import('@/components/exhibition/ExhibitionStage')
  .then((module) => ({ default: module.ExhibitionStage })));

const INTERVALS = [5, 8, 12, 20] as const;
const PREFS_KEY = 'curio-exhibition-prefs';

interface ExhibitionPrefs {
  intervalSeconds: number;
  autoplay: boolean;
  showValues: boolean;
  shuffle: boolean;
  onlyWithPhotos: boolean;
}

const DEFAULT_PREFS: ExhibitionPrefs = {
  intervalSeconds: 8,
  autoplay: true,
  showValues: false,
  shuffle: false,
  onlyWithPhotos: true,
};

function loadPrefs(): ExhibitionPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: ExhibitionPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // preferences just won't be remembered
  }
}

export default function Exhibition() {
  const t = useT();
  const navigate = useNavigate();
  const items = useCollectionStore((state) => state.items);
  const categories = useCollectionStore((state) => state.categories);
  const displayCurrency = useCollectionStore((state) => state.displayCurrency);

  const [source, setSource] = useState<ExhibitionSource>('all');
  const [prefs, setPrefs] = useState<ExhibitionPrefs>(loadPrefs);
  const [seed, setSeed] = useState(() => Date.now());
  const [running, setRunning] = useState(false);

  const updatePrefs = (patch: Partial<ExhibitionPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  };

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categories],
  );

  const slides = useMemo(() => buildExhibitionSlides(items, categories, {
    source,
    onlyWithPhotos: prefs.onlyWithPhotos,
    shuffle: prefs.shuffle,
    seed,
    formatBoolean: (value) => (value ? t('common.yes') : t('common.no')),
  }), [items, categories, source, prefs.onlyWithPhotos, prefs.shuffle, seed, t]);

  const sources = useMemo(() => {
    const coverFor = (filter: (categoryId: string, isFavorite: boolean) => boolean) => items
      .filter((item) => !item.isArchived && filter(item.categoryId, item.isFavorite))
      .map((item) => item.images?.find(Boolean))
      .filter((image): image is string => Boolean(image))
      .slice(0, 4);
    return [
      {
        key: 'all',
        source: 'all' as ExhibitionSource,
        label: t('exhibition.allCollections'),
        icon: Layers,
        covers: coverFor(() => true),
        count: countSlides(items, 'all', prefs.onlyWithPhotos),
      },
      {
        key: 'favorites',
        source: 'favorites' as ExhibitionSource,
        label: t('exhibition.favorites'),
        icon: Heart,
        covers: coverFor((_, isFavorite) => isFavorite),
        count: countSlides(items, 'favorites', prefs.onlyWithPhotos),
      },
      ...sortedCategories.map((category) => ({
        key: category.id,
        source: { categoryId: category.id } as ExhibitionSource,
        label: category.name,
        icon: getCategoryIcon(category.icon),
        covers: coverFor((categoryId) => categoryId === category.id),
        count: countSlides(items, { categoryId: category.id }, prefs.onlyWithPhotos),
      })),
    ];
  }, [items, sortedCategories, prefs.onlyWithPhotos, t]);

  const selectedSource = sources.find((entry) => isSameSource(entry.source, source)) ?? sources[0];
  const heroCovers = slides.map((slide) => slide.image).filter((image): image is string => Boolean(image)).slice(0, 4);
  const durationMinutes = Math.max(1, Math.round((slides.length * prefs.intervalSeconds) / 60));

  const start = () => {
    if (prefs.shuffle) setSeed(Date.now());
    setRunning(true);
  };

  if (items.filter((item) => !item.isArchived).length === 0) {
    return (
      <PageTransition>
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          <PageHeader title={t('exhibition.title')} description={t('exhibition.description')} />
          <EmptyState
            icon={Presentation}
            eyebrow={t('exhibition.eyebrow')}
            title={t('exhibition.empty.title')}
            description={t('exhibition.empty.description')}
            action={{ label: t('exhibition.empty.action'), onClick: () => navigate('/collections') }}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader title={t('exhibition.title')} description={t('exhibition.description')} />

        {/* Hero */}
        <Card className="relative overflow-hidden border-white/60 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(244,247,255,0.92))] shadow-[0_24px_60px_rgba(79,70,229,0.12)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.2),transparent_40%),linear-gradient(135deg,rgba(24,24,37,0.96),rgba(17,17,27,0.94))]">
          <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
            <div className="space-y-5">
              <Badge variant="secondary" className="gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                {t('exhibition.eyebrow')}
              </Badge>
              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{selectedSource.label}</h2>
                <p className="max-w-xl text-[15px] leading-7 text-muted-foreground">{t('exhibition.heroDescription')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 font-medium backdrop-blur-sm">
                  <ImageIcon className="size-4 text-primary" aria-hidden="true" />
                  {t('exhibition.slideCount', { count: slides.length })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1.5 font-medium backdrop-blur-sm">
                  <Clock className="size-4 text-primary" aria-hidden="true" />
                  {t('exhibition.duration', { count: durationMinutes })}
                </span>
              </div>
              <Button
                size="lg"
                className="h-14 gap-2 rounded-[1.2rem] bg-[linear-gradient(135deg,oklch(0.52_0.20_265),oklch(0.58_0.16_252))] px-7 text-base font-semibold shadow-[0_18px_36px_rgba(79,70,229,0.32)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(79,70,229,0.4)]"
                onClick={start}
                disabled={slides.length === 0}
              >
                <Play className="size-5" aria-hidden="true" />
                {t('exhibition.start')}
              </Button>
              {slides.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('exhibition.noSlides')}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3" aria-hidden="true">
              {(heroCovers.length ? heroCovers : [null, null, null, null]).slice(0, 4).map((image, index) => (
                <div
                  key={`${image ?? 'empty'}-${index}`}
                  className={cn(
                    'relative aspect-[4/3] overflow-hidden rounded-[1.4rem] border border-white/60 bg-muted/40 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:border-white/10',
                    index % 2 === 1 && 'translate-y-4',
                  )}
                >
                  {image ? (
                    <img src={image} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Presentation className="size-8 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Source picker */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <Layers className="size-5 text-primary" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle>{t('exhibition.sourceTitle')}</CardTitle>
                  <CardDescription>{t('exhibition.sourceDescription')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t('exhibition.sourceTitle')}>
                {sources.map((entry) => {
                  const active = isSameSource(entry.source, source);
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={entry.count === 0}
                      onClick={() => setSource(entry.source)}
                      className={cn(
                        'group relative overflow-hidden rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-primary/50 shadow-[0_14px_30px_rgba(79,70,229,0.18)] ring-2 ring-primary/40'
                          : 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]',
                        entry.count === 0 && 'cursor-not-allowed opacity-50 hover:translate-y-0 hover:shadow-none',
                      )}
                    >
                      <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/15 to-sky-100/40 dark:to-sky-900/20">
                        {entry.covers.length > 0 ? (
                          <div className="grid size-full grid-cols-2 gap-px">
                            {entry.covers.slice(0, entry.covers.length >= 2 ? 2 : 1).map((cover) => (
                              <img key={cover.slice(-40)} src={cover} alt="" className={cn('size-full object-cover', entry.covers.length === 1 && 'col-span-2')} />
                            ))}
                          </div>
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <Icon className="size-7 text-primary/60" aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                          <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span className="truncate">{entry.label}</span>
                        </span>
                        <Badge variant={active ? 'default' : 'secondary'} className="shrink-0 rounded-full px-2 text-[10px] tabular-nums">
                          {entry.count}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <Presentation className="size-5 text-primary" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle>{t('exhibition.optionsTitle')}</CardTitle>
                    <CardDescription>{t('exhibition.optionsDescription')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="exhibition-interval" className="text-sm font-medium">{t('exhibition.interval')}</Label>
                  <Select
                    value={String(prefs.intervalSeconds)}
                    onValueChange={(value) => updatePrefs({ intervalSeconds: Number(value) })}
                  >
                    <SelectTrigger id="exhibition-interval" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVALS.map((seconds) => (
                        <SelectItem key={seconds} value={String(seconds)}>
                          {t('exhibition.seconds', { count: seconds })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {([
                  ['autoplay', 'exhibition.autoplay', 'exhibition.autoplayHint'],
                  ['showValues', 'exhibition.showValues', 'exhibition.showValuesHint'],
                  ['shuffle', 'exhibition.shuffle', 'exhibition.shuffleHint'],
                  ['onlyWithPhotos', 'exhibition.onlyWithPhotos', 'exhibition.onlyWithPhotosHint'],
                ] as const).map(([key, labelKey, hintKey]) => (
                  <div key={key} className="flex items-start justify-between gap-4 border-t pt-4">
                    <div className="min-w-0">
                      <Label htmlFor={`exhibition-${key}`} className="text-sm font-medium">{t(labelKey)}</Label>
                      <p id={`exhibition-${key}-hint`} className="mt-0.5 text-xs text-muted-foreground">{t(hintKey)}</p>
                    </div>
                    <Switch
                      id={`exhibition-${key}`}
                      aria-describedby={`exhibition-${key}-hint`}
                      checked={prefs[key]}
                      onCheckedChange={(checked) => updatePrefs({ [key]: checked })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Keyboard className="size-4 text-primary" aria-hidden="true" />
                  <CardTitle className="text-sm">{t('exhibition.shortcutsTitle')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                  {([
                    ['← →', 'exhibition.shortcut.navigate'],
                    [t('exhibition.key.space'), 'exhibition.shortcut.play'],
                    ['I', 'exhibition.shortcut.caption'],
                    ['T', 'exhibition.shortcut.thumbnails'],
                    ['F', 'exhibition.shortcut.fullscreen'],
                    ['Esc', 'exhibition.shortcut.exit'],
                  ] as const).map(([keys, labelKey]) => (
                    <div key={labelKey} className="contents">
                      <dt>
                        <kbd className="inline-flex min-w-8 justify-center rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold shadow-sm">{keys}</kbd>
                      </dt>
                      <dd className="text-muted-foreground">{t(labelKey)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {running && slides.length > 0 && (
        <Suspense fallback={<div className="fixed inset-0 z-[90] bg-black" />}>
          <ExhibitionStage
            slides={slides}
            intervalSeconds={prefs.intervalSeconds}
            autoplay={prefs.autoplay}
            showValues={prefs.showValues}
            displayCurrency={displayCurrency}
            onExit={() => setRunning(false)}
          />
        </Suspense>
      )}
    </PageTransition>
  );
}
