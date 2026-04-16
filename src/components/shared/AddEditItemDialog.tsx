import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Save, Plus, HelpCircle, ImagePlus, Trash2, Star,
  BookOpen, Search, Loader2, ExternalLink, ChevronRight, Upload, ScanBarcode, AlertTriangle,
} from 'lucide-react';
import type { CategoryField, ItemSourceMetadata } from '@/types';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  ITEM_FORM_CONDITIONS,
  ITEM_FORM_CURRENCIES,
  ITEM_FORM_HIDDEN_CUSTOM_KEYS,
  buildItemFormSubmission,
  buildPurchaseRatesMap,
  getEquivalentForDisplay,
  getHistoricalPurchaseRates,
  getMissingItemFormFields,
  getPurchaseExchangeRateToUsd,
  itemToFormValues,
  type ItemFormValues,
} from '@/lib/itemForm';
import { currencyService } from '@/services/currencyService';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';
import { catalogEnrichmentService } from '@/services/catalogEnrichmentService';
import { BarcodeScannerDialog } from '@/components/shared/BarcodeScannerDialog';

function DynamicFieldRenderer({
  field, control, errors,
}: {
  field: CategoryField;
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
}) {
  const fieldError = errors?.customFields?.[field.key];

  const wrapper = (children: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cf-${field.key}`} className="flex items-center gap-1 text-sm">
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
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <Input id={`cf-${field.key}`} placeholder={field.placeholder}
              className={cn(fieldError && 'border-destructive')} {...f} value={(f.value as string) ?? ''} />
          )} />,
      );
    case 'textarea':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <Textarea id={`cf-${field.key}`} placeholder={field.placeholder} rows={2}
              className={cn('min-h-16', fieldError && 'border-destructive')} {...f} value={(f.value as string) ?? ''} />
          )} />,
      );
    case 'number':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <Input id={`cf-${field.key}`} type="number" placeholder={field.placeholder}
              className={cn(fieldError && 'border-destructive')} {...f} value={(f.value as number | string) ?? ''}
              onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
          )} />,
      );
    case 'date':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <Input id={`cf-${field.key}`} type="date"
              className={cn(fieldError && 'border-destructive')} {...f} value={(f.value as string) ?? ''} />
          )} />,
      );
    case 'select':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <Select value={(f.value as string) ?? ''} onValueChange={f.onChange}>
              <SelectTrigger id={`cf-${field.key}`} className={cn(fieldError && 'border-destructive')}>
                <SelectValue placeholder={field.placeholder ?? 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.filter((opt) => opt !== '').map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )} />,
      );
    case 'multi-select':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
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
                        <Checkbox checked={isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked ? [...selected, opt] : selected.filter((s) => s !== opt);
                            f.onChange(next.join(', '));
                          }} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    );
                  })}
                </div>
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                  </div>
                )}
              </div>
            );
          }} />,
      );
    case 'currency':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input id={`cf-${field.key}`} type="number" step="0.01"
                placeholder={field.placeholder ?? '0.00'}
                className={cn('pl-7', fieldError && 'border-destructive')}
                {...f} value={(f.value as number | string) ?? ''}
                onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
            </div>
          )} />,
      );
    case 'boolean':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <div className="flex items-center gap-2 pt-1">
              <Switch id={`cf-${field.key}`} checked={!!f.value} onCheckedChange={f.onChange} />
              <span className="text-sm text-muted-foreground">{f.value ? 'Yes' : 'No'}</span>
            </div>
          )} />,
      );
    case 'image':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={() => (
            <div className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30',
              fieldError ? 'border-destructive' : 'border-input',
            )}>
              <Upload className="size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Drop images or click to upload</p>
            </div>
          )} />,
      );
    case 'tags':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => {
            const tagList = f.value ? (f.value as string).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
            return (
              <div className="space-y-1.5">
                <Input id={`cf-${field.key}`} placeholder={field.placeholder ?? 'Enter tags separated by commas'}
                  className={cn(fieldError && 'border-destructive')} {...f} value={(f.value as string) ?? ''} />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tagList.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                  </div>
                )}
              </div>
            );
          }} />,
      );
    case 'rich-notes':
      return wrapper(
        <Controller name={`customFields.${field.key}`} control={control}
          render={({ field: f }) => (
            <Textarea id={`cf-${field.key}`} placeholder={field.placeholder} rows={3}
              className={cn('min-h-20', fieldError && 'border-destructive')} {...f} value={(f.value as string) ?? ''} />
          )} />,
      );
    default:
      return null;
  }
}

function BookSearchDialog({
  open, onOpenChange, onSelect,
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
      if (!q.trim()) { setResults([]); setSearched(false); }
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

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  }, [doSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            Search Open Library
          </DialogTitle>
          <DialogDescription>Search millions of books and auto-fill your form</DialogDescription>
        </DialogHeader>
        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={inputRef} value={query} onChange={(e) => handleInput(e.target.value)}
              placeholder="Type at least 3 characters to search..." className="pl-9 pr-4"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(debounceRef.current); doSearch(query); } }} />
            {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
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
                <p className="mt-1 text-sm text-muted-foreground">Type a title, author name, or ISBN to get started</p>
              </div>
            </div>
          )}
          {searched && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Search className="size-10 text-muted-foreground/30" />
              <p className="font-medium">No results found</p>
              <p className="text-sm text-muted-foreground">Try a different search term</p>
            </div>
          )}
          {results.length > 0 && (
            <div className="divide-y">
              {results.map((book) => (
                <button key={book.key} type="button"
                  className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50"
                  onClick={() => { onSelect(book); onOpenChange(false); }}>
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt={book.title}
                      className="h-20 w-14 shrink-0 rounded-md border object-cover shadow-sm" loading="lazy" />
                  ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <BookOpen className="size-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold leading-tight">{book.title}</p>
                    <p className="text-sm text-muted-foreground">{book.author}</p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {book.publishYear && <Badge variant="secondary" className="text-[10px]">{book.publishYear}</Badge>}
                      {book.publisher && <Badge variant="outline" className="max-w-[200px] truncate text-[10px]">{book.publisher}</Badge>}
                      {book.pageCount && <Badge variant="outline" className="text-[10px]">{book.pageCount} pages</Badge>}
                      {book.isbn && <Badge variant="outline" className="text-[10px] font-mono">ISBN: {book.isbn}</Badge>}
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
            <ExternalLink className="size-3" />Powered by Open Library
          </p>
          {results.length > 0 && <p className="text-xs text-muted-foreground">{results.length} results</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isAbortLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || String(error.message).includes('abort');
}

export function AddEditItemDialog() {
  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.uid && user.uid !== 'offline' ? user.uid : null;
  const {
    itemDialogOpen, itemDialogCategoryId, itemDialogItem, closeItemDialog,
    items: allItems, getCategoryById, getLibrariesByCategory, addItem, updateItem,
  } = useCollectionStore();

  const isEditMode = !!itemDialogItem;
  const existingItem = itemDialogItem;

  const category = useMemo(
    () => (itemDialogCategoryId ? getCategoryById(itemDialogCategoryId) : undefined),
    [itemDialogCategoryId, getCategoryById],
  );

  const sortedFields = useMemo(
    () => [...(category?.fields ?? [])].filter((f) => !ITEM_FORM_HIDDEN_CUSTOM_KEYS.has(f.key)).sort((a, b) => a.order - b.order),
    [category],
  );

  const categoryLibraries = useMemo(
    () => (category ? getLibrariesByCategory(category.id) : []),
    [category, getLibrariesByCategory],
  );

  const isBookCategory = category?.id === 'cat-books';

  const defaultValues = useMemo<ItemFormValues>(() => {
    if (existingItem && category) {
      return itemToFormValues(existingItem, sortedFields);
    }
    const customDefaults: Record<string, unknown> = {};
    for (const field of sortedFields) {
      if (field.defaultValue !== undefined) customDefaults[field.key] = field.defaultValue;
      else if (field.type === 'boolean') customDefaults[field.key] = false;
      else customDefaults[field.key] = '';
    }
    return {
      title: '', description: '', condition: '', location: '', tags: '',
      customFields: customDefaults as Record<string, unknown>,
      purchaseDate: '', purchasePrice: undefined, purchaseCurrency: 'TRY',
      purchaseLocation: '', exchangeRate: undefined,
      currentValue: undefined, currentValueCurrency: '',
      targetYear: 2030, targetValue: undefined,
      notes: '', libraryId: '', quantity: 1,
      eurRate: undefined, usdRate: undefined, gbpRate: undefined,
    };
  }, [existingItem, category, sortedFields]);

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } =
    useForm<ItemFormValues>({ defaultValues });

  useEffect(() => { reset(defaultValues); }, [defaultValues, reset]);

  const purchaseCurrency = useWatch({ control, name: 'purchaseCurrency' });
  const watchedTitle = useWatch({ control, name: 'title' });
  const watchedIsbn = useWatch({ control, name: 'customFields.isbn' }) as string | undefined;
  const customTitle = useWatch({ control, name: 'customFields.title' });

  const duplicateWarning = useMemo(() => {
    if (!category || !itemDialogCategoryId) return null;
    const categoryItems = allItems.filter((i) => i.categoryId === itemDialogCategoryId && i.id !== existingItem?.id);
    if (watchedTitle && watchedTitle.trim().length > 2) {
      const titleLower = watchedTitle.trim().toLowerCase();
      const titleMatch = categoryItems.find((i) => i.title.toLowerCase() === titleLower);
      if (titleMatch) return `"${titleMatch.title}" already exists in this category.`;
    }
    if (watchedIsbn && watchedIsbn.trim().length >= 10) {
      const isbnVal = watchedIsbn.trim();
      const isbnMatch = categoryItems.find((i) => {
        const itemIsbn = i.customFields?.isbn as string | undefined;
        return itemIsbn && itemIsbn.trim() === isbnVal;
      });
      if (isbnMatch) return `ISBN already used by "${isbnMatch.title}".`;
    }
    return null;
  }, [watchedTitle, watchedIsbn, allItems, itemDialogCategoryId, existingItem?.id, category]);
  useEffect(() => {
    if (typeof customTitle === 'string' && customTitle) setValue('title', customTitle);
  }, [customTitle, setValue]);

  const tagsValue = useWatch({ control, name: 'tags' });
  const tagsList = tagsValue ? tagsValue.split(',').map((s) => s.trim()).filter(Boolean) : [];

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

  // Images
  const [itemImages, setItemImages] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bookSearchOpen, setBookSearchOpen] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [sourceMetadata, setSourceMetadata] = useState<ItemSourceMetadata | undefined>(
    existingItem?.sourceMetadata,
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItemImages(existingItem?.images ?? []);
      setSourceMetadata(existingItem?.sourceMetadata);
      setCoverIndex(0);
      setBookSearchOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [existingItem, itemDialogOpen]);

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
      if (!allowed.includes(file.type)) { toast.error(`${file.name}: Unsupported format`); return; }
      if (file.size > maxSize) { toast.error(`${file.name}: File too large (max 10MB)`); return; }
      const compressed = await compressImage(file);
      setItemImages((prev) => [...prev, compressed]);
    });
  }, [compressImage]);

  const removeImage = useCallback((idx: number) => {
    setItemImages((prev) => prev.filter((_, i) => i !== idx));
    setCoverIndex((prev) => {
      if (idx === prev) return 0;
      if (idx < prev) return prev - 1;
      return prev;
    });
  }, []);

  const handleBookSelect = useCallback((book: BookSearchResult) => {
    const suggestion = catalogEnrichmentService.fromBookSearchResult(book);
    setValue('title', suggestion.title);
    setValue('description', suggestion.description);
    for (const [key, value] of Object.entries(suggestion.customFields)) {
      setValue(`customFields.${key}`, value);
    }
    if (suggestion.images[0]) {
      setItemImages((prev) => (prev.length === 0 ? [suggestion.images[0]] : [suggestion.images[0], ...prev]));
      setCoverIndex(0);
    }
    setSourceMetadata(suggestion.sourceMetadata);
    toast.success(`Filled form with "${suggestion.title}"`);
  }, [setValue]);

  const onSubmit = useCallback(
    async (data: ItemFormValues, addAnother = false) => {
      if (!category) return;
      const missing = getMissingItemFormFields(sortedFields, data);
      if (missing.length > 0) { toast.error(`Please fill in: ${missing.join(', ')}`); return; }

      try {
        const itemData = await buildItemFormSubmission({
          category,
          fields: sortedFields,
          data,
          itemImages,
          coverIndex,
          currentUserId,
          existingItem: existingItem ?? undefined,
          sourceMetadata,
        });

        if (isEditMode && existingItem) {
          updateItem(existingItem.id, itemData);
          toast.success('Item updated successfully');
          closeItemDialog();
        } else {
          addItem(itemData);
          toast.success('Item added successfully');
          if (addAnother) {
            reset(defaultValues);
            setItemImages([]);
            setSourceMetadata(undefined);
            setCoverIndex(0);
          } else {
            closeItemDialog();
          }
        }
      } catch {
        toast.error('Failed to save item. Please try again.');
      }
    },
    [category, sortedFields, existingItem, isEditMode, addItem, updateItem, closeItemDialog, reset, defaultValues, itemImages, coverIndex, currentUserId, sourceMetadata],
  );

  if (!itemDialogOpen) return null;

  return (
    <>
      {isBookCategory && (
        <>
          <BookSearchDialog open={bookSearchOpen} onOpenChange={setBookSearchOpen} onSelect={handleBookSelect} />
          <BarcodeScannerDialog open={barcodeScannerOpen} onOpenChange={setBarcodeScannerOpen} onSelect={handleBookSelect} />
        </>
      )}

      <Dialog open={itemDialogOpen} onOpenChange={(open) => { if (!open) closeItemDialog(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Item' : `Add to ${category?.name ?? 'Collection'}`}</DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Update the details for this item.' : `Add a new item to your ${category?.name?.toLowerCase() ?? 'collection'}.`}
            </DialogDescription>
          </DialogHeader>

          {duplicateWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Possible duplicate: {duplicateWarning}</span>
            </div>
          )}

          <div className="grid gap-4 py-2">
            {/* Book search + barcode buttons */}
            {isBookCategory && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setBookSearchOpen(true)}
                  className="flex-1 gap-2 border-dashed border-2">
                  <Search className="size-4" />
                  Search Open Library
                </Button>
                <Button type="button" variant="outline" onClick={() => setBarcodeScannerOpen(true)}
                  className="gap-2 border-dashed border-2">
                  <ScanBarcode className="size-4" />
                  <span className="hidden sm:inline">Scan ISBN</span>
                </Button>
              </div>
            )}

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Photos</Label>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
              {itemImages.length === 0 ? (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  className={cn(
                    'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-all',
                    dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
                  )}>
                  <ImagePlus className={cn('size-8', dragOver ? 'text-primary' : 'text-muted-foreground')} />
                  <p className="text-sm text-muted-foreground">Click or drag photos here</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF &middot; Max 10MB</p>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {itemImages.map((src, idx) => (
                      <div key={`img-${idx}`}
                        className={cn(
                          'group relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
                          idx === coverIndex ? 'border-primary shadow-md' : 'border-transparent hover:border-muted-foreground/30',
                        )}>
                        <img src={src} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                        {idx === coverIndex && (
                          <div className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                            <Star className="inline size-2.5" /> Cover
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                          {idx !== coverIndex && (
                            <button type="button" onClick={() => setCoverIndex(idx)}
                              className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-medium text-gray-800 hover:bg-white">
                              <Star className="inline size-2.5" /> Cover
                            </button>
                          )}
                          <button type="button" onClick={() => removeImage(idx)}
                            className="rounded bg-red-500/90 p-1 text-white hover:bg-red-600">
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50 hover:bg-muted/30">
                      <Plus className="size-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Add</span>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {itemImages.length} photo{itemImages.length > 1 ? 's' : ''} &middot; Hover to set cover or remove
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dlg-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dlg-title"
                placeholder="Item title"
                {...register('title', { required: 'Title is required' })}
              />
            </div>

            {/* Category-specific custom fields */}
            {sortedFields.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sortedFields.map((field) => {
                  const fullWidth = field.type === 'textarea' || field.type === 'rich-notes' || field.type === 'image' || field.type === 'multi-select';
                  return (
                    <div key={field.id} className={cn(fullWidth && 'sm:col-span-2')}>
                      <DynamicFieldRenderer field={field} control={control} errors={errors} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-description">Description</Label>
              <Textarea id="dlg-description" placeholder="Brief description..." rows={2} {...register('description')} />
            </div>

            {/* Condition + Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dlg-condition">Condition <span className="text-destructive">*</span></Label>
                <Controller name="condition" control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="dlg-condition" className={cn(errors.condition && 'border-destructive')}>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_FORM_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dlg-tags">Tags</Label>
                <Input id="dlg-tags" placeholder="comma separated" {...register('tags')} />
              </div>
            </div>
            {tagsList.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tagsList.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            )}

            {/* Library & Quantity */}
            {(categoryLibraries.length > 0 || isBookCategory) && (
              <div className="grid grid-cols-2 gap-3">
                {categoryLibraries.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Library</Label>
                    <Controller name="libraryId" control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? '_unassigned'} onValueChange={(v) => field.onChange(v === '_unassigned' ? '' : v)}>
                          <SelectTrigger><SelectValue placeholder="Select library..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_unassigned">Unassigned</SelectItem>
                            {categoryLibraries.map((lib) => <SelectItem key={lib.id} value={lib.id}>{lib.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="dlg-quantity">Quantity</Label>
                  <Input id="dlg-quantity" type="number" min={1} placeholder="1" {...register('quantity')} />
                </div>
              </div>
            )}

            <Separator />

            {/* Purchase Information */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Purchase Information</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dlg-pdate">Purchase Date</Label>
                  <Input id="dlg-pdate" type="date" {...register('purchaseDate')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dlg-pprice">Purchase Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currencyService.getCurrencySymbol(purchaseCurrency)}
                    </span>
                    <Input id="dlg-pprice" type="number" step="0.01" placeholder="0.00" className="pl-7" {...register('purchasePrice')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Controller name="purchaseCurrency" control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ITEM_FORM_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencyService.getCurrencySymbol(c)} {c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dlg-ploc">Purchase Location</Label>
                  <Input id="dlg-ploc" placeholder="Where was it purchased?" {...register('purchaseLocation')} />
                </div>
              </div>

              {/* Currency equivalents */}
              {(Number(purchasePriceVal) > 0) && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    Currency Equivalents
                    {fetchingRates && <span className="animate-pulse">Fetching rates...</span>}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([['GBP', gbpRateVal, '£'] as const, ['USD', usdRateVal, '$'] as const, ['EUR', eurRateVal, '€'] as const]).map(([cur, rateVal, symbol]) => {
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
                        <div key={cur} className="rounded-md border bg-muted/30 px-2.5 py-2 text-center">
                          <p className="text-[10px] text-muted-foreground">1 {cur} = {rate > 0 ? `${rate.toFixed(2)} TL` : '? TL'}</p>
                          <p className="text-sm font-semibold">{symbol}{equivalent}</p>
                        </div>
                      );
                    })}
                  </div>
                  <input type="hidden" {...register('gbpRate')} />
                  <input type="hidden" {...register('usdRate')} />
                  <input type="hidden" {...register('eurRate')} />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="dlg-notes">Notes</Label>
              <Textarea id="dlg-notes" placeholder="Any additional notes..." rows={2} {...register('notes')} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeItemDialog}>Cancel</Button>
            <div className="flex items-center gap-2">
              {!isEditMode && (
                <Button type="button" variant="outline" disabled={isSubmitting}
                  onClick={handleSubmit((data) => onSubmit(data as ItemFormValues, true), () => toast.error('Please fill in all required fields'))}>
                  <Plus className="mr-1 size-3.5" />
                  Save &amp; Add Another
                </Button>
              )}
              <Button disabled={isSubmitting}
                onClick={handleSubmit((data) => onSubmit(data as ItemFormValues), () => toast.error('Please fill in all required fields'))}>
                <Save className="mr-1 size-3.5" />
                {isEditMode ? 'Update Item' : 'Save Item'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
