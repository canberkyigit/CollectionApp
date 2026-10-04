import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageOff, Loader2, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react';

import type { Category, CategoryField } from '@/types';
import { useT } from '@/i18n';
import { useIntegrationKey } from '@/lib/integrationKeys';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { aiCatalogService, type AiIdentifyResult } from '@/services/aiCatalogService';
import type { CatalogCandidate, ReviewField } from '@/services/catalogEnrichmentService';
import { SuggestionReview } from '@/components/items/SuggestionReview';
import { MissingKeyNotice } from '@/components/items/CatalogLookupDialog';
import { useLookupErrorMessage } from '@/components/items/itemEditorUtils';

/** "Identify from photo": send one photo to Claude, then review its suggestions field by field. */
export function AiIdentifyDialog({
  open,
  onOpenChange,
  images,
  coverIndex,
  category,
  fields,
  conditionOptions,
  currency,
  hint,
  buildRows,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  coverIndex: number;
  category: Pick<Category, 'name'>;
  fields: CategoryField[];
  conditionOptions: string[];
  currency: string;
  hint?: string;
  buildRows: (candidate: CatalogCandidate) => ReviewField[];
  onApply: (candidate: CatalogCandidate, rows: ReviewField[]) => void;
}) {
  const t = useT();
  const errorMessage = useLookupErrorMessage();
  const apiKey = useIntegrationKey('anthropic');
  const [selectedIndex, setSelectedIndex] = useState(() => (images[coverIndex] ? coverIndex : 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiIdentifyResult | null>(null);
  const [rows, setRows] = useState<ReviewField[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = () => {
    abortRef.current?.abort();
    onOpenChange(false);
  };

  const identify = async () => {
    const image = images[selectedIndex];
    if (!image) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const identified = await aiCatalogService.identify({
        image,
        category,
        fields,
        conditionOptions,
        currency,
        hint,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setResult(identified);
      setRows(buildRows(identified.candidate));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(errorMessage(caught, 'claude'));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            {t('itemForm.ai.title')}
          </DialogTitle>
          <DialogDescription>{t('itemForm.ai.description')}</DialogDescription>
        </DialogHeader>

        {!apiKey ? (
          <MissingKeyNotice provider="claude" />
        ) : result ? (
          <>
            {!result.identified && (
              <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t('itemForm.ai.notIdentified')}</span>
              </div>
            )}
            <SuggestionReview
              rows={rows}
              providerName="Claude"
              notes={result.notes}
              confidence={result.candidate.confidence}
              onBack={() => setResult(null)}
              backLabel={t('itemForm.ai.tryAgain')}
              onApply={(chosen) => {
                onApply(result.candidate, chosen);
                close();
              }}
            />
          </>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <ImageOff className="size-8 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium">{t('itemForm.ai.noPhotoTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('itemForm.ai.noPhotoDescription')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            {images.length > 1 && (
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t('itemForm.ai.choosePhoto')}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {images.map((src, index) => (
                    <button
                      key={`${index}-${src.slice(-16)}`}
                      type="button"
                      aria-pressed={index === selectedIndex}
                      aria-label={t('itemForm.photos.alt', { index: index + 1 })}
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        'size-20 overflow-hidden rounded-xl border-2 transition-all',
                        index === selectedIndex
                          ? 'border-primary shadow-lg shadow-primary/10'
                          : 'border-transparent hover:-translate-y-0.5 hover:border-muted-foreground/30',
                      )}
                    >
                      <img src={src} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {images.length === 1 && (
              <img src={images[0]} alt="" className="h-40 w-40 rounded-xl border-2 border-primary object-cover shadow-lg shadow-primary/10" />
            )}
            <p className="flex items-start gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{t('itemForm.ai.privacy')}</span>
            </p>
            {error && (
              <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={close}>{t('common.cancel')}</Button>
              <Button type="button" onClick={() => void identify()} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ScanSearch aria-hidden="true" />}
                {loading ? t('itemForm.ai.identifying') : t('itemForm.ai.identify')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
