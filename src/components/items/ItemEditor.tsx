import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import {
  AlertTriangle, Coins, Disc3, FileText, ImagePlus, MapPin, Plus, Receipt, Save, ScanBarcode, ScanSearch,
  Search, Sparkles, StickyNote, TrendingUp, X,
} from 'lucide-react';

import type { Category, CollectionItem, ItemSourceMetadata } from '@/types';
import type { ItemDialogPrefill } from '@/store/collectionStore.types';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarcodeScannerDialog } from '@/components/shared/BarcodeScannerDialog';
import { cn, formatCurrency, todayISO } from '@/lib/utils';
import { getCollectibleKind, getConditionLabelKey, getConditionOptions } from '@/lib/conditionScales';
import {
  ITEM_FORM_CURRENCIES,
  ITEM_FORM_HIDDEN_CUSTOM_KEYS,
  buildEmptyFormValues,
  buildItemFormSubmission,
  buildPurchaseRatesMap,
  getEquivalentForDisplay,
  getHistoricalPurchaseRates,
  getLocationSuggestions,
  getMissingItemFormFields,
  getPurchaseExchangeRateToUsd,
  itemToFormValues,
  type ItemFormValues,
} from '@/lib/itemForm';
import { currencyService } from '@/services/currencyService';
import type { BookSearchResult } from '@/services/bookSearchService';
import {
  catalogEnrichmentService,
  providerLabel,
  type CatalogCandidate,
  type ReviewField,
} from '@/services/catalogEnrichmentService';
import { EditorField, EditorSection } from '@/components/items/EditorSection';
import { DynamicField } from '@/components/items/DynamicField';
import { isFullWidthField } from '@/components/items/itemEditorUtils';
import { PhotoManager } from '@/components/items/PhotoManager';
import { useItemPhotos } from '@/components/items/useItemPhotos';
import { BookSearchDialog } from '@/components/items/BookSearchDialog';
import { CatalogLookupDialog } from '@/components/items/CatalogLookupDialog';
import { AiIdentifyDialog } from '@/components/items/AiIdentifyDialog';

export interface ItemEditorSaveResult {
  item: CollectionItem;
  created: boolean;
  addAnother: boolean;
}

