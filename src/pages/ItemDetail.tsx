import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { PageTransition } from '@/components/shared/motion';
import type { LucideIcon } from 'lucide-react';
import {
  Package,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  Tag,
  User,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  DollarSign,
  Clock,
  Hash,
  Save,
  FileText,
  ArrowLeft,
  Star,
  Wrench,
  Send,
  Plus,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { toast } from 'sonner';

import { PageHeader, ConfirmDialog, EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeDate,
  calculateGainLoss,
} from '@/lib/utils';
import { currencyService } from '@/services/currencyService';
import { useCollectionStore } from '@/store/useCollectionStore';

function getConditionBadgeProps(condition: string) {
  switch (condition) {
    case 'Mint':
    case 'Near Mint':
      return { variant: 'success' as const };
    case 'Very Good':
    case 'Good':
      return {
        variant: 'outline' as const,
        className: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400',
      };
    case 'Fair':
      return { variant: 'warning' as const };
    case 'Poor':
      return { variant: 'destructive' as const };
    default:
      return { variant: 'secondary' as const };
  }
}

const ChartTooltip = ({ active, payload, label, displayCurrency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatCurrency(payload[0].value, displayCurrency)}
      </p>
    </div>
  );
};

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
  condBadge: { variant: string; className?: string };
  FallbackIcon: LucideIcon;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasImages = images.length > 0;
  const hasMultiple = images.length > 1;

  const goPrev = () => setActiveIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const goNext = () => setActiveIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-black/40">
        {hasImages ? (
          <>
            <img
              src={images[activeIndex]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-60"
            />
            <img
              src={images[activeIndex]}
              alt={`${title} - ${activeIndex + 1}`}
              className="relative z-10 h-full w-full object-contain transition-opacity duration-300"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <FallbackIcon className="size-20 text-primary/20" />
          </div>
        )}

        <div className="absolute right-3 top-3">
          <Badge {...(condBadge as any)} className={cn('text-sm px-3 py-1', condBadge.className)}>
            {condition}
          </Badge>
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-sm">
              <ImageIcon className="size-3 text-white/70" />
              <span className="text-xs font-medium text-white">
                {activeIndex + 1} / {images.length}
              </span>
            </div>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto p-3 scrollbar-thin">
          {images.map((src, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={cn(
                'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                idx === activeIndex
                  ? 'border-primary shadow-md shadow-primary/20'
                  : 'border-transparent opacity-60 hover:opacity-100',
              )}
            >
              <img src={src} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function ItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const displayCurrency = useCollectionStore((s) => s.displayCurrency);
  const {
    getItemById,
    getCategoryById,
    getContributorById,
    updateItem,
    deleteItem,
    toggleFavorite,
    addMaintenanceEntry,
    removeMaintenanceEntry,
    openItemDialog,
  } = useCollectionStore();

  const item = getItemById(itemId ?? '');
  const category = item ? getCategoryById(item.categoryId) : undefined;
  const contributor = item ? getContributorById(item.contributorId) : undefined;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const gainLoss = useMemo(() => {
    if (!item) return { diff: 0, percentage: 0, isPositive: true };
    const purchaseDisplay = currencyService.convert(
      item.purchaseInfo.purchasePrice,
      item.purchaseInfo.purchaseCurrency,
      displayCurrency,
    );
    const currentDisplay = currencyService.convert(
      item.purchaseInfo.purchasePrice,
      item.purchaseInfo.purchaseCurrency,
      displayCurrency,
    );
    return calculateGainLoss(purchaseDisplay, currentDisplay);
  }, [item, displayCurrency]);

  const chartData = useMemo(() => {
    if (!item) return [];
    return item.valuationInfo.valueHistory.map((entry) => ({
      date: formatDate(entry.date),
      value: currencyService.convert(entry.value, entry.currency, displayCurrency),
    }));
  }, [item, displayCurrency]);

  const currentValueUSD = useMemo(() => {
    if (!item) return 0;
    return currencyService.convert(
      item.purchaseInfo.purchasePrice,
      item.purchaseInfo.purchaseCurrency,
      'USD',
    );
  }, [item]);

  const currentValueDisplay = useMemo(() => {
    if (!item) return 0;
    return currencyService.convert(
      item.purchaseInfo.purchasePrice,
      item.purchaseInfo.purchaseCurrency,
      displayCurrency,
    );
  }, [item, displayCurrency]);

  if (!item || !category) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Item Not Found"
          breadcrumbs={[{ label: 'Collections', href: '/collections' }]}
        />
        <EmptyState
          icon={Package}
          title="Item not found"
          description="The item you're looking for doesn't exist or has been removed."
          action={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
        />
      </div>
    );
  }

  const CategoryIcon = getCategoryIcon(category.icon);
  const condBadge = getConditionBadgeProps(item.condition);

  const handleDelete = () => {
    deleteItem(item.id);
    toast.success('Item deleted successfully');
    if (category) {
      navigate(`/collections/${category.slug}`);
    } else {
      navigate('/collections');
    }
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    updateItem(item.id, { notes });
    setTimeout(() => {
      setIsSavingNotes(false);
      toast.success('Notes saved successfully');
    }, 300);
  };

  const renderFieldValue = (fieldType: string, value: unknown) => {
    if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
    if (fieldType === 'boolean') {
      return value ? (
        <Check className="size-4 text-green-500" />
      ) : (
        <X className="size-4 text-red-400" />
      );
    }
    if (fieldType === 'date' && typeof value === 'string') {
      return formatDate(value);
    }
    if (fieldType === 'currency' && typeof value === 'number') {
      return formatCurrency(value, displayCurrency);
    }
    return String(value);
  };

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        breadcrumbs={[
          { label: 'Collections', href: '/collections' },
          { label: category.name, href: `/collections/${category.slug}` },
          { label: item.title },
        ]}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/collections/${category.slug}`)}
        >
          <ArrowLeft className="mr-1.5 size-3.5" />
          Back
        </Button>
        <Button
          variant={item.isFavorite ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            toggleFavorite(item.id);
            toast.success(item.isFavorite ? 'Removed from favorites' : 'Added to favorites');
          }}
          className={item.isFavorite ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
        >
          <Star className={cn('mr-1.5 size-3.5', item.isFavorite && 'fill-white')} />
          {item.isFavorite ? 'Starred' : 'Star'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openItemDialog(item.categoryId, item)}
        >
          <Pencil className="mr-1.5 size-3.5" />
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Image Gallery */}
          <ImageGallery
            images={item.images}
            title={item.title}
            condition={item.condition}
            condBadge={condBadge}
            FallbackIcon={CategoryIcon}
          />

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
              <TabsTrigger value="maintenance">
                <Wrench className="mr-1.5 size-3.5" />
                Maintenance
                {item.maintenanceLog.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{item.maintenanceLog.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="lending">
                <Send className="mr-1.5 size-3.5" />
                Lending
                {item.lendingHistory.some((l) => !l.actualReturnDate) && (
                  <Badge variant="warning" className="ml-1.5 h-5 px-1.5 text-[10px]">Active</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="leading-relaxed text-muted-foreground">
                    {item.description || 'No description provided.'}
                  </p>

                  <Separator />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Tag className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Condition</p>
                        <Badge {...condBadge} className={cn('mt-1', condBadge.className)}>
                          {item.condition}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <CategoryIcon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Category</p>
                        <Link
                          to={`/collections/${category.slug}`}
                          className="mt-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {category.name}
                        </Link>
                      </div>
                    </div>

                    {item.location && (
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <MapPin className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Location</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{item.location}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Tag className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tags</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.tags.length > 0 ? (
                            item.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No tags</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {contributor && (
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <User className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Contributor</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Avatar className="size-5">
                              <AvatarImage src={contributor.avatar} alt={contributor.name} />
                              <AvatarFallback className="text-[10px]">
                                {contributor.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground">
                              {contributor.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Calendar className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Added</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Custom Fields Tab */}
            <TabsContent value="custom-fields">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  {category.fields.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {category.fields
                        .filter((f) => {
                          if (f.key === 'notes' || f.type === 'rich-notes' || f.key === 'title' || f.key === 'condition' || f.key === 'quantity') return false;
                          if (f.type === 'boolean') return true;
                          const v = item.customFields[f.key];
                          return v != null && v !== '';
                        })
                        .map((field) => (
                        <div
                          key={field.id}
                          className="rounded-lg border bg-muted/30 p-3"
                        >
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {field.label}
                          </p>
                          <div className="mt-1 text-sm font-medium">
                            {renderFieldValue(field.type, item.customFields[field.key])}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No custom fields defined for this category.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Maintenance Tab */}
            <TabsContent value="maintenance">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="size-4" />
                      Maintenance Log
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => {
                        addMaintenanceEntry(item.id, {
                          date: new Date().toISOString().slice(0, 10),
                          type: 'inspection',
                          description: 'New maintenance entry - click to edit details',
                        });
                        toast.success('Maintenance entry added');
                      }}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      Add Entry
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.maintenanceLog.length > 0 ? (
                    <div className="space-y-4">
                      {item.maintenanceLog.map((entry) => (
                        <div key={entry.id} className="group relative rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                                entry.type === 'repair' ? 'bg-amber-500/10' :
                                entry.type === 'restoration' ? 'bg-blue-500/10' :
                                entry.type === 'cleaning' ? 'bg-green-500/10' : 'bg-primary/10'
                              )}>
                                <Wrench className={cn(
                                  'size-4',
                                  entry.type === 'repair' ? 'text-amber-500' :
                                  entry.type === 'restoration' ? 'text-blue-500' :
                                  entry.type === 'cleaning' ? 'text-green-500' : 'text-primary'
                                )} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs capitalize">{entry.type}</Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                                </div>
                                <p className="mt-1 text-sm">{entry.description}</p>
                                {(entry.cost || entry.provider) && (
                                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                    {entry.cost && (
                                      <span>
                                        Cost:{' '}
                                        {formatCurrency(
                                          currencyService.convert(
                                            entry.cost,
                                            entry.currency || 'USD',
                                            displayCurrency,
                                          ),
                                          displayCurrency,
                                        )}
                                      </span>
                                    )}
                                    {entry.provider && <span>Provider: {entry.provider}</span>}
                                  </div>
                                )}
                                {entry.nextScheduled && (
                                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                                    <AlertTriangle className="size-3" />
                                    Next scheduled: {formatDate(entry.nextScheduled)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                removeMaintenanceEntry(item.id, entry.id);
                                toast.success('Entry removed');
                              }}
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Wrench className="mx-auto size-10 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">No maintenance records yet</p>
                      <p className="text-xs text-muted-foreground">Track cleaning, repairs, and inspections</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Lending Tab */}
            <TabsContent value="lending">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="size-4" />
                    Lending History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {item.lendingHistory.length > 0 ? (
                    <div className="space-y-4">
                      {item.lendingHistory.map((record) => {
                        const isActive = !record.actualReturnDate;
                        const isOverdue = isActive && new Date(record.expectedReturnDate) < new Date();
                        return (
                          <div
                            key={record.id}
                            className={cn(
                              'rounded-lg border p-4',
                              isActive && isOverdue ? 'border-red-500/30 bg-red-500/5' :
                              isActive ? 'border-amber-500/30 bg-amber-500/5' : 'bg-muted/30'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <User className="size-4 text-muted-foreground" />
                                  <span className="font-medium">{record.borrowerName}</span>
                                  {isActive && (
                                    <Badge variant={isOverdue ? 'destructive' : 'warning'} className="text-[10px]">
                                      {isOverdue ? 'OVERDUE' : 'Active'}
                                    </Badge>
                                  )}
                                  {!isActive && (
                                    <Badge
                                      variant={record.condition === 'same' ? 'success' :
                                        record.condition === 'better' ? 'default' :
                                        record.condition === 'worse' ? 'warning' : 'destructive'}
                                      className="text-[10px] capitalize"
                                    >
                                      {record.condition}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>Lent: {formatDate(record.lentDate)}</span>
                                  <span>Due: {formatDate(record.expectedReturnDate)}</span>
                                  {record.actualReturnDate && <span>Returned: {formatDate(record.actualReturnDate)}</span>}
                                </div>
                                {record.notes && <p className="mt-1 text-sm text-muted-foreground">{record.notes}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Send className="mx-auto size-10 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">No lending records</p>
                      <p className="text-xs text-muted-foreground">
                        Track items lent to others via the{' '}
                        <button onClick={() => navigate('/lending')} className="text-primary hover:underline">
                          Lending Tracker
                        </button>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="size-4" />
                      Notes
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes || notes === item.notes}
                    >
                      <Save className="mr-1.5 size-3.5" />
                      {isSavingNotes ? 'Saving...' : 'Save Notes'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this item..."
                    className="min-h-[200px] resize-y font-mono text-sm leading-relaxed"
                  />
                  {notes !== item.notes && (
                    <p className="mt-2 text-xs text-amber-500">
                      You have unsaved changes
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Value History Chart */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Value History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          `${currencyService.getCurrencySymbol(displayCurrency)}${(v / 1000).toFixed(0)}k`
                        }
                        width={48}
                      />
                      <Tooltip content={<ChartTooltip displayCurrency={displayCurrency} />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#valueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Valuation Card */}
          <div className="relative rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-px">
            <Card className="overflow-hidden border-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="size-4" />
                  Valuation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Purchase Info */}
                <div className="space-y-2.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Purchase Info
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Price</span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(
                          currencyService.convert(
                            item.purchaseInfo.purchasePrice,
                            item.purchaseInfo.purchaseCurrency,
                            displayCurrency,
                          ),
                          displayCurrency,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Date</span>
                      <span className="text-sm">
                        {formatDate(item.purchaseInfo.purchasedAt)}
                      </span>
                    </div>
                    {item.purchaseInfo.purchaseLocation && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Location</span>
                        <span className="text-sm">{item.purchaseInfo.purchaseLocation}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Exchange Rate</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        1 {item.purchaseInfo.purchaseCurrency} = {(Number(item.purchaseInfo.exchangeRateAtPurchase) || 0).toFixed(4)} USD
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Current Valuation */}
                <div className="space-y-2.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Current Valuation
                  </p>
                  <div className="text-center">
                    <p className="text-3xl font-bold tracking-tight">
                      {formatCurrency(currentValueDisplay, displayCurrency)}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-1.5">
                      <Badge
                        variant={gainLoss.isPositive ? 'success' : 'destructive'}
                        className="gap-0.5"
                      >
                        {gainLoss.isPositive ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )}
                        {Math.abs(gainLoss.percentage).toFixed(1)}%
                      </Badge>
                      <span
                        className={cn(
                          'text-sm font-medium',
                          gainLoss.isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {gainLoss.isPositive ? '+' : ''}
                        {formatCurrency(gainLoss.diff, displayCurrency)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Exchange Rate</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      1 {item.valuationInfo.currentValueCurrency} = {(Number(item.valuationInfo.currentExchangeRate) || 0).toFixed(4)} USD
                    </span>
                  </div>
                </div>

                {/* 2030 Projection */}
                {item.valuationInfo.targetYearProjection != null &&
                  item.valuationInfo.targetEstimatedValue != null && (
                  <>
                    <Separator />
                    <div className="space-y-2.5">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {item.valuationInfo.targetYearProjection} Projection
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Target Year</span>
                        <span className="text-sm font-medium">
                          {item.valuationInfo.targetYearProjection}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Projected Value</span>
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(
                            currencyService.convert(
                              item.valuationInfo.targetEstimatedValue,
                              item.valuationInfo.currentValueCurrency,
                              displayCurrency,
                            ),
                            displayCurrency,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <TrendingUp className="size-3" />
                        <span>
                          +{(
                            currentValueDisplay > 0
                              ? ((currencyService.convert(
                                  item.valuationInfo.targetEstimatedValue,
                                  item.valuationInfo.currentValueCurrency,
                                  displayCurrency,
                                ) /
                                  currentValueDisplay -
                                  1) *
                                100)
                              : 0
                          ).toFixed(0)}
                          % projected growth
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* USD Equivalent */}
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">USD Equivalent</p>
                  <p className="mt-0.5 text-lg font-semibold">
                    {formatCurrency(currentValueUSD, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contributor Card */}
          {contributor && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contributor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={contributor.avatar} alt={contributor.name} />
                    <AvatarFallback>
                      {contributor.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{contributor.name}</p>
                    <Badge variant="secondary" className="mt-0.5 text-[10px] capitalize">
                      {contributor.role}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadata Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4" />
                Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm" title={formatDate(item.createdAt)}>
                  {formatRelativeDate(item.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Updated</span>
                <span className="text-sm" title={formatDate(item.updatedAt)}>
                  {formatRelativeDate(item.updatedAt)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Item ID</span>
                <code className="max-w-[140px] truncate text-xs text-muted-foreground">
                  {item.id}
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete Item"
        description={`"${item.title}" will be permanently removed from your collection. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
    </PageTransition>
  );
}
