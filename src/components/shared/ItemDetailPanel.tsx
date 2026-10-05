import { useState, useCallback, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Pencil,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Check,
  X,
  BookOpen,
  Clock,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  QrCode,
  Download,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DocumentsPanel } from '@/components/items/DocumentsPanel';
import { useT } from '@/i18n';
import { isBookCategory } from '@/lib/categoryKind';
import { ITEM_FORM_CURRENCIES } from '@/lib/itemForm';
import { cn, formatCurrency, formatDate, formatRelativeDate, formatPercent } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import { ConfirmDialog } from '@/components/shared';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getItemNotes, getValuationSummary } from '@/components/shared/itemDetailPanelHelpers';
import type { Category, CollectionItem } from '@/types';
import { getConditionBadgeStyle } from '@/components/items/conditionBadge';
import { conditionLabel } from '@/components/collections/conditionLabel';
import { getPublicItemUrl } from '@/lib/publicUrl';

interface Props {
  itemId: string | null;
  onClose: () => void;
}

export function ItemDetailPanel({ itemId, onClose }: Props) {
  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const {
    getItemById,
    getCategoryById,
    toggleFavorite,
    toggleRead,
    deleteItem,
    updateItem,
    openItemDialog,
  } = useCollectionStore();

  const item = itemId ? getItemById(itemId) : undefined;
  const category = item ? getCategoryById(item.categoryId) : undefined;

  if (!item || !category) return null;

  return (
    <ItemDetailPanelContent
      key={item.id}
      item={item}
      category={category}
      displayCurrency={displayCurrency}
      onClose={onClose}
      toggleFavorite={toggleFavorite}
      toggleRead={toggleRead}
      deleteItem={deleteItem}
      updateItem={updateItem}
      openItemDialog={openItemDialog}
    />
  );
}

interface ItemDetailPanelContentProps {
  item: CollectionItem;
  category: Category;
  displayCurrency: string;
  onClose: () => void;
  toggleFavorite: (id: string) => void;
  toggleRead: (id: string) => void;
  deleteItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<CollectionItem>) => void;
  openItemDialog: (categoryId: string, item?: CollectionItem) => void;
}

