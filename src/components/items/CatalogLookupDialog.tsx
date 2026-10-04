import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Coins, Disc3, ExternalLink, KeyRound, Loader2, Search } from 'lucide-react';

import { useT } from '@/i18n';
import { useIntegrationKey, type IntegrationKey } from '@/lib/integrationKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  providerLabel,
  type CatalogCandidate,
  type CatalogProvider,
  type ReviewField,
} from '@/services/catalogEnrichmentService';
import { discogsService } from '@/services/discogsService';
import { numistaService } from '@/services/numistaService';
import { SuggestionReview } from '@/components/items/SuggestionReview';
import { INTEGRATIONS_SETTINGS_PATH, useLookupErrorMessage } from '@/components/items/itemEditorUtils';

/** Explains where to add an API key. Opens Settings in a new tab so the draft survives. */
export function MissingKeyNotice({ provider }: { provider: CatalogProvider }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-amber-500/10">
        <KeyRound className="size-7 text-amber-500" aria-hidden="true" />
      </div>
      <div>
        <p className="font-medium">{t('itemForm.lookup.noKeyTitle', { provider: providerLabel(provider) })}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {t(`itemForm.lookup.noKeyDescription.${provider}`)}
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="mt-1">
        <a href={INTEGRATIONS_SETTINGS_PATH} target="_blank" rel="noreferrer">
          {t('itemForm.lookup.openIntegrations')}
          <ExternalLink aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}

interface LookupResultRow {
  id: number;
  title: string;
  subtitle: string;
  thumb?: string;
}

type LookupProvider = Extract<CatalogProvider, 'discogs' | 'numista'>;

const KEY_FOR_PROVIDER: Record<LookupProvider, IntegrationKey> = {
  discogs: 'discogs',
  numista: 'numista',
};

async function searchProvider(provider: LookupProvider, query: string, signal: AbortSignal): Promise<LookupResultRow[]> {
  if (provider === 'discogs') {
    const results = await discogsService.search(query, signal);
    return results.map((result) => ({
      id: result.id,
      title: result.title,
      subtitle: [result.year, result.country, result.label[0], result.catno, result.format.slice(0, 2).join(', ')]
        .filter(Boolean).join(' · '),
      thumb: result.thumb,
    }));
  }
  const results = await numistaService.search(query, signal);
  return results.map((result) => ({
    id: result.id,
    title: result.title,
    subtitle: [result.issuer, result.minYear === result.maxYear || !result.maxYear ? result.minYear : `${result.minYear}–${result.maxYear}`]
      .filter(Boolean).join(' · '),
    thumb: result.thumbnail,
  }));
}

function loadDetails(provider: LookupProvider, id: number, signal: AbortSignal): Promise<CatalogCandidate> {
  return provider === 'discogs' ? discogsService.getRelease(id, signal) : numistaService.getType(id, signal);
}

/**
 * Search Discogs (records) or Numista (coins), pick a match, then review
 * which fields to copy into the form.
 */
export function CatalogLookupDialog({
  open,
  onOpenChange,
  provider,
  initialQuery,
  buildRows,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: LookupProvider;
  initialQuery?: string;
  buildRows: (candidate: CatalogCandidate) => ReviewField[];
  onApply: (candidate: CatalogCandidate, rows: ReviewField[]) => void;
}) {
  const t = useT();
  const errorMessage = useLookupErrorMessage();
  const apiKey = useIntegrationKey(KEY_FOR_PROVIDER[provider]);
  const name = providerLabel(provider);
  const ProviderIcon = provider === 'discogs' ? Disc3 : Coins;
  const [query, setQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<LookupResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CatalogCandidate | null>(null);
  const [rows, setRows] = useState<ReviewField[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = () => {
    abortRef.current?.abort();
    setResults(null);
    setCandidate(null);
    setError(null);
    setLoading(false);
    onOpenChange(false);
  };

  const run = async <T,>(task: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      return await task(controller.signal);
    } catch (caught) {
      if (controller.signal.aborted) return undefined;
      setError(errorMessage(caught, provider));
      return undefined;
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    const found = await run((signal) => searchProvider(provider, query, signal));
    if (found) setResults(found);
  };

  const pick = async (row: LookupResultRow) => {
    const details = await run((signal) => loadDetails(provider, row.id, signal));
    if (!details) return;
    setCandidate(details);
    setRows(buildRows(details));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ProviderIcon className="size-5 text-primary" aria-hidden="true" />
            {t('itemForm.lookup.title', { provider: name })}
          </DialogTitle>
          <DialogDescription>{t(`itemForm.lookup.description.${provider}`)}</DialogDescription>
        </DialogHeader>

        {!apiKey ? (
          <MissingKeyNotice provider={provider} />
        ) : candidate ? (
          <SuggestionReview
            key={candidate.externalId}
            rows={rows}
            providerName={name}
            externalUrl={candidate.externalUrl}
            onBack={() => setCandidate(null)}
            backLabel={t('itemForm.lookup.backToResults')}
            onApply={(chosen) => {
              onApply(candidate, chosen);
              close();
            }}
          />
        ) : (
          <>
            <form
              className="flex gap-2 border-b px-6 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void search();
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t(`itemForm.lookup.placeholder.${provider}`)}
                  aria-label={t('itemForm.lookup.title', { provider: name })}
                  className="pl-9"
                />
              </div>
              <Button type="submit" disabled={loading || !query.trim()}>
                {loading && !results ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                {t('common.search')}
              </Button>
            </form>

            <div className="max-h-[420px] overflow-y-auto">
              {error && (
                <p role="alert" className="mx-6 my-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              )}
              {loading && results && (
                <p className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t('common.loading')}
                </p>
              )}
              {results && results.length === 0 && !loading && !error && (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <Search className="size-10 text-muted-foreground/30" aria-hidden="true" />
                  <p className="font-medium">{t('itemForm.lookup.noResults')}</p>
                  <p className="text-sm text-muted-foreground">{t('itemForm.lookup.noResultsHint')}</p>
                </div>
              )}
              {results && results.length > 0 && (
                <ul className="divide-y">
                  {results.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void pick(row)}
                        className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none disabled:opacity-60"
                      >
                        {row.thumb ? (
                          <img src={row.thumb} alt="" className="size-14 shrink-0 rounded-md border object-cover shadow-sm" loading="lazy" />
                        ) : (
                          <div className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                            <ProviderIcon className="size-6 text-muted-foreground/50" aria-hidden="true" />
                          </div>
                        )}
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block truncate font-semibold leading-tight">{row.title}</span>
                          {row.subtitle && <span className="block truncate text-sm text-muted-foreground">{row.subtitle}</span>}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!results && !error && !loading && (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <ProviderIcon className="size-8 text-primary" aria-hidden="true" />
                  </div>
                  <p className="max-w-sm text-sm text-muted-foreground">{t(`itemForm.lookup.hint.${provider}`)}</p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
