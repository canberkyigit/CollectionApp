import { useState } from 'react';
import { AlertTriangle, Save, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/i18n';
import { ITEM_FORM_CURRENCIES } from '@/lib/itemForm';
import { todayISO } from '@/lib/utils';
import type { ValueHistoryEntry } from '@/types';

function ValuationEntryForm({
  defaultCurrency,
  onCancel,
  onSubmit,
}: {
  defaultCurrency: string;
  onCancel: () => void;
  onSubmit: (entry: ValueHistoryEntry) => void;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currencies = ITEM_FORM_CURRENCIES as readonly string[];
  const today = todayISO();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(value);
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError(t('itemDetail.valuation.error.value'));
      return;
    }
    if (!date) {
      setError(t('itemDetail.valuation.error.date'));
      return;
    }
    if (date > today) {
      setError(t('itemDetail.valuation.error.future'));
      return;
    }
    onSubmit({
      date,
      value: amount,
      currency,
      ...(source.trim() ? { source: source.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor="valuation-value">{t('itemDetail.valuation.field.value')}</Label>
          <Input
            id="valuation-value"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className="tabular-nums"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            placeholder="0.00"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valuation-currency">{t('itemDetail.valuation.field.currency')}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="valuation-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(currencies.includes(currency) ? currencies : [currency, ...currencies]).map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="valuation-date">{t('itemDetail.valuation.field.date')}</Label>
        <Input
          id="valuation-date"
          type="date"
          max={today}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setError(null);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="valuation-source">{t('itemDetail.valuation.field.source')}</Label>
        <Input
          id="valuation-source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder={t('itemDetail.valuation.field.sourcePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="valuation-note">{t('itemDetail.valuation.field.note')}</Label>
        <Textarea
          id="valuation-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit">
          <Save className="size-3.5" />
          {t('itemDetail.valuation.save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ValuationEntryDialog({
  open,
  onOpenChange,
  defaultCurrency,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
  onSubmit: (entry: ValueHistoryEntry) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent"
              aria-hidden="true"
            >
              <TrendingUp className="size-5 text-primary" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>{t('itemDetail.valuation.addTitle')}</DialogTitle>
              <DialogDescription>{t('itemDetail.valuation.addDescription')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <ValuationEntryForm
          defaultCurrency={defaultCurrency}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
