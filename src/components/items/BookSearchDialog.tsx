import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChevronRight, ExternalLink, Loader2, Search } from 'lucide-react';

import { useT } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';
import { isAbortLike } from '@/components/items/itemEditorUtils';

/** Open Library search; picking a result fills the form straight away. */
export function BookSearchDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (book: BookSearchResult) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const close = () => {
    clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setSearched(false);
    onOpenChange(false);
  };

  const doSearch = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (value.length < 3) {
      if (!value) {
        setResults([]);
        setSearched(false);
      }
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      setResults(await bookSearchService.search(value, 12));
    } catch (error: unknown) {
      if (isAbortLike(error)) return;
      toast.error(t('itemForm.bookSearch.failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" aria-hidden="true" />
            {t('itemForm.bookSearch.title')}
          </DialogTitle>
          <DialogDescription>{t('itemForm.bookSearch.description')}</DialogDescription>
        </DialogHeader>

        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => handleInput(event.target.value)}
              placeholder={t('itemForm.bookSearch.placeholder')}
              aria-label={t('itemForm.bookSearch.title')}
              className="pl-9 pr-9"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  clearTimeout(debounceRef.current);
                  doSearch(query);
                }
              }}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[420px]">
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
                <BookOpen className="size-8 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium">{t('itemForm.bookSearch.emptyTitle')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('itemForm.bookSearch.emptyDescription')}</p>
              </div>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Search className="size-10 text-muted-foreground/30" aria-hidden="true" />
              <p className="font-medium">{t('itemForm.lookup.noResults')}</p>
              <p className="text-sm text-muted-foreground">{t('itemForm.lookup.noResultsHint')}</p>
            </div>
          )}

          {results.length > 0 && (
            <ul className="divide-y">
              {results.map((book) => (
                <li key={book.key}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => {
                      onSelect(book);
                      close();
                    }}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded-md border object-cover shadow-sm" loading="lazy" />
                    ) : (
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                        <BookOpen className="size-6 text-muted-foreground/50" aria-hidden="true" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold leading-tight">{book.title}</p>
                      <p className="text-sm text-muted-foreground">{book.author}</p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {book.publishYear && <Badge variant="secondary" className="text-[10px] tabular-nums">{book.publishYear}</Badge>}
                        {book.publisher && <Badge variant="outline" className="max-w-[200px] truncate text-[10px]">{book.publisher}</Badge>}
                        {book.pageCount && (
                          <Badge variant="outline" className="text-[10px] tabular-nums">
                            {t('itemForm.bookSearch.pages', { count: book.pageCount })}
                          </Badge>
                        )}
                        {book.isbn && <Badge variant="outline" className="font-mono text-[10px]">ISBN: {book.isbn}</Badge>}
                      </div>
                    </div>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ExternalLink className="size-3" aria-hidden="true" />
            {t('itemForm.bookSearch.poweredBy')}
          </span>
          {results.length > 0 && <span className="tabular-nums">{t('itemForm.lookup.resultCount', { count: results.length })}</span>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