export interface ItemEditorProps {
  /** `page` = full route editor, `dialog` = compact modal. Same fields and behaviour. */
  variant: 'page' | 'dialog';
  category: Category;
  existingItem?: CollectionItem;
  /** Seed values for a new item (e.g. from a wishlist entry). Ignored when editing. */
  prefill?: ItemDialogPrefill | null;
  /** When set, creating the item marks this wishlist entry as acquired. */
  wishlistId?: string;
  onSaved: (result: ItemEditorSaveResult) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const RATE_ROWS = [
  { currency: 'GBP', key: 'gbpRate' },
  { currency: 'USD', key: 'usdRate' },
  { currency: 'EUR', key: 'eurRate' },
] as const;

/**
 * The one item editor. Used by the full-page route (`/items/new`,
 * `/items/:id/edit`) and by the global add/edit dialog so the two can't drift.
 */
export function ItemEditor({
  variant,
  category,
  existingItem,
  prefill,
  wishlistId,
  onSaved,
  onCancel,
  onDirtyChange,
}: ItemEditorProps) {
  const t = useT();
  const dense = variant === 'dialog';
  const p = dense ? 'dlg-' : '';
  const isEditMode = !!existingItem;

  const user = useAuthStore((state) => state.user);
  const currentUserId = user?.uid && user.uid !== 'offline' ? user.uid : null;
  const allItems = useCollectionStore((state) => state.items);
  const libraries = useCollectionStore((state) => state.libraries);
  const getLibrariesByCategory = useCollectionStore((state) => state.getLibrariesByCategory);
  const addItem = useCollectionStore((state) => state.addItem);
  const updateItem = useCollectionStore((state) => state.updateItem);
  const acquireWishlistItem = useCollectionStore((state) => state.acquireWishlistItem);
  const displayCurrency = useCollectionStore((state) => state.displayCurrency);

  const fields = useMemo(
    () => [...category.fields]
      .filter((field) => !ITEM_FORM_HIDDEN_CUSTOM_KEYS.has(field.key))
      .sort((a, b) => a.order - b.order),
    [category],
  );
  // libraries is read so the memo refreshes when libraries change.
  const categoryLibraries = useMemo(
    () => (libraries ? getLibrariesByCategory(category.id) : []),
    [category.id, getLibrariesByCategory, libraries],
  );
  const locationSuggestions = useMemo(() => getLocationSuggestions(allItems), [allItems]);
  const kind = getCollectibleKind(category);

  const [initialValues] = useState<ItemFormValues>(() => (
    existingItem ? itemToFormValues(existingItem, fields) : buildEmptyFormValues(fields, prefill)
  ));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ItemFormValues>({ defaultValues: initialValues });

  const photos = useItemPhotos(existingItem?.images ?? (isEditMode ? [] : prefill?.images ?? []));
  const [sourceMetadata, setSourceMetadata] = useState<ItemSourceMetadata | undefined>(existingItem?.sourceMetadata);
  const [interacted, setInteracted] = useState(false);
  const markDirty = useCallback(() => setInteracted(true), []);
  const dirty = interacted || isDirty;
  const [pendingWishlistId, setPendingWishlistId] = useState(isEditMode ? undefined : wishlistId);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const [bookSearchOpen, setBookSearchOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  /* ---------------------------- watched values --------------------------- */

  const purchaseCurrency = useWatch({ control, name: 'purchaseCurrency' });
  const currentValueCurrency = useWatch({ control, name: 'currentValueCurrency' });
  const watchedTitle = useWatch({ control, name: 'title' });
  const watchedCondition = useWatch({ control, name: 'condition' });
  const watchedIsbn = useWatch({ control, name: 'customFields.isbn' }) as string | undefined;
  const customTitle = useWatch({ control, name: 'customFields.title' });
  const tagsValue = useWatch({ control, name: 'tags' });
  const purchaseDate = useWatch({ control, name: 'purchaseDate' });
  const purchasePriceVal = useWatch({ control, name: 'purchasePrice' });
  const gbpRateVal = useWatch({ control, name: 'gbpRate' });
  const usdRateVal = useWatch({ control, name: 'usdRate' });
  const eurRateVal = useWatch({ control, name: 'eurRate' });
  const [fetchingRates, setFetchingRates] = useState(false);

  const tagsList = tagsValue ? tagsValue.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  const conditionOptions = useMemo(
    () => getConditionOptions(category, watchedCondition),
    [category, watchedCondition],
  );

  useEffect(() => {
    if (typeof customTitle === 'string' && customTitle) setValue('title', customTitle);
  }, [customTitle, setValue]);

  useEffect(() => {
    const ratesMap = buildPurchaseRatesMap({ gbpRate: gbpRateVal, usdRate: usdRateVal, eurRate: eurRateVal });
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
      if (cancelled) return;
      setValue('gbpRate', rates?.gbpRate);
      setValue('usdRate', rates?.usdRate);
      setValue('eurRate', rates?.eurRate);
      setFetchingRates(false);
    })();
    return () => {
      cancelled = true;
      setFetchingRates(false);
    };
  }, [purchaseDate, setValue]);

  const duplicateWarning = useMemo(() => {
    const categoryItems = allItems.filter(
      (entry) => entry.categoryId === category.id && entry.id !== existingItem?.id && !entry.isArchived,
    );
    if (watchedTitle && watchedTitle.trim().length > 2) {
      const lower = watchedTitle.trim().toLowerCase();
      const match = categoryItems.find((entry) => entry.title.toLowerCase() === lower);
      if (match) return t('itemForm.duplicate.title', { title: match.title });
    }
    if (watchedIsbn && String(watchedIsbn).trim().length >= 10) {
      const isbn = String(watchedIsbn).trim();
      const match = categoryItems.find((entry) => String(entry.customFields?.isbn ?? '').trim() === isbn);
      if (match) return t('itemForm.duplicate.isbn', { title: match.title });
    }
    return null;
  }, [allItems, category.id, existingItem?.id, watchedTitle, watchedIsbn, t]);

  /* ------------------------------ lookups -------------------------------- */