/** Small uppercase label/value cell (original panel style). */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ItemDetailPanelContent({
  item,
  category,
  displayCurrency,
  onClose,
  toggleFavorite,
  toggleRead,
  deleteItem,
  updateItem,
  openItemDialog,
}: ItemDetailPanelContentProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [width, setWidth] = useState(560);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [notesValue, setNotesValue] = useState(() => getItemNotes(item));
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const currencyOptions = ITEM_FORM_CURRENCIES as readonly string[];
  const [valCurrency, setValCurrency] = useState(
    currencyOptions.includes(displayCurrency) ? displayCurrency : 'USD',
  );
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { currentValuation, purchaseDateValuation, gainLoss } = getValuationSummary(item, valCurrency);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      e.preventDefault();

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const diff = startX.current - ev.clientX;
        setWidth(Math.min(900, Math.max(360, startWidth.current + diff)));
      };
      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [width],
  );

  const handleDelete = () => {
    deleteItem(item.id);
    toast.success(t('itemDetail.panel.toast.archived'));
    onClose();
  };

  function handleSaveNotes() {
    updateItem(item.id, {
      notes: notesValue,
      customFields: { ...item.customFields, notes: notesValue },
    });
    setIsEditingNotes(false);
    toast.success(t('itemDetail.panel.toast.notesSaved'));
  }

  const condBadge = getConditionBadgeStyle(item.condition);
  const isBook = isBookCategory(category);
  const qty = (item.customFields?.quantity as number) || item.quantity || 1;
  const edition = item.customFields?.edition;
  const publisher = item.customFields?.publisher as string;
  const currEquivs = item.purchaseInfo.currencyEquivalents || [];
  const visibleFields = category.fields.filter((f) => {
    if (f.key === 'notes' || f.type === 'rich-notes' || f.key === 'title' || f.key === 'condition' || f.key === 'quantity') return false;
    if (f.type === 'boolean') return true;
    const v = item.customFields[f.key];
    return v != null && v !== '';
  });
  const hasDocuments = (item.documents?.length ?? 0) > 0;

  return (
    <>
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { x: isMobile ? '100%' : 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={
          reduceMotion
            ? { duration: 0.1 }
            : isMobile
              ? { type: 'spring', damping: 28, stiffness: 300 }
              : { duration: 0.25, ease: 'easeOut' }
        }
        className={cn(
          'relative flex h-full shrink-0 flex-col border-l bg-background',
          isMobile && 'fixed inset-0 z-50 w-full border-l-0',
        )}
        style={isMobile ? undefined : { width }}
      >
        {/* Resize handle (desktop only) */}
        {!isMobile && (
          <div
            onMouseDown={handleMouseDown}
            aria-hidden="true"
            className="absolute -left-1 bottom-0 top-0 z-10 flex w-2.5 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/10 active:bg-primary/20"
          >
            <GripVertical className="size-3.5 text-muted-foreground/40" />
          </div>
        )}

        {/* Header bar */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-2.5">
          <h3 className="truncate pr-2 text-sm font-semibold text-muted-foreground">{t('itemDetail.panel.title')}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onClose}
            aria-label={t('itemDetail.panel.close')}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1">
          <div className="space-y-5 p-4">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-lg font-bold leading-tight tracking-tight">{item.title}</h2>
              {item.customFields?.author != null && item.customFields.author !== '' && (
                <p className="text-sm text-muted-foreground">{String(item.customFields.author)}</p>
              )}
              {publisher && <p className="text-xs text-muted-foreground">{publisher}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={condBadge.variant} className={cn('text-[10px]', condBadge.className)}>
                  {conditionLabel(t, item.condition)}
                </Badge>
                {item.isRead && (
                  <Badge variant="success" className="gap-0.5 text-[10px]">
                    <Check className="size-2.5" aria-hidden="true" /> {t('itemDetail.panel.read')}
                  </Badge>
                )}
                {edition != null && edition !== '' && (
                  <Badge variant="outline" className="text-[10px]">
                    {t('itemDetail.panel.edition', { edition: String(edition) })}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {t('itemDetail.panel.copies', { count: qty })}
                </Badge>
                {item.isFavorite && (
                  <Badge className="gap-0.5 border-transparent bg-amber-500 text-[10px] text-white">
                    <Star className="size-2.5 fill-white" aria-hidden="true" /> {t('itemDetail.starred')}
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-1.5">
              {isBook && (
                <Button
                  variant={item.isRead ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={Boolean(item.isRead)}
                  className={cn('h-7 gap-1 text-xs', item.isRead && 'bg-green-600 text-white hover:bg-green-700')}
                  onClick={() => {
                    toggleRead(item.id);
                    toast.success(item.isRead ? t('itemDetail.panel.toast.unread') : t('itemDetail.panel.toast.read'));
                  }}
                >
                  {item.isRead ? <Check className="size-3" /> : <BookOpen className="size-3" />}
                  {item.isRead ? t('itemDetail.panel.read') : t('itemDetail.panel.markRead')}
                </Button>
              )}
              <Button
                variant={item.isFavorite ? 'default' : 'outline'}
                size="sm"
                aria-pressed={item.isFavorite}
                className={cn('h-7 gap-1 text-xs', item.isFavorite && 'bg-amber-500 text-white hover:bg-amber-600')}
                onClick={() => {
                  toggleFavorite(item.id);
                  toast.success(item.isFavorite ? t('itemDetail.panel.toast.unfavorited') : t('itemDetail.panel.toast.favorited'));
                }}
              >
                <Star className={cn('size-3', item.isFavorite && 'fill-white')} />
                {item.isFavorite ? t('itemDetail.starred') : t('itemDetail.star')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  onClose();
                  openItemDialog(item.categoryId, item);
                }}
              >
                <Pencil className="size-3" /> {t('common.edit')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-3" /> {t('common.delete')}
              </Button>
            </div>

            {/* Image */}
            {item.images.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  className={cn(
                    'group/img relative block w-full cursor-pointer overflow-hidden rounded-lg bg-black/40',
                    isBook ? 'mx-auto aspect-[2/3] max-h-[340px]' : 'aspect-[4/3]',
                  )}
                  onClick={() => setLightboxOpen(true)}
                  aria-label={t('itemDetail.panel.enlarge')}
                >
                  <img
                    src={item.images[activeImage] || item.images[0]}
                    alt={item.title}
                    className={cn('h-full w-full', isBook ? 'object-contain' : 'object-cover')}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/30 group-focus-visible/img:bg-black/30">
                    <ZoomIn
                      className="size-8 text-white opacity-0 transition-opacity group-hover/img:opacity-100 group-focus-visible/img:opacity-100"
                      aria-hidden="true"
                    />
                  </span>
                </button>
                {item.images.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {item.images.map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImage(idx)}
                        aria-label={t('itemDetail.gallery.showImage', { index: idx + 1 })}
                        aria-current={idx === activeImage ? 'true' : undefined}
                        className={cn(
                          'size-12 shrink-0 overflow-hidden rounded-md border-2 transition-all',
                          idx === activeImage ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
                        )}
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Purchase info */}
            <Card>
              <CardHeader className="px-3 py-2.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="size-3.5" aria-hidden="true" />
                  {t('itemDetail.panel.purchaseInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 pb-3">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Field label={t('itemDetail.panel.price')}>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency)}
                    </span>
                  </Field>
                  <Field label={t('itemDetail.panel.date')}>{formatDate(item.purchaseInfo.purchasedAt)}</Field>
                  {item.purchaseInfo.purchaseLocation && (
                    <Field label={t('itemDetail.panel.location')} className="col-span-2">
                      {item.purchaseInfo.purchaseLocation}
                    </Field>
                  )}
                </dl>

                {currEquivs.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {t('itemDetail.panel.valueAtPurchase')}
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {currEquivs.map((eq) => {
                          const pcRate = currEquivs.find((e) => e.currency === item.purchaseInfo.purchaseCurrency)?.rate ?? 1;
                          const amtInTL = item.purchaseInfo.purchaseCurrency === 'TRY'
                            ? item.purchaseInfo.purchasePrice
                            : item.purchaseInfo.purchasePrice * pcRate;
                          const computedValue = eq.rate > 0 ? amtInTL / eq.rate : 0;
                          return (
                            <div key={eq.currency} className="rounded-md border bg-muted/30 p-1.5 text-center">
                              <p className="text-sm font-bold tabular-nums">{formatCurrency(computedValue, eq.currency)}</p>
                              <p className="text-[9px] tabular-nums text-muted-foreground">
                                1 {eq.currency} = {eq.rate.toFixed(2)} TL
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {t('itemDetail.panel.currentValuation')}
                    </p>
                    <select
                      value={valCurrency}
                      onChange={(e) => setValCurrency(e.target.value)}
                      aria-label={t('itemDetail.panel.valuationCurrency')}
                      className="h-5 rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold tabular-nums">{formatCurrency(currentValuation, valCurrency)}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {t('itemDetail.panel.purchasedValue', { value: formatCurrency(purchaseDateValuation, valCurrency) })}
                      </p>
                    </div>
                    <Badge variant={gainLoss.isPositive ? 'success' : 'destructive'} className="gap-0.5 text-[10px] tabular-nums">
                      {gainLoss.isPositive ? (
                        <ArrowUp className="size-2.5" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="size-2.5" aria-hidden="true" />
                      )}
                      {formatPercent(Math.abs(gainLoss.percentage))}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom fields */}
            {visibleFields.length > 0 && (
              <Card>
                <CardHeader className="px-3 py-2.5">
                  <CardTitle className="text-sm">{t('itemDetail.panel.categoryDetails', { category: category.name })}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <dl className="grid grid-cols-2 gap-2">
                    {visibleFields.map((field) => {
                      const value = item.customFields[field.key];
                      return (
                        <div key={field.id} className="rounded-md border bg-muted/30 p-2">
                          <dt className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{field.label}</dt>
                          <dd className="mt-0.5 text-xs font-medium">
                            {field.type === 'boolean' ? (
                              value ? (
                                <span className="inline-flex items-center gap-1">
                                  <Check className="size-3.5 text-green-500" aria-hidden="true" />
                                  {t('common.yes')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <X className="size-3.5 text-red-400" aria-hidden="true" />
                                  {t('common.no')}
                                </span>
                              )
                            ) : field.type === 'date' && typeof value === 'string' ? (
                              formatDate(value)
                            ) : field.type === 'currency' && typeof value === 'number' ? (
                              formatCurrency(value, displayCurrency)
                            ) : (
                              String(value)
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {item.description && (
              <Card>
                <CardHeader className="px-3 py-2.5">
                  <CardTitle className="text-sm">{t('itemDetail.panel.description')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{t('itemDetail.notes.title')}</CardTitle>
                  {!isEditingNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-[10px]"
                      onClick={() => setIsEditingNotes(true)}
                    >
                      <Pencil className="size-2.5" /> {t('common.edit')}
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => {
                          setIsEditingNotes(false);
                          setNotesValue(getItemNotes(item));
                        }}
                      >
                        {t('common.cancel')}
                      </Button>
                      <Button size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={handleSaveNotes}>
                        <Check className="size-2.5" /> {t('common.save')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {isEditingNotes ? (
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder={t('itemDetail.notes.placeholder')}
                    aria-label={t('itemDetail.notes.title')}
                    className="min-h-24 text-xs"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {notesValue || t('itemDetail.panel.noNotes')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            {hasDocuments && (
              <Card>
                <CardHeader className="px-3 py-2.5">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {t('itemDetail.documents.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <DocumentsPanel item={item} compact />
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}

            {/* QR code */}
            <Card>
              <CardHeader className="px-3 pb-2 pt-3">
                <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <QrCode className="size-3.5" aria-hidden="true" /> {t('itemDetail.panel.qrCode')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="flex flex-col items-center gap-3">
                  <div ref={qrContainerRef} className="rounded-lg border bg-white p-3 shadow-sm">
                    <QRCodeSVG
                      value={getPublicItemUrl(item.id)}
                      size={120}
                      includeMargin={false}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full gap-1.5 text-xs"
                    onClick={() => {
                      const svg = qrContainerRef.current?.querySelector('svg');
                      if (!svg) return;
                      const svgStr = new XMLSerializer().serializeToString(svg);
                      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${item.title.replace(/[^a-z0-9]/gi, '-')}-qr.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="size-3" /> {t('itemDetail.panel.downloadSvg')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <dl className="flex flex-col gap-1 pb-4 pt-1 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="size-2.5" aria-hidden="true" />
                <dt>{t('itemDetail.record.created')}</dt>
                <dd title={formatDate(item.createdAt)}>{formatRelativeDate(item.createdAt)}</dd>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="size-2.5" aria-hidden="true" />
                <dt>{t('itemDetail.record.updated')}</dt>
                <dd title={formatDate(item.updatedAt)}>{formatRelativeDate(item.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </ScrollArea>
      </motion.div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-h-[90vh] max-w-[90vw] overflow-hidden border-none bg-black/95 p-0">
          <DialogTitle className="sr-only">{item.title}</DialogTitle>
          <div className="relative flex h-[85vh] items-center justify-center">
            <img
              src={item.images[activeImage] || item.images[0]}
              alt={item.title}
              className="max-h-full max-w-full object-contain"
            />

            {item.images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t('itemDetail.gallery.previous')}
                  className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((prev) => (prev === 0 ? item.images.length - 1 : prev - 1));
                  }}
                >
                  <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('itemDetail.gallery.next')}
                  className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((prev) => (prev === item.images.length - 1 ? 0 : prev + 1));
                  }}
                >
                  <ChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs tabular-nums text-white/80 backdrop-blur-sm">
              {t('itemDetail.gallery.counter', { current: activeImage + 1, total: item.images.length })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={t('itemDetail.panel.archiveTitle')}
        description={t('itemDetail.panel.archiveDescription', { title: item.title })}
        confirmLabel={t('itemDetail.panel.archiveConfirm')}
        destructive
      />
    </>
  );
}
