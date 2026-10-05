import { createElement, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Hash,
  ImageIcon,
  MapPin,
  Package,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Star,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { PageTransition } from '@/components/shared/motion';
import { PageHeader, ConfirmDialog, EmptyState, LoadingSkeleton } from '@/components/shared';
import { DocumentsPanel } from '@/components/items/DocumentsPanel';
import { MaintenanceLog, NextServiceCard } from '@/components/items/MaintenanceEditor';
import { ValuationEntryDialog } from '@/components/items/ValuationEntryDialog';
import { getConditionBadgeStyle } from '@/components/items/conditionBadge';
import { daysUntil, getOpenLoan } from '@/components/items/itemSchedule';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { getLocale, useT } from '@/i18n';
import { getCategoryIcon } from '@/lib/icons';
import { cn, formatCurrency, formatDate, formatRelativeDate, formatPercent } from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { LendingRecord, ValueHistoryEntry } from '@/types';
import { conditionLabel } from '@/components/collections/conditionLabel';
import {
  buildItemChartData,
  getItemDetailStats,
  getSortedValueHistory,
  getVisibleCustomFields,
} from './itemDetail-helpers';

type ConditionBadgeStyle = ReturnType<typeof getConditionBadgeStyle>;

const EYEBROW = 'text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground';
const SECTION_LABEL = 'text-xs font-medium uppercase tracking-wider text-muted-foreground';

function CategoryIconDisplay({ iconName, className }: { iconName: string; className?: string }) {
  return createElement(getCategoryIcon(iconName), { className, 'aria-hidden': true });
}

/** Original icon-tile detail row (soft primary square + label + value). */
function DetailTile({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <div className="mt-0.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Label/value row used throughout the valuation card. */
function ValueRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 truncate text-right text-sm', className)}>{children}</span>
    </div>
  );
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  displayCurrency: string;
};

function ChartTooltip({ active, payload, label, displayCurrency }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label ? formatDate(label) : ''}</p>
      <p className="text-sm font-semibold text-foreground">{formatCurrency(payload[0].value ?? 0, displayCurrency)}</p>
    </div>
  );
}

