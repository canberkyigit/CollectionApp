import { useState } from 'react';
import { Check, ExternalLink, Sparkles } from 'lucide-react';

import { useT } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ReviewField } from '@/services/catalogEnrichmentService';

/**
 * Per-field accept/reject list for lookup and AI suggestions. Rows that would
 * replace something the user typed start unticked — nothing is overwritten
 * without an explicit choice.
 */
export function SuggestionReview({
  rows,
  providerName,
  notes,
  externalUrl,
  confidence,
  onApply,
  onBack,
  backLabel,
}: {
  rows: ReviewField[];
  providerName: string;
  notes?: string;
  externalUrl?: string;
  confidence?: number;
  onApply: (rows: ReviewField[]) => void;
  onBack: () => void;
  backLabel: string;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter((row) => !row.conflict).map((row) => row.id)),
  );

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const chosen = rows.filter((row) => selected.has(row.id));

  return (
    <div className="flex min-h-0 flex-col">
      <div className="space-y-2 border-b bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            {t('itemForm.review.summary', { provider: providerName })}
            {confidence !== undefined && (
              <Badge variant="secondary" className="text-[10px] tabular-nums">
                {t('itemForm.review.confidence', { value: Math.round(confidence * 100) })}
              </Badge>
            )}
          </span>
          {externalUrl && (
            <a href={externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t('itemForm.review.viewSource', { provider: providerName })}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>
        {notes && <p className="text-sm text-muted-foreground">{notes}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="size-7 text-emerald-500" aria-hidden="true" />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">{t('itemForm.review.nothingNew')}</p>
        </div>
      ) : (
        <ul className="max-h-[420px] divide-y overflow-y-auto">
          {rows.map((row) => {
            const id = `review-${row.id}`;
            const isChecked = selected.has(row.id);
            return (
              <li key={row.id} className={cn('flex items-start gap-3 px-6 py-3.5 transition-colors', isChecked ? 'bg-primary/5' : 'hover:bg-muted/50')}>
                <Checkbox id={id} checked={isChecked} onCheckedChange={(checked) => toggle(row.id, checked === true)} className="mt-0.5" />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer space-y-0.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{row.label}</span>
                  {row.target.kind === 'image' ? (
                    <img src={row.target.url} alt="" className="h-20 w-20 rounded-md border object-cover shadow-sm" loading="lazy" />
                  ) : (
                    <span className="block whitespace-pre-line break-words text-sm text-foreground">{row.display}</span>
                  )}
                  {row.conflict && row.current && (
                    <span className="block text-xs text-amber-700 dark:text-amber-400">
                      {t('itemForm.review.replaces', { value: row.current })}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>{backLabel}</Button>
        <Button type="button" disabled={chosen.length === 0} onClick={() => onApply(chosen)}>
          <Check aria-hidden="true" />
          {t('itemForm.review.apply', { count: chosen.length })}
        </Button>
      </div>
    </div>
  );
}
