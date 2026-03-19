import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeDate,
  calculateGainLoss,
} from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { QRCodeSVG } from 'qrcode.react';
import { useCollectionStore } from '@/store/useCollectionStore';
import { ConfirmDialog } from '@/components/shared';

function getConditionBadgeProps(condition: string) {
  switch (condition) {
    case 'Mint':
    case 'Near Mint':
      return { variant: 'success' as const };
    case 'Very Good':
    case 'Good':
      return { variant: 'outline' as const, className: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    case 'Fair':
      return { variant: 'warning' as const };
    case 'Poor':
      return { variant: 'destructive' as const };
    default:
      return { variant: 'secondary' as const };
  }
}

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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [width, setWidth] = useState(560);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [notesValue, setNotesValue] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setActiveImage(0);
    setIsEditingNotes(false);
  }, [itemId]);

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

  const item = itemId ? getItemById(itemId) : undefined;
  const category = item ? getCategoryById(item.categoryId) : undefined;
  const [valCurrency, setValCurrency] = useState(displayCurrency);

  const currentValuation = useMemo(() => {
    if (!item) return 0;
    return currencyService.convert(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency, valCurrency);
  }, [item, valCurrency]);

  const purchaseDateValuation = useMemo(() => {
    if (!item) return 0;
    const equivs = item.purchaseInfo.currencyEquivalents || [];
    const vcEquiv = equivs.find((e) => e.currency === valCurrency);
    if (vcEquiv && vcEquiv.rate > 0) {
      const pcRate = equivs.find((e) => e.currency === item.purchaseInfo.purchaseCurrency)?.rate ?? 1;
      const amtInTL = item.purchaseInfo.purchaseCurrency === 'TRY'
        ? item.purchaseInfo.purchasePrice
        : item.purchaseInfo.purchasePrice * pcRate;
      return amtInTL / vcEquiv.rate;
    }
    if (valCurrency === 'TRY') {
      const pcRate = equivs.find((e) => e.currency === item.purchaseInfo.purchaseCurrency)?.rate ?? 0;
      if (pcRate > 0) return item.purchaseInfo.purchasePrice * pcRate;
    }
    return currencyService.convert(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency, valCurrency);
  }, [item, valCurrency]);

  const gainLoss = useMemo(() => {
    if (!item) return { diff: 0, percentage: 0, isPositive: true };
    return calculateGainLoss(purchaseDateValuation, currentValuation);
  }, [item, purchaseDateValuation, currentValuation]);

  const handleDelete = () => {
    if (item) {
      deleteItem(item.id);
      toast.success('Item archived');
      onClose();
    }
  };

  useEffect(() => {
    if (item) {
      setNotesValue(item.notes ?? (item.customFields?.notes as string) ?? '');
    }
  }, [item?.id]);

  const handleSaveNotes = useCallback(() => {
    if (!item) return;
    setIsSavingNotes(true);
    updateItem(item.id, {
      notes: notesValue,
      customFields: { ...item.customFields, notes: notesValue },
    });
    setIsSavingNotes(false);
    setIsEditingNotes(false);
    toast.success('Notes saved');
  }, [item, notesValue, updateItem]);

  if (!item || !category) return null;

  const condBadge = getConditionBadgeProps(item.condition);
  const isBookCategory = category.id === 'cat-books';
  const qty = (item.customFields?.quantity as number) || item.quantity || 1;
  const edition = item.customFields?.edition;
  const publisher = item.customFields?.publisher as string;
  const currEquivs = item.purchaseInfo.currencyEquivalents || [];

  return (
    <>
      <motion.div
        initial={{ x: isMobile ? '100%' : 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={isMobile
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
            className="absolute -left-1 top-0 bottom-0 z-10 flex w-2.5 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors"
          >
            <GripVertical className="size-3.5 text-muted-foreground/40" />
          </div>
        )}

        {/* Close button */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
          <h3 className="text-sm font-semibold text-muted-foreground truncate pr-2">Detail</h3>
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose}>
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
                <Badge {...condBadge} className={cn('text-[10px]', condBadge.className)}>{item.condition}</Badge>
                {item.isRead && <Badge variant="success" className="text-[10px] gap-0.5"><Check className="size-2.5" /> Read</Badge>}
                {edition != null && edition !== '' && <Badge variant="outline" className="text-[10px]">{String(edition)}. Edition</Badge>}
                <Badge variant="secondary" className="text-[10px]">{qty} {qty > 1 ? 'copies' : 'copy'}</Badge>
                {item.isFavorite && <Badge className="bg-amber-500 text-white text-[10px] gap-0.5"><Star className="size-2.5 fill-white" /> Starred</Badge>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-1.5">
              {isBookCategory && (
                <Button
                  variant={item.isRead ? 'default' : 'outline'}
                  size="sm"
                  className={cn('h-7 text-xs', item.isRead && 'bg-green-600 hover:bg-green-700 text-white')}
                  onClick={() => { toggleRead(item.id); toast.success(item.isRead ? 'Marked as unread' : 'Marked as read'); }}
                >
                  {item.isRead ? <Check className="mr-1 size-3" /> : <BookOpen className="mr-1 size-3" />}
                  {item.isRead ? 'Read' : 'Mark Read'}
                </Button>
              )}
              <Button
                variant={item.isFavorite ? 'default' : 'outline'}
                size="sm"
                className={cn('h-7 text-xs', item.isFavorite && 'bg-amber-500 hover:bg-amber-600 text-white')}
                onClick={() => { toggleFavorite(item.id); toast.success(item.isFavorite ? 'Unfavorited' : 'Favorited'); }}
              >
                <Star className={cn('mr-1 size-3', item.isFavorite && 'fill-white')} />
                {item.isFavorite ? 'Starred' : 'Star'}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { onClose(); openItemDialog(item.categoryId, item); }}>
                <Pencil className="mr-1 size-3" /> Edit
              </Button>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-1 size-3" /> Delete
              </Button>
            </div>

            {/* Image */}
            {item.images.length > 0 && (
              <div className="space-y-2">
                <div
                  className={cn(
                    'group/img relative cursor-pointer overflow-hidden rounded-lg bg-black/40',
                    isBookCategory ? 'aspect-[2/3] max-h-[340px] mx-auto' : 'aspect-[4/3]',
                  )}
                  onClick={() => setLightboxOpen(true)}
                >
                  <img
                    src={item.images[activeImage] || item.images[0]}
                    alt={item.title}
                    className={cn('h-full w-full', isBookCategory ? 'object-contain' : 'object-cover')}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/30">
                    <ZoomIn className="size-8 text-white opacity-0 transition-opacity group-hover/img:opacity-100" />
                  </div>
                </div>
                {item.images.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {item.images.map((src, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImage(idx)}
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

            {/* Purchase Info */}
            <Card>
              <CardHeader className="px-3 py-2.5">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="size-3.5" />
                  Purchase Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-3 pb-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Price</p>
                    <p className="font-semibold">{formatCurrency(item.purchaseInfo.purchasePrice, item.purchaseInfo.purchaseCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Date</p>
                    <p className="text-sm">{formatDate(item.purchaseInfo.purchasedAt)}</p>
                  </div>
                  {item.purchaseInfo.purchaseLocation && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Location</p>
                      <p className="text-sm">{item.purchaseInfo.purchaseLocation}</p>
                    </div>
                  )}
                </div>

                {currEquivs.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                        Value at Purchase Date
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
                              <p className="text-sm font-bold">{formatCurrency(computedValue, eq.currency)}</p>
                              <p className="text-[9px] text-muted-foreground">1 {eq.currency} = {eq.rate.toFixed(2)} TL</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current Valuation</p>
                    <select
                      value={valCurrency}
                      onChange={(e) => setValCurrency(e.target.value)}
                      className="h-5 rounded border border-border bg-background px-1.5 text-[10px] text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                    >
                      {['TRY', 'USD', 'EUR', 'GBP'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold">
                        {formatCurrency(currentValuation, valCurrency)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Purchased: {formatCurrency(purchaseDateValuation, valCurrency)}
                      </p>
                    </div>
                    <Badge variant={gainLoss.isPositive ? 'success' : 'destructive'} className="gap-0.5 text-[10px]">
                      {gainLoss.isPositive ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                      {Math.abs(gainLoss.percentage).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields */}
            {category.fields.length > 0 && (
              <Card>
                <CardHeader className="px-3 py-2.5">
                  <CardTitle className="text-sm">{category.name} Details</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="grid grid-cols-2 gap-2">
                    {category.fields
                      .filter((f) => {
                        if (f.key === 'notes' || f.type === 'rich-notes' || f.key === 'title' || f.key === 'condition' || f.key === 'quantity') return false;
                        if (f.type === 'boolean') return true;
                        const v = item.customFields[f.key];
                        return v != null && v !== '';
                      })
                      .map((field) => {
                        const value = item.customFields[field.key];
                        return (
                          <div key={field.id} className="rounded-md border bg-muted/30 p-2">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{field.label}</p>
                            <p className="mt-0.5 text-xs font-medium">
                              {field.type === 'boolean' ? (
                                value ? <Check className="size-3.5 text-green-500" /> : <X className="size-3.5 text-red-400" />
                              ) : field.type === 'date' && typeof value === 'string' ? (
                                formatDate(value)
                              ) : field.type === 'currency' && typeof value === 'number' ? (
                                formatCurrency(value, displayCurrency)
                              ) : (
                                String(value)
                              )}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {item.description && (
              <Card>
                <CardHeader className="px-3 py-2.5">
                  <CardTitle className="text-sm">Description</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Notes</CardTitle>
                  {!isEditingNotes ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setIsEditingNotes(true)}
                    >
                      <Pencil className="mr-1 size-2.5" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => {
                          setIsEditingNotes(false);
                          setNotesValue(item.notes ?? (item.customFields?.notes as string) ?? '');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        disabled={isSavingNotes}
                        onClick={handleSaveNotes}
                      >
                        <Check className="mr-1 size-2.5" /> Save
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
                    placeholder="Add notes about this item..."
                    className="min-h-24 text-xs"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {notesValue || 'No notes yet.'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            )}

            {/* QR Code */}
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <QrCode className="size-3.5" /> QR Code
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="flex flex-col items-center gap-3">
                  <div ref={qrContainerRef} className="rounded-lg border bg-white p-3 shadow-sm">
                    <QRCodeSVG
                      value={`${window.location.origin}/items/${item.id}`}
                      size={120}
                      includeMargin={false}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 w-full"
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
                    <Download className="size-3" /> Download SVG
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <div className="flex flex-col gap-1 text-[10px] text-muted-foreground pt-1 pb-4">
              <span className="flex items-center gap-1"><Clock className="size-2.5" /> Created {formatRelativeDate(item.createdAt)}</span>
              <span className="flex items-center gap-1"><Clock className="size-2.5" /> Updated {formatRelativeDate(item.updatedAt)}</span>
            </div>
          </div>
        </ScrollArea>
      </motion.div>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 border-none bg-black/95 overflow-hidden">
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((prev) => (prev === 0 ? item.images.length - 1 : prev - 1));
                  }}
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((prev) => (prev === item.images.length - 1 ? 0 : prev + 1));
                  }}
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
              {activeImage + 1} / {item.images.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Archive Item"
        description={`"${item.title}" will be moved to the archive.`}
        confirmLabel="Archive"
        destructive
      />
    </>
  );
}
