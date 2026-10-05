import { useState } from 'react';

import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import type { CategoryField } from '@/types';

import { BULK_EDITABLE_TYPES, coerceBulkFieldValue } from './bulkFieldValue';

interface BulkFieldPopoverProps {
  fields: CategoryField[];
  disabled: boolean;
  disabledReason?: string;
  onApply: (field: CategoryField, value: unknown) => void;
}

export function BulkFieldPopover({ fields, disabled, disabledReason, onApply }: BulkFieldPopoverProps) {
  const t = useT();
  const editable = fields.filter((field) => BULK_EDITABLE_TYPES.has(field.type));
  const [open, setOpen] = useState(false);
  const [fieldKey, setFieldKey] = useState('');
  const [raw, setRaw] = useState('');
  const [clear, setClear] = useState(false);
  const field = editable.find((entry) => entry.key === fieldKey);
  const value = field && !clear ? coerceBulkFieldValue(field, raw) : undefined;
  const canApply = Boolean(field) && (clear || value !== undefined);

  const reset = () => {
    setRaw('');
    setClear(false);
  };

  const apply = () => {
    if (!field || !canApply) return;
    onApply(field, clear ? undefined : value);
    reset();
    setOpen(false);
  };

  const renderInput = () => {
    if (!field) return null;
    const common = { id: 'bulk-field-value', disabled: clear };
    switch (field.type) {
      case 'boolean':
        return (
          <Select value={raw} onValueChange={setRaw} disabled={clear}>
            <SelectTrigger id="bulk-field-value"><SelectValue placeholder={t('bulk.field.choose')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">{t('common.yes')}</SelectItem>
              <SelectItem value="false">{t('common.no')}</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'select':
        return (
          <Select value={raw} onValueChange={setRaw} disabled={clear}>
            <SelectTrigger id="bulk-field-value"><SelectValue placeholder={t('bulk.field.choose')} /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'number':
      case 'currency':
        return <Input {...common} inputMode="decimal" value={raw} onChange={(event) => setRaw(event.target.value)} className="tabular-nums" />;
      case 'date':
        return <Input {...common} type="date" value={raw} onChange={(event) => setRaw(event.target.value)} />;
      case 'multi-select':
      case 'tags':
        return (
          <>
            <Input {...common} value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={field.options?.join(', ')} />
            <p className="text-xs text-muted-foreground">{t('bulk.field.listHint')}</p>
          </>
        );
      default:
        return <Input {...common} value={raw} onChange={(event) => setRaw(event.target.value)} placeholder={field.placeholder} />;
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled || editable.length === 0}
          title={disabled ? disabledReason : undefined}
        >
          <SlidersHorizontal className="size-4" />
          {t('bulk.field.button')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
          {t('bulk.field.title')}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-field-key" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('bulk.field.field')}</Label>
          <Select value={fieldKey} onValueChange={(next) => { setFieldKey(next); reset(); }}>
            <SelectTrigger id="bulk-field-key"><SelectValue placeholder={t('bulk.field.choose')} /></SelectTrigger>
            <SelectContent>
              {editable.map((entry) => (
                <SelectItem key={entry.key} value={entry.key}>{entry.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field && (
          <div className="space-y-1.5">
            <Label htmlFor="bulk-field-value" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t('bulk.field.value')}</Label>
            {renderInput()}
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
              <Checkbox id="bulk-field-clear" checked={clear} onCheckedChange={(checked) => setClear(checked === true)} />
              <Label htmlFor="bulk-field-clear" className="text-sm font-normal">{t('bulk.field.clear')}</Label>
            </div>
          </div>
        )}
        <Button size="sm" className="w-full" onClick={apply} disabled={!canApply}>
          {t('bulk.apply')}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
