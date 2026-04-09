import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Save, Plus, X, Upload, ArrowLeft, HelpCircle, ImagePlus, Trash2, Star,
  BookOpen, Package,
  ChevronRight, Search, Loader2, ExternalLink, AlertTriangle, ScanBarcode,
} from 'lucide-react';
import { getCategoryIcon } from '@/lib/icons';
import type { CategoryField, CollectionItem } from '@/types';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  ITEM_FORM_CONDITIONS,
  ITEM_FORM_CURRENCIES,
  ITEM_FORM_HIDDEN_CUSTOM_KEYS,
  buildCurrencyEquivalents,
  buildPurchaseRatesMap,
  getEquivalentForDisplay,
  getHistoricalPurchaseRates,
  getPurchaseExchangeRateToUsd,
  itemToFormValues,
  normalizeCustomFields,
  persistItemImages,
  resolveCurrentValuationInput,
  type ItemFormValues,
} from '@/lib/itemForm';
import { canManageCatalog } from '@/lib/permissions';
import { currencyService } from '@/services/currencyService';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';
import { BarcodeScannerDialog } from '@/components/shared/BarcodeScannerDialog';

function DynamicFieldRenderer({
  field,
  control,
  errors,
}: {
  field: CategoryField;
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
}) {
  const fieldError = errors?.customFields?.[field.key];

  const wrapper = (children: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={`cf-${field.key}`} className="flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {field.helpText && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <HelpCircle className="size-3 shrink-0" />
          {field.helpText}
        </p>
      )}
      {fieldError && (
        <p className="text-xs text-destructive">{fieldError.message as string}</p>
      )}
    </div>
  );

  switch (field.type) {
    case 'text':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <Input
              id={`cf-${field.key}`}
              placeholder={field.placeholder}
              className={cn(fieldError && 'border-destructive')}
              {...f}
              value={(f.value as string) ?? ''}
            />
          )}
        />,
      );

    case 'textarea':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <Textarea
              id={`cf-${field.key}`}
              placeholder={field.placeholder}
              className={cn('min-h-24', fieldError && 'border-destructive')}
              {...f}
              value={(f.value as string) ?? ''}
            />
          )}
        />,
      );

    case 'number':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <Input
              id={`cf-${field.key}`}
              type="number"
              placeholder={field.placeholder}
              className={cn(fieldError && 'border-destructive')}
              {...f}
              value={(f.value as number | string | undefined) ?? ''}
              onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
            />
          )}
        />,
      );

    case 'date':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <Input
              id={`cf-${field.key}`}
              type="date"
              className={cn(fieldError && 'border-destructive')}
              {...f}
              value={(f.value as string) ?? ''}
            />
          )}
        />,
      );

    case 'select':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <Select value={(f.value as string) ?? ''} onValueChange={f.onChange}>
              <SelectTrigger
                id={`cf-${field.key}`}
                className={cn(fieldError && 'border-destructive')}
              >
                <SelectValue placeholder={field.placeholder ?? 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.filter((opt) => opt !== '').map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />,
      );

    case 'multi-select':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => {
            const selected: string[] = f.value
              ? (f.value as string).split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {field.options?.map((opt) => {
                    const isChecked = selected.includes(opt);
                    return (
                      <label key={opt} className="flex cursor-pointer items-center gap-1.5">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...selected, opt]
                              : selected.filter((s) => s !== opt);
                            f.onChange(next.join(', '));
                          }}
                        />
                        <span className="text-sm">{opt}</span>
                      </label>
                    );
                  })}
                </div>
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />,
      );

    case 'currency':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id={`cf-${field.key}`}
                type="number"
                step="0.01"
                placeholder={field.placeholder ?? '0.00'}
                className={cn('pl-7', fieldError && 'border-destructive')}
                {...f}
                value={(f.value as number | string | undefined) ?? ''}
                onChange={(e) =>
                  f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
            </div>
          )}
        />,
      );

    case 'boolean':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id={`cf-${field.key}`}
                checked={!!f.value}
                onCheckedChange={f.onChange}
              />
              <span className="text-sm text-muted-foreground">
                {f.value ? 'Yes' : 'No'}
              </span>
            </div>
          )}
        />,
      );

    case 'image':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={() => (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/30',
                fieldError ? 'border-destructive' : 'border-input',
              )}
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop images here or click to upload
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
            </div>
          )}
        />,
      );

    case 'tags':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => {
            const tagList = f.value
              ? (f.value as string).split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];
            return (
              <div className="space-y-2">
                <Input
                  id={`cf-${field.key}`}
                  placeholder={field.placeholder ?? 'Enter tags separated by commas'}
                  className={cn(fieldError && 'border-destructive')}
                  {...f}
                  value={(f.value as string) ?? ''}
                />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tagList.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />,
      );

    case 'rich-notes':
      return wrapper(
        <Controller
          name={`customFields.${field.key}`}
          control={control}
          render={({ field: f }) => (
            <Textarea
              id={`cf-${field.key}`}
              placeholder={field.placeholder}
              className={cn('min-h-36', fieldError && 'border-destructive')}
              {...f}
              value={(f.value as string) ?? ''}
            />
          )}
        />,
      );

    default:
      return null;
  }
}


function BookSearchDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (book: BookSearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 3) {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
      }
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await bookSearchService.search(q, 12);
      setResults(data);
    } catch (error: unknown) {
      if (isAbortLike(error)) return;
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (val: string) => {
      setQuery(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(val), 400);
    },
    [doSearch],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            Search Open Library
          </DialogTitle>
          <DialogDescription>
            Search millions of books and auto-fill your form
          </DialogDescription>
        </DialogHeader>

        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Type at least 3 characters to search..."
              className="pl-9 pr-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  clearTimeout(debounceRef.current);
                  doSearch(query);
                }
              }}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <BookOpen className="size-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Search for a book</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Type a title, author name, or ISBN to get started
                </p>
              </div>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Search className="size-10 text-muted-foreground/30" />
              <p className="font-medium">No results found</p>
              <p className="text-sm text-muted-foreground">
                Try a different search term
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y">
              {results.map((book) => (
                <button
                  key={book.key}
                  type="button"
                  className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50"
                  onClick={() => {
                    onSelect(book);
                    onOpenChange(false);
                  }}
                >
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="h-20 w-14 shrink-0 rounded-md border object-cover shadow-sm"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <BookOpen className="size-6 text-muted-foreground/50" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold leading-tight">{book.title}</p>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {book.publishYear && (
                        <Badge variant="secondary" className="text-[10px]">
                          {book.publishYear}
                        </Badge>
                      )}
                      {book.publisher && (
                        <Badge variant="outline" className="max-w-[200px] truncate text-[10px]">
                          {book.publisher}
                        </Badge>
                      )}
                      {book.pageCount && (
                        <Badge variant="outline" className="text-[10px]">
                          {book.pageCount} pages
                        </Badge>
                      )}
                      {book.isbn && (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          ISBN: {book.isbn}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between border-t px-6 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="size-3" />
            Powered by Open Library
          </p>
          {results.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {results.length} results
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isAbortLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || String(error.message).includes('abort');
}

export default function ItemForm() {
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const {
    categories,
    getCategoryById,
    getCategoryBySlug,
    getItemById,
    getItemsByCategory,
    getLibrariesByCategory,
    addItem,
    updateItem,
  } = useCollectionStore();

  const isEditMode = !!itemId;
  const existingItem = isEditMode ? getItemById(itemId) : undefined;
  const canCreateCategory = canManageCatalog(user?.role ?? 'viewer');
  const currentUserId = user?.uid && user.uid !== 'offline' ? user.uid : null;

  const category = useMemo(() => {
    if (existingItem) return getCategoryById(existingItem.categoryId);
    const slug = searchParams.get('category');
    return slug ? getCategoryBySlug(slug) : undefined;
  }, [existingItem, searchParams, getCategoryById, getCategoryBySlug]);

  const sortedFields = useMemo(
    () => [...(category?.fields ?? [])]
      .filter((f) => !ITEM_FORM_HIDDEN_CUSTOM_KEYS.has(f.key))
      .sort((a, b) => a.order - b.order),
    [category],
  );

  const categoryLibraries = useMemo(
    () => (category ? getLibrariesByCategory(category.id) : []),
    [category, getLibrariesByCategory],
  );

  const defaultValues = useMemo<ItemFormValues>(() => {
    if (existingItem && category) {
      return itemToFormValues(existingItem, sortedFields);
    }

    const customDefaults: Record<string, unknown> = {};
    for (const field of sortedFields) {
      if (field.defaultValue !== undefined) {
        customDefaults[field.key] = field.defaultValue;
      } else if (field.type === 'boolean') {
        customDefaults[field.key] = false;
      } else {
        customDefaults[field.key] = '';
      }
    }

    return {
      title: '',
      description: '',
      condition: '',
      location: '',
      tags: '',
      customFields: customDefaults,
      purchaseDate: '',
      purchasePrice: undefined,
      purchaseCurrency: 'TRY',
      purchaseLocation: '',
      exchangeRate: undefined,
      currentValue: undefined,
      currentValueCurrency: '',
      targetYear: 2030,
      targetValue: undefined,
      notes: '',
      libraryId: '',
      quantity: 1,
      eurRate: undefined,
      usdRate: undefined,
      gbpRate: undefined,
    };
  }, [existingItem, category, sortedFields]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const [hasInteracted, setHasInteracted] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  const requestLeave = useCallback((onConfirm: () => void) => {
    if (!hasInteracted || isFormSubmitted) {
      onConfirm();
      return;
    }
    pendingNavRef.current = onConfirm;
    setLeaveDialogOpen(true);
  }, [hasInteracted, isFormSubmitted]);

  const confirmLeave = useCallback(() => {
    setIsFormSubmitted(true);
    setLeaveDialogOpen(false);
    pendingNavRef.current?.();
    pendingNavRef.current = null;
  }, []);

  const cancelLeave = useCallback(() => {
    setLeaveDialogOpen(false);
    pendingNavRef.current = null;
  }, []);

  useEffect(() => {
    if (!hasInteracted) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasInteracted]);

  useEffect(() => {
    if (!hasInteracted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormSubmitted) return;
      const isReload =
        e.key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && e.key === 'r');
      if (!isReload) return;
      e.preventDefault();
      pendingNavRef.current = () => window.location.reload();
      setLeaveDialogOpen(true);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hasInteracted, isFormSubmitted]);

  useEffect(() => {
    if (!hasInteracted) return;
    const onPopState = () => {
      if (isFormSubmitted) return;
      window.history.pushState(null, '', window.location.href);
      pendingNavRef.current = () => navigate(-1);
      setLeaveDialogOpen(true);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [hasInteracted, navigate, isFormSubmitted]);

  useEffect(() => {
    if (!hasInteracted) return;
    const onClick = (e: MouseEvent) => {
      if (isFormSubmitted) return;
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
      e.preventDefault();
      e.stopPropagation();
      pendingNavRef.current = () => navigate(href);
      setLeaveDialogOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [hasInteracted, navigate, isFormSubmitted]);

  const handleGoBack = useCallback(() => {
    requestLeave(() => navigate(-1));
  }, [requestLeave, navigate]);

  const purchaseCurrency = useWatch({ control, name: 'purchaseCurrency' });
  const customTitle = useWatch({ control, name: 'customFields.title' });
  useEffect(() => {
    if (typeof customTitle === 'string' && customTitle) {
      setValue('title', customTitle);
    }
  }, [customTitle, setValue]);

  const tagsValue = useWatch({ control, name: 'tags' });
  const tagsList = tagsValue
    ? tagsValue.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const purchaseDate = useWatch({ control, name: 'purchaseDate' });
  const purchasePriceVal = useWatch({ control, name: 'purchasePrice' });
  const gbpRateVal = useWatch({ control, name: 'gbpRate' });
  const usdRateVal = useWatch({ control, name: 'usdRate' });
  const eurRateVal = useWatch({ control, name: 'eurRate' });
  const [fetchingRates, setFetchingRates] = useState(false);

  useEffect(() => {
    const ratesMap = buildPurchaseRatesMap({
      gbpRate: gbpRateVal,
      usdRate: usdRateVal,
      eurRate: eurRateVal,
    });
    setValue('exchangeRate', getPurchaseExchangeRateToUsd(purchaseCurrency, ratesMap));
  }, [purchaseCurrency, gbpRateVal, usdRateVal, eurRateVal, setValue]);

  useEffect(() => {
    if (!purchaseDate) {
      setValue('gbpRate', undefined);
      setValue('usdRate', undefined);
      setValue('eurRate', undefined);
      return;
    }
    let cancelled = false;
    (async () => {
      setFetchingRates(true);
      const rates = await getHistoricalPurchaseRates(purchaseDate);
      if (cancelled) {
        setFetchingRates(false);
        return;
      }
      setValue('gbpRate', rates?.gbpRate);
      setValue('usdRate', rates?.usdRate);
      setValue('eurRate', rates?.eurRate);
      setFetchingRates(false);
    })();
    return () => { cancelled = true; };
  }, [purchaseDate, setValue]);

  const [itemImages, setItemImages] = useState<string[]>(existingItem?.images ?? []);
  const [coverIndex, setCoverIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bookSearchOpen, setBookSearchOpen] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const isBookCategory = category?.id === 'cat-books';

  const handleBookSelect = useCallback(
    (book: BookSearchResult) => {
      setValue('title', book.title);
      setValue('description', `${book.title} by ${book.author}${book.publishYear ? ` (${book.publishYear})` : ''}`);
      setValue('customFields.title', book.title);
      setValue('customFields.author', book.author);
      if (book.publishYear) setValue('customFields.publishYear', book.publishYear);
      if (book.publisher) setValue('customFields.publisher', book.publisher);
      if (book.isbn) setValue('customFields.isbn', book.isbn);
      if (book.languages.length > 0) {
        const lang = book.languages[0];
        setValue('customFields.language', lang);
      }
      if (book.pageCount) {
        setValue('customFields.pageCount', book.pageCount);
      }
      if (book.coverUrlLarge) {
        setItemImages((prev) => {
          if (prev.length === 0) return [book.coverUrlLarge!];
          return [book.coverUrlLarge!, ...prev];
        });
        setCoverIndex(0);
      }
      toast.success(`Filled form with "${book.title}"`);
    },
    [setValue],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItemImages(existingItem?.images ?? []);
      setCoverIndex(0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [existingItem]);

  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      };
      img.src = url;
    });
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024;

    Array.from(files).forEach(async (file) => {
      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: Unsupported format`);
        return;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        return;
      }
      const compressed = await compressImage(file);
      setItemImages((prev) => [...prev, compressed]);
    });
  }, [compressImage]);

  const removeImage = useCallback((index: number) => {
    setItemImages((prev) => prev.filter((_, i) => i !== index));
    setCoverIndex((prev) => {
      if (index === prev) return 0;
      if (index < prev) return prev - 1;
      return prev;
    });
  }, []);

  const moveImage = useCallback((from: number, to: number) => {
    setItemImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setCoverIndex((prev) => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const onSubmit = useCallback(
    async (data: ItemFormValues, addAnother = false) => {
      if (!category) return;

      const missing: string[] = [];
      if (!data.title?.trim()) missing.push('Title');
      if (!data.condition?.trim()) missing.push('Condition');

      for (const field of sortedFields) {
        if (!field.required) continue;
        const val = (data.customFields as Record<string, unknown>)[field.key];
        const empty =
          val === undefined ||
          val === null ||
          val === '' ||
          (typeof val === 'string' && !val.trim());
        if (empty) missing.push(field.label);
      }

      if (missing.length > 0) {
        toast.error(`Please fill in: ${missing.join(', ')}`);
        return;
      }

      try {
      const customFields = normalizeCustomFields(sortedFields, data.customFields);

      const tags = data.tags
        ? data.tags.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const now = new Date().toISOString();
      const purchaseDate = data.purchaseDate || now;

      const orderedImages = coverIndex === 0 ? itemImages : [itemImages[coverIndex], ...itemImages.filter((_, i) => i !== coverIndex)];
      const finalImages = await persistItemImages(
        currentUserId,
        orderedImages,
        existingItem?.images ?? [],
      );

      const purchaseAmt = Number(data.purchasePrice) || 0;
      const ratesMap = buildPurchaseRatesMap(data);
      const exchangeRate = getPurchaseExchangeRateToUsd(data.purchaseCurrency, ratesMap);
      const currencyEquivalents = buildCurrencyEquivalents(
        purchaseAmt,
        data.purchaseCurrency,
        ratesMap,
      );
      const resolvedCurrentValuation = resolveCurrentValuationInput(
        data,
        purchaseAmt,
        existingItem,
      );

      const itemData: Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'> = {
        categoryId: category.id,
        libraryId: data.libraryId || undefined,
        title: data.title,
        description: data.description ?? '',
        customFields,
        notes: data.notes ?? '',
        tags,
        images: finalImages,
        quantity: Number(data.quantity) || 1,
        purchaseInfo: {
          purchasedAt: purchaseDate,
          purchasePrice: purchaseAmt,
          purchaseCurrency: data.purchaseCurrency,
          exchangeRateAtPurchase: exchangeRate,
          purchaseLocation: data.purchaseLocation,
          currencyEquivalents,
        },
        valuationInfo: {
          currentEstimatedValue: resolvedCurrentValuation.currentEstimatedValue,
          currentValueCurrency: resolvedCurrentValuation.currentValueCurrency,
          currentExchangeRate: resolvedCurrentValuation.currentExchangeRate,
          targetYearProjection: data.targetYear,
          targetEstimatedValue: data.targetValue ? Number(data.targetValue) || 0 : undefined,
          valueHistory: existingItem?.valuationInfo.valueHistory ?? [
            {
              date: now.slice(0, 10),
              value: resolvedCurrentValuation.currentEstimatedValue,
              currency: resolvedCurrentValuation.currentValueCurrency,
            },
          ],
        },
        contributorId: existingItem?.contributorId ?? currentUserId ?? 'offline',
        condition: data.condition,
        location: data.location || undefined,
        isRead: existingItem?.isRead ?? false,
        isFavorite: existingItem?.isFavorite ?? false,
        maintenanceLog: existingItem?.maintenanceLog ?? [],
        lendingHistory: existingItem?.lendingHistory ?? [],
      };

      setIsFormSubmitted(true);
      setHasInteracted(false);

      if (isEditMode && existingItem) {
        updateItem(existingItem.id, itemData);
        toast.success('Item updated successfully');
        navigate(`/items/${existingItem.id}`);
      } else {
        const newItem = addItem(itemData);
        toast.success('Item added successfully');
        if (addAnother) {
          setIsFormSubmitted(false);
          reset(defaultValues);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          navigate(`/items/${newItem.id}`);
        }
      }
      } catch (err) {
        console.error('Save failed:', err);
        toast.error('Failed to save item. Please try again.');
      }
    },
    [
      category,
      sortedFields,
      existingItem,
      isEditMode,
      addItem,
      updateItem,
      navigate,
      reset,
      defaultValues,
      itemImages,
      coverIndex,
      currentUserId,
    ],
  );

  if (!category && isEditMode) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <p className="text-lg text-muted-foreground">Item not found.</p>
        <Button variant="outline" asChild>
          <Link to="/collections">
            <ArrowLeft className="mr-2 size-4" />
            Back to Collections
          </Link>
        </Button>
      </div>
    );
  }

  if (!category) {
    return (
      <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title="Add New Item"
          description="Choose a collection to add your item to"
          breadcrumbs={[
            { label: 'Collections', href: '/collections' },
            { label: 'New Item' },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            const count = getItemsByCategory(cat.id).length;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSearchParams({ category: cat.slug })}
                className={cn(
                  'group relative flex items-start gap-4 rounded-xl border bg-card p-5 text-left',
                  'transition-all duration-200',
                  'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15">
                  <Icon className="size-6 text-primary" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{cat.name}</h3>
                    <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {cat.description}
                  </p>
                  <div className="flex items-center gap-3 pt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cat.fields.length} custom fields
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <Package className="size-12 text-muted-foreground/50" />
            <div>
              <p className="text-lg font-medium">No categories yet</p>
              <p className="text-sm text-muted-foreground">
                Create a category first to start adding items
              </p>
            </div>
            {canCreateCategory && (
              <Button variant="outline" asChild>
                <Link to="/admin/categories/new">
                  <Plus className="mr-2 size-4" />
                  Create Category
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <form
      onSubmit={handleSubmit(
        (data) => onSubmit(data as ItemFormValues),
        () => toast.error('Please fill in all required fields'),
      )}
      onChange={() => { if (!hasInteracted) setHasInteracted(true); }}
      className="min-h-0"
    >
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title={isEditMode ? 'Edit Item' : 'Add New Item'}
        description={`${isEditMode ? 'Update' : 'Add an item to'} ${category.name}`}
        breadcrumbs={[
          { label: 'Collections', href: '/collections' },
          { label: category.name, href: `/collections/${category.slug}` },
          { label: isEditMode ? 'Edit Item' : 'New Item' },
        ]}
      />

      {/* Book Search & Barcode Dialogs */}
      {isBookCategory && (
        <>
          <BookSearchDialog
            open={bookSearchOpen}
            onOpenChange={setBookSearchOpen}
            onSelect={handleBookSelect}
          />
          <BarcodeScannerDialog
            open={barcodeScannerOpen}
            onOpenChange={setBarcodeScannerOpen}
            onSelect={handleBookSelect}
          />
        </>
      )}

      {/* Search Open Library + Barcode */}
      {isBookCategory && (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setBookSearchOpen(true)}
            className="flex-1 gap-3 border-dashed border-2 py-6 text-base"
          >
            <Search className="size-5" />
            Search Open Library
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setBarcodeScannerOpen(true)}
            className="gap-3 border-dashed border-2 py-6 text-base"
          >
            <ScanBarcode className="size-5" />
            <span className="hidden sm:inline">Scan ISBN</span>
          </Button>
        </div>
      )}

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>
            Add photos of your item. The first image will be used as the cover.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all duration-200',
              dragOver
                ? 'border-primary bg-primary/5 shadow-inner'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <div className={cn(
              'flex size-14 items-center justify-center rounded-full transition-colors',
              dragOver ? 'bg-primary/10' : 'bg-muted',
            )}>
              <ImagePlus className={cn('size-7', dragOver ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">
                {dragOver ? 'Drop to upload' : 'Click or drag photos here'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WEBP, GIF &middot; Max 10MB each
              </p>
            </div>
          </button>

          {/* Image Grid */}
          {itemImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {itemImages.map((src, idx) => (
                <div
                  key={`img-${idx}`}
                  className={cn(
                    'group relative aspect-square overflow-hidden rounded-xl border-2 transition-all',
                    idx === coverIndex
                      ? 'border-primary shadow-lg shadow-primary/10'
                      : 'border-transparent hover:border-muted-foreground/30',
                  )}
                >
                  <img
                    src={src}
                    alt={`Item photo ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />

                  {/* Cover badge */}
                  {idx === coverIndex && (
                    <div className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                      <Star className="size-3" />
                      Cover
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex gap-1">
                      {idx !== coverIndex && (
                        <button
                          type="button"
                          onClick={() => setCoverIndex(idx)}
                          className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
                          title="Set as cover"
                        >
                          <Star className="size-3" />
                          Cover
                        </button>
                      )}
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveImage(idx, idx - 1)}
                          className="flex size-7 items-center justify-center rounded-md bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
                          title="Move left"
                        >
                          <ArrowLeft className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="flex size-7 items-center justify-center rounded-md bg-red-500/90 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-red-600"
                      title="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add more tile */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <Plus className="size-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add more</span>
              </button>
            </div>
          )}

          {itemImages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {itemImages.length} photo{itemImages.length > 1 ? 's' : ''} &middot; Hover to set cover or remove
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category-Specific Fields */}
      {sortedFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{category.name} Details</CardTitle>
            <CardDescription>
              Fields specific to {category.name.toLowerCase()} items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {sortedFields.map((field) => {
                const fullWidth =
                  field.type === 'textarea' ||
                  field.type === 'rich-notes' ||
                  field.type === 'image' ||
                  field.type === 'multi-select';
                return (
                  <div
                    key={field.id}
                    className={cn(fullWidth && 'md:col-span-2')}
                  >
                    <DynamicFieldRenderer
                      field={field}
                      control={control}
                      errors={errors}
                    />
                  </div>
                );
              })}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the item"
                  className="min-h-24"
                  {...register('description')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">
                  Condition <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="condition"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="condition"
                        className={cn(errors.condition && 'border-destructive')}
                      >
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_FORM_CONDITIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.condition && (
                  <p className="text-xs text-destructive">{errors.condition.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Enter tags separated by commas"
                  {...register('tags')}
                />
                {tagsList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tagsList.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Library & Quantity */}
      {(categoryLibraries.length > 0 || isBookCategory) && (
        <Card>
          <CardHeader>
            <CardTitle>Library & Quantity</CardTitle>
            <CardDescription>Assign to a library and set quantity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {categoryLibraries.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="libraryId">Library</Label>
                  <Controller
                    name="libraryId"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? '_unassigned'} onValueChange={(v) => field.onChange(v === '_unassigned' ? '' : v)}>
                        <SelectTrigger id="libraryId">
                          <SelectValue placeholder="Select library..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_unassigned">Unassigned</SelectItem>
                          {categoryLibraries.map((lib) => (
                            <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  placeholder="1"
                  {...register('quantity')}
                />
                <p className="text-xs text-muted-foreground">Number of copies/units owned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Information */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Information</CardTitle>
          <CardDescription>Details about how and when this item was acquired</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date</Label>
              <Input
                id="purchaseDate"
                type="date"
                {...register('purchaseDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencyService.getCurrencySymbol(purchaseCurrency)}
                </span>
                <Input
                  id="purchasePrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  {...register('purchasePrice')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseCurrency">Purchase Currency</Label>
              <Controller
                name="purchaseCurrency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="purchaseCurrency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_FORM_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {currencyService.getCurrencySymbol(c)} {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseLocation">Purchase Location</Label>
              <Input
                id="purchaseLocation"
                placeholder="Where was it purchased?"
                {...register('purchaseLocation')}
              />
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                Currency Equivalents at Purchase Date
                {fetchingRates && <span className="text-xs font-normal text-muted-foreground animate-pulse">Fetching rates...</span>}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tarih seçildiğinde kurlar otomatik dolar. İsterseniz manuel değiştirebilirsiniz.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {([['GBP', 'gbpRate', gbpRateVal, '£'] as const, ['USD', 'usdRate', usdRateVal, '$'] as const, ['EUR', 'eurRate', eurRateVal, '€'] as const]).map(([cur, key, rateVal, symbol]) => {
                const rate = Number(rateVal) || 0;
                const price = Number(purchasePriceVal) || 0;
                const ratesMap = buildPurchaseRatesMap({
                  gbpRate: gbpRateVal,
                  usdRate: usdRateVal,
                  eurRate: eurRateVal,
                });
                const equivalentValue = getEquivalentForDisplay(price, purchaseCurrency, cur, ratesMap);
                const equivalent = equivalentValue !== null ? equivalentValue.toFixed(2) : '—';
                return (
                  <div key={cur} className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <Label htmlFor={key} className="text-xs">
                      1 {cur} = {rate > 0 ? <span className="font-semibold">{rate.toFixed(2)} TL</span> : <span className="text-muted-foreground">? TL</span>}
                    </Label>
                    <input type="hidden" {...register(key)} />
                    <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{symbol}</span>
                      <span className="font-semibold">{equivalent}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Add detailed notes about this item</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Write any additional notes, history, or observations..."
            className="min-h-36"
            {...register('notes')}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleGoBack}
          >
            <X className="mr-1.5 size-4" />
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={handleSubmit(
                  (data) => onSubmit(data as ItemFormValues, true),
                  () => toast.error('Please fill in all required fields'),
                )}
              >
                <Plus className="mr-1.5 size-4" />
                Save &amp; Add Another
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              <Save className="mr-1.5 size-4" />
              {isEditMode ? 'Update Item' : 'Save Item'}
            </Button>
          </div>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      <Dialog open={leaveDialogOpen} onOpenChange={(open) => { if (!open) cancelLeave(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="size-5 text-amber-500" />
              </div>
              <div>
                <DialogTitle>Unsaved Changes</DialogTitle>
                <DialogDescription className="mt-1">
                  You have unsaved changes that will be lost if you leave this page.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelLeave}>
              Stay on Page
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Leave Page
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </form>
    </PageTransition>
  );
}