  const handleBookSelect = useCallback((book: BookSearchResult) => {
    const suggestion = catalogEnrichmentService.fromBookSearchResult(book);
    setValue('title', suggestion.title, { shouldDirty: true });
    setValue('description', suggestion.description, { shouldDirty: true });
    for (const [key, value] of Object.entries(suggestion.customFields)) {
      setValue(`customFields.${key}`, value, { shouldDirty: true });
    }
    if (suggestion.images[0]) photos.addImageUrl(suggestion.images[0], true);
    setSourceMetadata(suggestion.sourceMetadata);
    markDirty();
    toast.success(t('itemForm.toast.filled', { title: suggestion.title }));
  }, [markDirty, photos, setValue, t]);

  const buildRows = useCallback((candidate: CatalogCandidate): ReviewField[] => {
    const values = getValues();
    return catalogEnrichmentService.buildReviewFields(candidate, {
      fields,
      conditionOptions: getConditionOptions(category, values.condition).map((grade) => grade.value),
      current: {
        title: values.title,
        description: values.description,
        tags: values.tags,
        condition: values.condition,
        customFields: values.customFields ?? {},
        currentValue: values.currentValue,
        currentValueCurrency: values.currentValueCurrency,
        images: photos.images,
      },
    });
  }, [category, fields, getValues, photos.images]);

  const applyCandidate = useCallback((candidate: CatalogCandidate, rows: ReviewField[]) => {
    const opts = { shouldDirty: true } as const;
    for (const row of rows) {
      const { target } = row;
      switch (target.kind) {
        case 'title':
          setValue('title', String(row.value), opts);
          break;
        case 'description':
          setValue('description', String(row.value), opts);
          break;
        case 'tags':
          setValue('tags', String(row.value), opts);
          break;
        case 'condition':
          setValue('condition', String(row.value), opts);
          break;
        case 'customField':
          setValue(`customFields.${target.key}`, row.value, opts);
          break;
        case 'image':
          photos.addImageUrl(target.url, photos.images.length === 0);
          break;
        case 'currentValue':
          setValue('currentValue', Number(row.value), opts);
          setValue('currentValueCurrency', target.currency, opts);
          setValue('valuationSource', target.source, opts);
          setValue('valuedAt', todayISO(), opts);
          break;
      }
    }
    setSourceMetadata(catalogEnrichmentService.buildCandidateSourceMetadata(candidate, rows.map((row) => row.id)));
    markDirty();
    toast.success(t('itemForm.toast.applied', { count: rows.length, provider: providerLabel(candidate.provider) }));
  }, [markDirty, photos, setValue, t]);

  const lookupProvider = kind === 'vinyl' ? 'discogs' : kind === 'coins' ? 'numista' : null;
  const lookupQuery = useCallback(() => {
    const values = getValues();
    const cf = values.customFields ?? {};
    const pick = (...keys: string[]) => keys.map((key) => cf[key]).find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    if (lookupProvider === 'discogs') {
      return pick('barcode', 'catalogNumber') ?? [pick('artist'), values.title].filter(Boolean).join(' ');
    }
    return values.title || [pick('country'), pick('denomination'), cf.year].filter(Boolean).join(' ');
  }, [getValues, lookupProvider]);

  /* ------------------------------- submit -------------------------------- */

  const submit = useCallback(async (data: ItemFormValues, addAnother: boolean) => {
    const missing = getMissingItemFormFields(fields, data);
    if (missing.length > 0) {
      toast.error(t('itemForm.toast.missingFields', { fields: missing.join(', ') }));
      return;
    }

    try {
      const itemData = await buildItemFormSubmission({
        category,
        fields,
        data,
        itemImages: photos.images,
        coverIndex: photos.coverIndex,
        currentUserId,
        existingItem,
        sourceMetadata,
      });

      if (existingItem) {
        updateItem(existingItem.id, itemData);
        toast.success(t('itemForm.toast.updated'));
        setInteracted(false);
        onSaved({ item: { ...existingItem, ...itemData }, created: false, addAnother: false });
        return;
      }

      const created = addItem(itemData);
      const newId = created?.id;
      if (pendingWishlistId && newId) {
        acquireWishlistItem(pendingWishlistId, newId);
        setPendingWishlistId(undefined);
      }
      toast.success(t('itemForm.toast.created'));

      if (addAnother) {
        reset(buildEmptyFormValues(fields));
        photos.resetImages([]);
        setSourceMetadata(undefined);
      }
      setInteracted(false);
      onSaved({ item: created ?? ({ ...itemData, id: '', createdAt: '', updatedAt: '' } as CollectionItem), created: true, addAnother });
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(t('itemForm.toast.saveFailed'));
    }
  }, [acquireWishlistItem, addItem, category, currentUserId, existingItem, fields, onSaved, pendingWishlistId, photos, reset, sourceMetadata, t, updateItem]);