function ImageGallery({
  images,
  title,
  condition,
  condBadge,
  FallbackIcon,
}: {
  images: string[];
  title: string;
  condition: string;
  condBadge: ConditionBadgeStyle;
  FallbackIcon: LucideIcon;
}) {
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const hasMultiple = images.length > 1;
  const safeIndex = Math.min(activeIndex, Math.max(images.length - 1, 0));

  const goPrev = () => setActiveIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const goNext = () => setActiveIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
        {hasImages ? (
          <>
            <img
              src={images[safeIndex]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
            />
            <img
              src={images[safeIndex]}
              alt={`${title} - ${safeIndex + 1}`}
              className="relative z-10 h-full w-full object-contain transition-opacity duration-300"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <FallbackIcon className="size-20 text-primary/20" aria-hidden="true" />
          </div>
        )}

        <div className="absolute right-3 top-3 z-20">
          <Badge variant={condBadge.variant} className={cn('px-3 py-1 text-sm', condBadge.className)}>
            {condition}
          </Badge>
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('itemDetail.gallery.previous')}
              className="absolute left-2 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t('itemDetail.gallery.next')}
              className="absolute right-2 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>

            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm">
              <ImageIcon className="size-3 text-white/70" aria-hidden="true" />
              <span className="text-xs font-medium tabular-nums text-white">
                {t('itemDetail.gallery.counter', { current: safeIndex + 1, total: images.length })}
              </span>
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="scrollbar-thin flex gap-2 overflow-x-auto p-3">
          {images.map((src, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-current={idx === safeIndex ? 'true' : undefined}
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                idx === safeIndex
                  ? 'border-primary shadow-md shadow-primary/20'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <img
                src={src}
                alt={t('itemDetail.gallery.thumbnail', { index: idx + 1 })}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function lendingConditionBadge(condition: LendingRecord['condition']): { variant: 'success' | 'default' | 'warning' | 'destructive' | 'secondary' } {
  switch (condition) {
    case 'same':
      return { variant: 'success' };
    case 'better':
      return { variant: 'default' };
    case 'worse':
      return { variant: 'warning' };
    case 'damaged':
      return { variant: 'destructive' };
    default:
      return { variant: 'secondary' };
  }
}

export default function ItemDetail() {
  const t = useT();
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const isRemoteDataLoading = useCollectionStore((s) => s.isRemoteDataLoading);
  const ownerUserId = useCollectionStore((s) => s.ownerUserId);
  const {
    getItemById,
    getCategoryById,
    getContributorById,
    updateItem,
    deleteItem,
    toggleFavorite,
    addValuationEntry,
    openItemDialog,
  } = useCollectionStore();

  const item = getItemById(itemId ?? '');
  const category = item ? getCategoryById(item.categoryId) : undefined;
  const contributor = item ? getContributorById(item.contributorId) : undefined;
  const shouldShowLoadingState = Boolean(ownerUserId) && isRemoteDataLoading && !item && !category;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [valuationDialogOpen, setValuationDialogOpen] = useState(false);
  const [notes, setNotes] = useState(item?.notes ?? '');

  const collectionsCrumb = { label: t('itemDetail.breadcrumb.collections'), href: '/collections' };

  if (shouldShowLoadingState) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader title={t('itemDetail.loadingTitle')} breadcrumbs={[collectionsCrumb]} />
        <LoadingSkeleton variant="detail" />
      </div>
    );
  }

  if (!item || !category) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader title={t('itemDetail.notFoundTitle')} breadcrumbs={[collectionsCrumb]} />
        <EmptyState
          icon={Package}
          title={t('itemDetail.notFound.title')}
          description={t('itemDetail.notFound.description')}
          action={{ label: t('itemDetail.notFound.action'), onClick: () => navigate('/collections') }}
        />
      </div>
    );
  }

  const condBadge = getConditionBadgeStyle(item.condition);
  const conditionText = conditionLabel(t, item.condition);
  const chartData = buildItemChartData(item, displayCurrency);
  const valueHistory = getSortedValueHistory(item);
  const {
    gainLoss,
    currentValueDisplay,
    currentValueCurrency,
    currentValueUSD,
    currentExchangeRate,
    purchaseValueDisplay,
  } = getItemDetailStats(item, displayCurrency);
  const visibleCustomFields = getVisibleCustomFields(category, item);
  const openLoan = getOpenLoan(item);
  const latestMaintenance = item.maintenanceLog
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))[0];
  const documentCount = item.documents?.length ?? 0;
  const latestValuationDate = valueHistory[0]?.date;
  const gainClass = gainLoss.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const ChangeIcon = gainLoss.isPositive ? ArrowUp : ArrowDown;
  const signedDiff = `${gainLoss.isPositive ? '+' : '−'}${formatCurrency(Math.abs(gainLoss.diff), displayCurrency)}`;
  const absPct = formatPercent(Math.abs(gainLoss.percentage));
  const signedPct = formatPercent(gainLoss.percentage, { signed: true });

  const projectionDisplay =
    item.valuationInfo.targetEstimatedValue != null
      ? currencyService.convert(item.valuationInfo.targetEstimatedValue, currentValueCurrency, displayCurrency)
      : null;
  const projectedGrowth =
    projectionDisplay != null && currentValueDisplay > 0 ? (projectionDisplay / currentValueDisplay - 1) * 100 : 0;

  const compactCurrency = new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: displayCurrency,
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  const handleDelete = () => {
    deleteItem(item.id);
    toast.success(t('itemDetail.toast.deleted'));
    navigate(`/collections/${category.slug}`);
  };

  const handleSaveNotes = () => {
    updateItem(item.id, { notes });
    toast.success(t('itemDetail.toast.notesSaved'));
  };

  const handleAddValuation = (entry: ValueHistoryEntry) => {
    addValuationEntry(item.id, entry);
    toast.success(t('itemDetail.valuation.toast.added'));
    setValuationDialogOpen(false);
  };

  const renderFieldValue = (fieldType: string, value: unknown) => {
    if (fieldType === 'boolean') {
      return value ? (
        <span className="inline-flex items-center gap-1.5">
          <Check className="size-4 text-green-500" aria-hidden="true" />
          {t('common.yes')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <X className="size-4 text-red-400" aria-hidden="true" />
          {t('common.no')}
        </span>
      );
    }
    if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
    if (fieldType === 'date' && typeof value === 'string') return formatDate(value);
    if (fieldType === 'currency' && typeof value === 'number') return formatCurrency(value, displayCurrency);
    return String(value);
  };

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={item.title}
          breadcrumbs={[
            collectionsCrumb,
            { label: category.name, href: `/collections/${category.slug}` },
            { label: item.title },
          ]}
        >
          <Button variant="outline" size="sm" onClick={() => navigate(`/collections/${category.slug}`)}>
            <ArrowLeft className="size-3.5" />
            {t('common.back')}
          </Button>
          <Button
            variant={item.isFavorite ? 'default' : 'outline'}
            size="sm"
            aria-pressed={item.isFavorite}
            onClick={() => {
              toggleFavorite(item.id);
              toast.success(item.isFavorite ? t('itemDetail.toast.unfavorited') : t('itemDetail.toast.favorited'));
            }}
            className={item.isFavorite ? 'bg-amber-500 text-white hover:bg-amber-600' : ''}
          >
            <Star className={cn('size-3.5', item.isFavorite && 'fill-white')} />
            {item.isFavorite ? t('itemDetail.starred') : t('itemDetail.star')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openItemDialog(item.categoryId, item)}>
            <Pencil className="size-3.5" />
            {t('common.edit')}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="size-3.5" />
            {t('common.delete')}
          </Button>
        </PageHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border/70">
            <CardContent className="space-y-2 p-4">
              <p className={EYEBROW}>{t('itemDetail.summary.currentValue')}</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {formatCurrency(currentValueDisplay, displayCurrency)}
              </p>
              <p className="text-sm text-muted-foreground">
                {latestValuationDate
                  ? t('itemDetail.summary.asOf', { date: formatDate(latestValuationDate) })
                  : t('itemDetail.summary.noValuation')}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-2 p-4">
              <p className={EYEBROW}>{t('itemDetail.summary.purchasePrice')}</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {formatCurrency(purchaseValueDisplay, displayCurrency)}
              </p>
              <p className="text-sm text-muted-foreground">{formatDate(item.purchaseInfo.purchasedAt)}</p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-2 p-4">
              <p className={EYEBROW}>{t('itemDetail.summary.change')}</p>
              <div className="flex items-center gap-2">
                <Badge variant={gainLoss.isPositive ? 'success' : 'destructive'} className="gap-1">
                  <ChangeIcon className="size-3" aria-hidden="true" />
                  {absPct}
                </Badge>
                <span className={cn('text-lg font-semibold tabular-nums', gainClass)}>{signedDiff}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('itemDetail.summary.sincePurchase', { pct: signedPct })}</p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-2 p-4">
              <p className={EYEBROW}>{t('itemDetail.summary.status')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={condBadge.variant} className={condBadge.className}>
                  {conditionText}
                </Badge>
                {item.isFavorite && (
                  <Badge className="border-transparent bg-amber-500 text-white">
                    <Star className="mr-1 size-3 fill-white" aria-hidden="true" />
                    {t('itemDetail.starred')}
                  </Badge>
                )}
                {openLoan && <Badge variant="warning">{t('itemDetail.onLoan')}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {latestMaintenance
                  ? t('itemDetail.summary.lastMaintenance', { when: formatRelativeDate(latestMaintenance.date) })
                  : t('itemDetail.summary.noMaintenance')}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <ImageGallery
              images={item.images}
              title={item.title}
              condition={conditionText}
              condBadge={condBadge}
              FallbackIcon={getCategoryIcon(category.icon)}
            />

            <Tabs defaultValue="details">
              <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl p-1">
                <TabsTrigger value="details">{t('itemDetail.tab.details')}</TabsTrigger>
                <TabsTrigger value="custom-fields">{t('itemDetail.tab.customFields')}</TabsTrigger>
                <TabsTrigger value="maintenance">
                  <Wrench className="mr-1.5 size-3.5" aria-hidden="true" />
                  {t('itemDetail.tab.maintenance')}
                  {item.maintenanceLog.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] tabular-nums">
                      {item.maintenanceLog.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="lending">
                  <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                  {t('itemDetail.tab.lending')}
                  {openLoan && (
                    <Badge variant="warning" className="ml-1.5 h-5 px-1.5 text-[10px]">
                      {t('itemDetail.tab.lendingActive')}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <Paperclip className="mr-1.5 size-3.5" aria-hidden="true" />
                  {t('itemDetail.tab.documents')}
                  {documentCount > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px] tabular-nums">
                      {documentCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notes">{t('itemDetail.tab.notes')}</TabsTrigger>
              </TabsList>

              {/* Details */}
              <TabsContent value="details">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>{t('itemDetail.details.overview')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="rounded-2xl border border-border/65 bg-background/45 p-4">
                      <p className={EYEBROW}>{t('itemDetail.panel.description')}</p>
                      <p className="mt-3 leading-relaxed text-muted-foreground">
                        {item.description || t('itemDetail.details.noDescription')}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/65 bg-background/45 p-4">
                        <p className={EYEBROW}>{t('itemDetail.details.purchaseCurrency')}</p>
                        <p className="mt-2 text-lg font-semibold">{item.purchaseInfo.purchaseCurrency}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('itemDetail.details.boughtFor', {
                            price: formatCurrency(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency),
                          })}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/65 bg-background/45 p-4">
                        <p className={EYEBROW}>{t('itemDetail.details.currentCurrency')}</p>
                        <p className="mt-2 text-lg font-semibold">{currentValueCurrency}</p>
                        <p className="mt-1 font-mono text-sm text-muted-foreground">
                          1 {currentValueCurrency} = {(Number(currentExchangeRate) || 0).toFixed(4)} USD
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/65 bg-background/45 p-4">
                        <p className={EYEBROW}>{t('itemDetail.details.activity')}</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums">
                          {item.maintenanceLog.length + item.lendingHistory.length + documentCount}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{t('itemDetail.details.activityHint')}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DetailTile icon={Tag} label={t('itemDetail.field.condition')}>
                        <Badge variant={condBadge.variant} className={cn('mt-0.5', condBadge.className)}>
                          {conditionText}
                        </Badge>
                      </DetailTile>

                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <CategoryIconDisplay iconName={category.icon} className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{t('itemDetail.field.category')}</p>
                          <Link
                            to={`/collections/${category.slug}`}
                            className="mt-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {category.name}
                          </Link>
                        </div>
                      </div>

                      {item.location && (
                        <DetailTile icon={MapPin} label={t('itemDetail.field.location')}>
                          {item.location}
                        </DetailTile>
                      )}

                      {(item.quantity ?? 1) > 1 && (
                        <DetailTile icon={Hash} label={t('itemDetail.field.quantity')}>
                          <span className="tabular-nums">{item.quantity}</span>
                        </DetailTile>
                      )}

                      <DetailTile icon={Tag} label={t('itemDetail.field.tags')}>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {item.tags.length > 0 ? (
                            item.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span>{t('itemDetail.details.noTags')}</span>
                          )}
                        </div>
                      </DetailTile>

                      {contributor && (
                        <DetailTile icon={User} label={t('itemDetail.field.contributor')}>
                          <span className="mt-0.5 flex items-center gap-2">
                            <Avatar className="size-5">
                              <AvatarImage src={contributor.avatar} alt="" />
                              <AvatarFallback className="text-[10px]">
                                {contributor.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {contributor.name}
                          </span>
                        </DetailTile>
                      )}

                      <DetailTile icon={Calendar} label={t('itemDetail.field.added')}>
                        {formatDate(item.createdAt)}
                      </DetailTile>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Custom fields */}
              <TabsContent value="custom-fields">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle>{t('itemDetail.tab.customFields')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {visibleCustomFields.length > 0 ? (
                      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {visibleCustomFields.map((field) => (
                          <div key={field.id} className="rounded-lg border bg-muted/30 p-3">
                            <dt className={SECTION_LABEL}>{field.label}</dt>
                            <dd className="mt-1 text-sm font-medium">
                              {renderFieldValue(field.type, item.customFields[field.key])}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('itemDetail.customFields.empty')}</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Maintenance */}
              <TabsContent value="maintenance">
                <MaintenanceLog item={item} displayCurrency={displayCurrency} />
              </TabsContent>

              {/* Lending */}
              <TabsContent value="lending">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="size-4" aria-hidden="true" />
                      {t('itemDetail.lending.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {item.lendingHistory.length > 0 ? (
                      <ul className="space-y-4">
                        {[...item.lendingHistory]
                          .sort((left, right) => right.lentDate.localeCompare(left.lentDate))
                          .map((record) => {
                            const isActive = !record.actualReturnDate;
                            const isOverdue = isActive && daysUntil(record.expectedReturnDate) < 0;
                            const returnBadge = lendingConditionBadge(record.condition);
                            return (
                              <li
                                key={record.id}
                                className={cn(
                                  'rounded-lg border p-4',
                                  isActive && isOverdue
                                    ? 'border-red-500/30 bg-red-500/5'
                                    : isActive
                                      ? 'border-amber-500/30 bg-amber-500/5'
                                      : 'bg-muted/30',
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <User className="size-4 text-muted-foreground" aria-hidden="true" />
                                  <span className="font-medium">{record.borrowerName}</span>
                                  {isActive ? (
                                    <Badge variant={isOverdue ? 'destructive' : 'warning'} className="text-[10px]">
                                      {isOverdue ? t('itemDetail.lending.overdue') : t('itemDetail.onLoan')}
                                    </Badge>
                                  ) : (
                                    <Badge variant={returnBadge.variant} className="text-[10px]">
                                      {t(`lending.condition.${record.condition}`)}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs tabular-nums text-muted-foreground">
                                  <span>{t('itemDetail.lending.lentOn', { date: formatDate(record.lentDate) })}</span>
                                  <span className={cn(isOverdue && 'font-medium text-red-600 dark:text-red-400')}>
                                    {t('itemDetail.lending.dueOn', { date: formatDate(record.expectedReturnDate) })}
                                  </span>
                                  {record.actualReturnDate && (
                                    <span>
                                      {t('itemDetail.lending.returnedOn', { date: formatDate(record.actualReturnDate) })}
                                    </span>
                                  )}
                                </div>
                                {record.notes && <p className="mt-1 text-sm text-muted-foreground">{record.notes}</p>}
                              </li>
                            );
                          })}
                      </ul>
                    ) : (
                      <div className="py-8 text-center">
                        <Send className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
                        <p className="mt-2 text-sm text-muted-foreground">{t('itemDetail.lending.emptyTitle')}</p>
                        <p className="text-xs text-muted-foreground">{t('itemDetail.lending.emptyDescription')}</p>
                        <button
                          type="button"
                          onClick={() => navigate('/lending')}
                          className="mt-2 text-xs font-medium text-primary hover:underline"
                        >
                          {t('itemDetail.lending.openTracker')}
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documents */}
              <TabsContent value="documents">
                <DocumentsPanel item={item} />
              </TabsContent>

              {/* Notes */}
              <TabsContent value="notes">
                <Card className="border-border/70">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="size-4" aria-hidden="true" />
                        {t('itemDetail.notes.title')}
                      </CardTitle>
                      <Button size="sm" onClick={handleSaveNotes} disabled={notes === item.notes}>
                        <Save className="size-3.5" />
                        {t('itemDetail.notes.save')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('itemDetail.notes.placeholder')}
                      aria-label={t('itemDetail.notes.title')}
                      className="min-h-[200px] resize-y font-mono text-sm leading-relaxed"
                    />
                    {notes !== item.notes && <p className="mt-2 text-xs text-amber-500">{t('itemDetail.notes.unsaved')}</p>}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Value history */}
            {(chartData.length > 1 || valueHistory.length > 0) && (
              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-4" aria-hidden="true" />
                    {t('itemDetail.history.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {chartData.length > 1 && (
                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value: string) => formatDate(value)}
                            tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={24}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value: number) => compactCurrency.format(value)}
                            width={56}
                          />
                          <Tooltip content={<ChartTooltip displayCurrency={displayCurrency} />} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="var(--color-primary)"
                            strokeWidth={2}
                            fill="url(#valueGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {valueHistory.length > 0 && (
                    <div className="overflow-hidden rounded-xl border border-border/65">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left">
                            <th scope="col" className={cn('px-3 py-2', SECTION_LABEL)}>{t('itemDetail.history.date')}</th>
                            <th scope="col" className={cn('px-3 py-2', SECTION_LABEL)}>{t('itemDetail.history.source')}</th>
                            <th scope="col" className={cn('px-3 py-2 text-right', SECTION_LABEL)}>
                              {t('itemDetail.history.value')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {valueHistory.map((entry, index) => (
                            <tr
                              key={`${entry.date}-${index}`}
                              className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                            >
                              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                                {formatDate(entry.date)}
                              </td>
                              <td className="px-3 py-2">
                                {entry.source || entry.note ? (
                                  <>
                                    {entry.source && <span className="font-medium">{entry.source}</span>}
                                    {entry.note && (
                                      <span className="block text-xs text-muted-foreground">{entry.note}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">
                                {formatCurrency(entry.value, entry.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <NextServiceCard item={item} />

            {/* Valuation card */}
            <div className="relative rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-px">
              <Card className="overflow-hidden border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="size-4" aria-hidden="true" />
                      {t('itemDetail.valuation.title')}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => setValuationDialogOpen(true)}>
                      <Plus className="size-3.5" />
                      {t('itemDetail.valuation.add')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2.5">
                    <p className={SECTION_LABEL}>{t('itemDetail.panel.purchaseInfo')}</p>
                    <div className="space-y-2">
                      <ValueRow label={t('itemDetail.valuation.purchasePrice')} className="font-semibold tabular-nums">
                        {formatCurrency(purchaseValueDisplay, displayCurrency)}
                      </ValueRow>
                      <ValueRow label={t('itemDetail.valuation.purchaseDate')}>
                        {formatDate(item.purchaseInfo.purchasedAt)}
                      </ValueRow>
                      {item.purchaseInfo.purchaseLocation && (
                        <ValueRow label={t('itemDetail.valuation.purchasePlace')}>
                          {item.purchaseInfo.purchaseLocation}
                        </ValueRow>
                      )}
                      <ValueRow label={t('itemDetail.valuation.purchaseRate')} className="font-mono text-xs text-muted-foreground">
                        1 {item.purchaseInfo.purchaseCurrency} = {(Number(item.purchaseInfo.exchangeRateAtPurchase) || 0).toFixed(4)} USD
                      </ValueRow>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2.5">
                    <p className={SECTION_LABEL}>{t('itemDetail.valuation.current')}</p>
                    <div className="text-center">
                      <p className="text-3xl font-bold tracking-tight tabular-nums">
                        {formatCurrency(currentValueDisplay, displayCurrency)}
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-1.5">
                        <Badge variant={gainLoss.isPositive ? 'success' : 'destructive'} className="gap-0.5">
                          <ChangeIcon className="size-3" aria-hidden="true" />
                          {absPct}
                        </Badge>
                        <span className={cn('text-sm font-medium tabular-nums', gainClass)}>{signedDiff}</span>
                      </div>
                    </div>
                    <ValueRow label={t('itemDetail.valuation.currentRate')} className="font-mono text-xs text-muted-foreground">
                      1 {currentValueCurrency} = {(Number(currentExchangeRate) || 0).toFixed(4)} USD
                    </ValueRow>
                  </div>

                  {item.valuationInfo.targetYearProjection != null && projectionDisplay != null && (
                    <>
                      <Separator />
                      <div className="space-y-2.5">
                        <p className={SECTION_LABEL}>
                          {t('itemDetail.valuation.projection', { year: item.valuationInfo.targetYearProjection })}
                        </p>
                        <ValueRow label={t('itemDetail.valuation.targetYear')} className="font-medium tabular-nums">
                          {item.valuationInfo.targetYearProjection}
                        </ValueRow>
                        <ValueRow label={t('itemDetail.valuation.projectedValue')} className="font-semibold tabular-nums text-primary">
                          {formatCurrency(projectionDisplay, displayCurrency)}
                        </ValueRow>
                        <div
                          className={cn(
                            'flex items-center justify-center gap-1 text-xs tabular-nums',
                            projectedGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                          )}
                        >
                          {projectedGrowth >= 0 ? (
                            <TrendingUp className="size-3" aria-hidden="true" />
                          ) : (
                            <TrendingDown className="size-3" aria-hidden="true" />
                          )}
                          <span>
                            {t('itemDetail.valuation.projectedGrowth', {
                              pct: formatPercent(projectedGrowth, { digits: 0, signed: true }),
                            })}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{t('itemDetail.valuation.usdEquivalent')}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatCurrency(currentValueUSD, 'USD')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contributor */}
            {contributor && (
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('itemDetail.field.contributor')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={contributor.avatar} alt="" />
                      <AvatarFallback>{contributor.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{contributor.name}</p>
                      <Badge variant="secondary" className="mt-0.5 text-[10px]">
                        {t(`itemDetail.role.${contributor.role}`)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="size-4" aria-hidden="true" />
                  {t('itemDetail.record.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <ValueRow label={t('itemDetail.record.created')}>
                  <span title={formatDate(item.createdAt)}>{formatRelativeDate(item.createdAt)}</span>
                </ValueRow>
                <ValueRow label={t('itemDetail.record.updated')}>
                  <span title={formatDate(item.updatedAt)}>{formatRelativeDate(item.updatedAt)}</span>
                </ValueRow>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{t('itemDetail.record.id')}</span>
                  <code className="max-w-[140px] truncate text-xs text-muted-foreground">{item.id}</code>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDelete}
          title={t('itemDetail.delete.title')}
          description={t('itemDetail.delete.description', { title: item.title })}
          confirmLabel={t('common.delete')}
          destructive
        />

        <ValuationEntryDialog
          open={valuationDialogOpen}
          onOpenChange={setValuationDialogOpen}
          defaultCurrency={currentValueCurrency}
          onSubmit={handleAddValuation}
        />
      </div>
    </PageTransition>
  );
}