  const onInvalid = useCallback(() => toast.error(t('itemForm.toast.requiredFields')), [t]);

  /* ------------------------------- render -------------------------------- */

  const ratesMap = buildPurchaseRatesMap({ gbpRate: gbpRateVal, usdRate: usdRateVal, eurRate: eurRateVal });
  const priceNumber = Number(purchasePriceVal) || 0;
  // Page: original two-column grid from md; dialog: two columns from sm.
  const grid = dense ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'grid grid-cols-1 gap-6 md:grid-cols-2';
  const span = dense ? 'sm:col-span-2' : 'md:col-span-2';
  const effectiveValueCurrency = currentValueCurrency || purchaseCurrency;
  const lookupButton = cn('gap-2 border-2 border-dashed', dense ? '' : 'gap-3 py-6 text-base');
  const lookupIcon = dense ? 'size-4' : 'size-5';

  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit((data) => submit(data, false), onInvalid)}
        onChange={markDirty}
        className={cn(dense ? 'grid gap-5' : 'space-y-4 sm:space-y-6 md:space-y-8')}
      >
        {duplicateWarning && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {/* Quick fill: catalogue lookups and AI, as the original dashed search buttons. */}
        <div className="space-y-2" role="group" aria-labelledby={`${p}quick-fill`}>
          <p
            id={`${p}quick-fill`}
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            {t('itemForm.section.lookup')}
          </p>
          <div className={cn('flex flex-wrap', dense ? 'gap-2' : 'gap-3')}>
            {kind === 'books' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size={dense ? 'default' : 'lg'}
                  onClick={() => setBookSearchOpen(true)}
                  className={cn(lookupButton, 'flex-1')}
                >
                  <Search className={lookupIcon} aria-hidden="true" />
                  {t('itemForm.bookSearch.title')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size={dense ? 'default' : 'lg'}
                  onClick={() => setScannerOpen(true)}
                  aria-label={t('itemForm.bookSearch.scan')}
                  className={lookupButton}
                >
                  <ScanBarcode className={lookupIcon} aria-hidden="true" />
                  <span className="hidden sm:inline">{t('itemForm.bookSearch.scan')}</span>
                </Button>
              </>
            )}
            {lookupProvider && (
              <Button
                type="button"
                variant="outline"
                size={dense ? 'default' : 'lg'}
                onClick={() => setLookupOpen(true)}
                className={cn(lookupButton, 'flex-1')}
              >
                {lookupProvider === 'discogs'
                  ? <Disc3 className={lookupIcon} aria-hidden="true" />
                  : <Coins className={lookupIcon} aria-hidden="true" />}
                {t('itemForm.lookup.button', { provider: providerLabel(lookupProvider) })}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size={dense ? 'default' : 'lg'}
              onClick={() => setAiOpen(true)}
              className={cn(
                lookupButton,
                'border-primary/30 text-primary hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
                kind !== 'books' && !lookupProvider && 'flex-1',
              )}
            >
              <ScanSearch className={lookupIcon} aria-hidden="true" />
              {t('itemForm.ai.button')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('itemForm.section.lookupDescription')}</p>
        </div>

        <EditorSection
          dense={dense}
          icon={ImagePlus}
          title={t('itemForm.section.photos')}
          description={t('itemForm.section.photosDescription')}
        >
          <PhotoManager photos={photos} onChange={markDirty} dense={dense} />
        </EditorSection>

        <EditorSection
          dense={dense}
          icon={FileText}
          title={t('itemForm.section.details')}
          description={t('itemForm.section.detailsDescription', { name: category.name })}
        >
          <div className={grid}>
            <EditorField
              id={`${p}title`}
              label={t('itemForm.field.title')}
              required
              dense={dense}
              error={errors.title?.message}
              className={span}
            >
              <Input
                id={`${p}title`}
                placeholder={t('itemForm.field.titlePlaceholder')}
                aria-invalid={!!errors.title}
                className={cn(errors.title && 'border-destructive')}
                {...register('title', { required: t('itemForm.validation.titleRequired') })}
              />
            </EditorField>

            {fields.map((field) => (
              <div key={field.id} className={cn(isFullWidthField(field) && span)}>
                <DynamicField field={field} control={control} errors={errors} idPrefix={p} dense={dense} />
              </div>
            ))}

            <EditorField id={`${p}description`} label={t('itemForm.field.description')} dense={dense} className={span}>
              <Textarea
                id={`${p}description`}
                placeholder={t('itemForm.field.descriptionPlaceholder')}
                rows={dense ? 2 : 3}
                className={cn(!dense && 'min-h-24')}
                {...register('description')}
              />
            </EditorField>

            <EditorField id={`${p}condition`} label={t('itemForm.field.condition')} required dense={dense}>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(value) => { field.onChange(value); markDirty(); }}>
                    <SelectTrigger id={`${p}condition`}>
                      <SelectValue placeholder={t('itemForm.field.conditionPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {conditionOptions.map((grade) => {
                        const labelKey = getConditionLabelKey(grade.value);
                        return (
                          <SelectItem key={grade.value} value={grade.value}>
                            {labelKey ? t(labelKey) : grade.value}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
            </EditorField>

            <EditorField id={`${p}tags`} label={t('itemForm.field.tags')} hint={t('itemForm.tags.hint')} dense={dense}>
              <Input id={`${p}tags`} placeholder={t('itemForm.tags.placeholder')} {...register('tags')} />
            </EditorField>
            {tagsList.length > 0 && (
              <div className={cn('flex flex-wrap gap-1.5', span, dense ? '-mt-1' : '-mt-3')}>
                {tagsList.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
              </div>
            )}
          </div>
        </EditorSection>

        <EditorSection
          dense={dense}
          icon={MapPin}
          title={t('itemForm.section.storage')}
          description={t('itemForm.section.storageDescription')}
        >
          <div className={grid}>
            <EditorField
              id={`${p}location`}
              label={t('itemForm.field.location')}
              hint={t('itemForm.field.locationHint')}
              dense={dense}
              className={span}
            >
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id={`${p}location`}
                  list={`${p}location-options`}
                  autoComplete="off"
                  placeholder={t('itemForm.field.locationPlaceholder')}
                  className="pl-9"
                  {...register('location')}
                />
              </div>
              <datalist id={`${p}location-options`}>
                {locationSuggestions.map((location) => <option key={location} value={location} />)}
              </datalist>
            </EditorField>

            {categoryLibraries.length > 0 && (
              <EditorField id={`${p}libraryId`} label={t('itemForm.field.library')} dense={dense}>
                <Controller
                  name="libraryId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || '_unassigned'}
                      onValueChange={(value) => { field.onChange(value === '_unassigned' ? '' : value); markDirty(); }}
                    >
                      <SelectTrigger id={`${p}libraryId`}>
                        <SelectValue placeholder={t('itemForm.field.libraryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_unassigned">{t('itemForm.field.libraryUnassigned')}</SelectItem>
                        {categoryLibraries.map((library) => (
                          <SelectItem key={library.id} value={library.id}>{library.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </EditorField>
            )}

            <EditorField id={`${p}quantity`} label={t('itemForm.field.quantity')} hint={t('itemForm.field.quantityHint')} dense={dense}>
              <Input id={`${p}quantity`} type="number" min={1} inputMode="numeric" className="tabular-nums dark:[color-scheme:dark]" placeholder="1" {...register('quantity')} />
            </EditorField>
          </div>
        </EditorSection>

        <EditorSection
          dense={dense}
          icon={Receipt}
          title={t('itemForm.section.purchase')}
          description={t('itemForm.section.purchaseDescription')}
        >
          <div className={grid}>
            <EditorField id={`${p}purchaseDate`} label={t('itemForm.field.purchaseDate')} dense={dense}>
              <Controller
                name="purchaseDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id={`${p}purchaseDate`}
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={(value) => { field.onChange(value); markDirty(); }}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
            </EditorField>

            <EditorField id={`${p}purchasePrice`} label={t('itemForm.field.purchasePrice')} dense={dense}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">
                  {currencyService.getCurrencySymbol(purchaseCurrency)}
                </span>
                <Input
                  id={`${p}purchasePrice`}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-8 tabular-nums dark:[color-scheme:dark]"
                  {...register('purchasePrice')}
                />
              </div>
            </EditorField>

            <EditorField id={`${p}purchaseCurrency`} label={t('itemForm.field.purchaseCurrency')} dense={dense}>
              <Controller
                name="purchaseCurrency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => { field.onChange(value); markDirty(); }}>
                    <SelectTrigger id={`${p}purchaseCurrency`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_FORM_CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currencyService.getCurrencySymbol(currency)} {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </EditorField>

            <EditorField id={`${p}purchaseLocation`} label={t('itemForm.field.purchaseLocation')} dense={dense}>
              <Input id={`${p}purchaseLocation`} placeholder={t('itemForm.field.purchaseLocationPlaceholder')} {...register('purchaseLocation')} />
            </EditorField>
          </div>

          {(priceNumber > 0 || !!purchaseDate) && (
            <>
              {!dense && <Separator />}
              <div className={dense ? 'space-y-2' : 'space-y-4'}>
                <div>
                  <h4
                    className={cn(
                      'flex items-center gap-2',
                      dense ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-semibold',
                    )}
                  >
                    {t('itemForm.purchase.equivalentsTitle')}
                    {fetchingRates && (
                      <span className="animate-pulse text-xs font-normal text-muted-foreground">
                        {t('itemForm.purchase.fetchingRates')}
                      </span>
                    )}
                  </h4>
                  {!dense && <p className="mt-0.5 text-xs text-muted-foreground">{t('itemForm.purchase.ratesHint')}</p>}
                </div>
                <div className={cn('grid', dense ? 'grid-cols-3 gap-2' : 'grid-cols-1 gap-4 md:grid-cols-3')}>
                  {RATE_ROWS.map(({ currency, key }) => {
                    const rate = Number(key === 'gbpRate' ? gbpRateVal : key === 'usdRate' ? usdRateVal : eurRateVal) || 0;
                    const equivalent = getEquivalentForDisplay(priceNumber, purchaseCurrency, currency, ratesMap);
                    const rateLabel = rate > 0
                      ? t('itemForm.purchase.rate', { currency, rate: rate.toFixed(2) })
                      : t('itemForm.purchase.rateUnknown', { currency });
                    const formatted = equivalent !== null ? formatCurrency(equivalent, currency) : '—';
                    return dense ? (
                      <div key={currency} className="rounded-md border bg-muted/30 px-2.5 py-2 text-center">
                        <Label htmlFor={`${p}${key}`} className="block text-[10px] font-normal tabular-nums leading-tight text-muted-foreground">
                          {rateLabel}
                        </Label>
                        <output id={`${p}${key}`} className="mt-0.5 block text-sm font-semibold tabular-nums">
                          {formatted}
                        </output>
                        <input type="hidden" {...register(key)} />
                      </div>
                    ) : (
                      <div key={currency} className="space-y-2 rounded-lg border bg-muted/30 p-3">
                        <Label htmlFor={`${p}${key}`} className="block text-xs tabular-nums">
                          {rateLabel}
                        </Label>
                        <output
                          id={`${p}${key}`}
                          className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{currency}</span>
                          <span className="font-semibold tabular-nums">{formatted}</span>
                        </output>
                        <input type="hidden" {...register(key)} />
                      </div>
                    );
                  })}
                </div>
                {dense && <p className="text-xs text-muted-foreground">{t('itemForm.purchase.ratesHint')}</p>}
              </div>
            </>
          )}
        </EditorSection>

        <EditorSection
          dense={dense}
          icon={TrendingUp}
          title={t('itemForm.section.valuation')}
          description={t('itemForm.section.valuationDescription')}
        >
          <div className={grid}>
            <EditorField
              id={`${p}currentValue`}
              label={t('itemForm.field.currentValue')}
              hint={isEditMode ? t('itemForm.field.currentValueHintEdit') : t('itemForm.field.currentValueHint')}
              dense={dense}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">
                  {currencyService.getCurrencySymbol(effectiveValueCurrency)}
                </span>
                <Input
                  id={`${p}currentValue`}
                  type="number"
                  step="0.01"
                  min={0}
                  inputMode="decimal"
                  placeholder={priceNumber > 0 ? String(priceNumber) : '0.00'}
                  className="pl-8 tabular-nums dark:[color-scheme:dark]"
                  {...register('currentValue')}
                />
              </div>
            </EditorField>

            <EditorField id={`${p}currentValueCurrency`} label={t('itemForm.field.valueCurrency')} dense={dense}>
              <Controller
                name="currentValueCurrency"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || effectiveValueCurrency}
                    onValueChange={(value) => { field.onChange(value); markDirty(); }}
                  >
                    <SelectTrigger id={`${p}currentValueCurrency`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set([...ITEM_FORM_CURRENCIES, effectiveValueCurrency])].filter(Boolean).map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currencyService.getCurrencySymbol(currency)} {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </EditorField>

            <EditorField id={`${p}valuedAt`} label={t('itemForm.field.valuedAt')} hint={t('itemForm.field.valuedAtHint')} dense={dense}>
              <Controller
                name="valuedAt"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id={`${p}valuedAt`}
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={(value) => { field.onChange(value); markDirty(); }}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                )}
              />
            </EditorField>

            <EditorField id={`${p}valuationSource`} label={t('itemForm.field.valuationSource')} dense={dense}>
              <Input
                id={`${p}valuationSource`}
                placeholder={t('itemForm.field.valuationSourcePlaceholder')}
                {...register('valuationSource')}
              />
            </EditorField>

            <EditorField id={`${p}targetYear`} label={t('itemForm.field.targetYear')} dense={dense}>
              <Input
                id={`${p}targetYear`}
                type="number"
                min={new Date().getFullYear()}
                max={2100}
                inputMode="numeric"
                className="tabular-nums dark:[color-scheme:dark]"
                {...register('targetYear')}
              />
            </EditorField>

            <EditorField id={`${p}targetValue`} label={t('itemForm.field.targetValue')} hint={t('itemForm.field.targetValueHint')} dense={dense}>
              <Input
                id={`${p}targetValue`}
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                placeholder="0.00"
                className="tabular-nums dark:[color-scheme:dark]"
                {...register('targetValue')}
              />
            </EditorField>
          </div>
        </EditorSection>

        <EditorSection
          dense={dense}
          icon={StickyNote}
          title={t('itemForm.section.notes')}
          description={dense ? undefined : t('itemForm.section.notesDescription')}
        >
          <Textarea
            id={`${p}notes`}
            aria-label={t('itemForm.section.notes')}
            placeholder={t('itemForm.field.notesPlaceholder')}
            rows={dense ? 3 : 5}
            className={cn(!dense && 'min-h-36')}
            {...register('notes')}
          />
        </EditorSection>

        <div
          className={cn(
            'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between',
            dense
              ? 'sticky -bottom-6 z-10 -mx-6 -mb-6 rounded-b-2xl border-t bg-popover/95 px-6 py-4 backdrop-blur-md'
              : 'gap-3 rounded-xl border bg-card p-4',
          )}
        >
          <Button type="button" variant={dense ? 'outline' : 'ghost'} onClick={onCancel}>
            {!dense && <X className="size-4" aria-hidden="true" />}
            {t('common.cancel')}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={handleSubmit((data) => submit(data, true), onInvalid)}
              >
                <Plus className={dense ? 'size-3.5' : 'size-4'} aria-hidden="true" />
                {t('itemForm.action.saveAndAddAnother')}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              <Save className={dense ? 'size-3.5' : 'size-4'} aria-hidden="true" />
              {isEditMode ? t('itemForm.action.update') : t('itemForm.action.save')}
            </Button>
          </div>
        </div>
      </form>

      {kind === 'books' && (
        <>
          <BookSearchDialog open={bookSearchOpen} onOpenChange={setBookSearchOpen} onSelect={handleBookSelect} />
          <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onSelect={handleBookSelect} />
        </>
      )}
      {lookupProvider && lookupOpen && (
        <CatalogLookupDialog
          open
          onOpenChange={setLookupOpen}
          provider={lookupProvider}
          initialQuery={lookupQuery()}
          buildRows={buildRows}
          onApply={applyCandidate}
        />
      )}
      {aiOpen && (
        <AiIdentifyDialog
          open
          onOpenChange={setAiOpen}
          images={photos.images}
          coverIndex={photos.coverIndex}
          category={category}
          fields={fields}
          conditionOptions={conditionOptions.map((grade) => grade.value)}
          currency={currentValueCurrency || purchaseCurrency || displayCurrency}
          hint={[getValues('title'), getValues('notes')].filter(Boolean).join('\n')}
          buildRows={buildRows}
          onApply={applyCandidate}
        />
      )}
    </>
  );
}
