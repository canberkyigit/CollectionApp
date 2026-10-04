import type { ReactNode } from 'react';
import { HelpCircle, ImagePlus } from 'lucide-react';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';

import type { CategoryField } from '@/types';
import { useT } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ItemFormValues } from '@/lib/itemForm';
import { EditorField } from '@/components/items/EditorSection';

function splitList(value: unknown): string[] {
  return typeof value === 'string'
    ? value.split(',').map((entry) => entry.trim()).filter(Boolean)
    : [];
}

/** Renders one category-defined field (all 11 field types) bound to `customFields.<key>`. */
export function DynamicField({
  field,
  control,
  errors,
  idPrefix,
  dense,
}: {
  field: CategoryField;
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
  idPrefix: string;
  dense?: boolean;
}) {
  const t = useT();
  const id = `${idPrefix}cf-${field.key}`;
  const fieldError = errors?.customFields?.[field.key];
  const errorClass = fieldError ? 'border-destructive' : undefined;
  const name = `customFields.${field.key}` as const;

  const wrap = (node: ReactNode) => (
    <EditorField
      id={id}
      label={field.label}
      required={field.required}
      dense={dense}
      hint={field.helpText ? (
        <span className="flex items-center gap-1">
          <HelpCircle className="size-3 shrink-0" aria-hidden="true" />
          {field.helpText}
        </span>
      ) : undefined}
      error={fieldError?.message as string | undefined}
    >
      {node}
    </EditorField>
  );

  switch (field.type) {
    case 'text':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => (
          <Input id={id} placeholder={field.placeholder} className={errorClass}
            {...f} value={(f.value as string) ?? ''} />
        )} />,
      );

    case 'textarea':
    case 'rich-notes':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => (
          <Textarea id={id} placeholder={field.placeholder}
            rows={field.type === 'rich-notes' ? (dense ? 3 : 5) : (dense ? 2 : 3)}
            className={cn(!dense && (field.type === 'rich-notes' ? 'min-h-36' : 'min-h-24'), errorClass)}
            {...f} value={(f.value as string) ?? ''} />
        )} />,
      );

    case 'number':
    case 'currency':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => (
          <Input id={id} type="number" inputMode="decimal"
            step={field.type === 'currency' ? '0.01' : undefined}
            placeholder={field.placeholder ?? (field.type === 'currency' ? '0.00' : undefined)}
            className={cn('tabular-nums', errorClass)}
            {...f}
            value={(f.value as number | string | undefined) ?? ''}
            onChange={(event) => f.onChange(event.target.value === '' ? undefined : Number(event.target.value))} />
        )} />,
      );

    case 'date':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => (
          <Input id={id} type="date" className={cn('tabular-nums', errorClass)}
            {...f} value={(f.value as string) ?? ''} />
        )} />,
      );

    case 'select':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => (
          <Select value={(f.value as string) ?? ''} onValueChange={f.onChange}>
            <SelectTrigger id={id} className={errorClass}>
              <SelectValue placeholder={field.placeholder ?? t('itemForm.select.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.filter((option) => option !== '').map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )} />,
      );

    case 'multi-select':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => {
          const selected = splitList(f.value);
          return (
            <div className="space-y-2">
              <div id={id} role="group" aria-label={field.label} className="flex flex-wrap gap-2">
                {field.options?.map((option) => (
                  <label key={option} className="flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                      checked={selected.includes(option)}
                      onCheckedChange={(checked) => {
                        const next = checked ? [...selected, option] : selected.filter((entry) => entry !== option);
                        f.onChange(next.join(', '));
                      }}
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.map((entry) => <Badge key={entry} variant="secondary" className="text-xs">{entry}</Badge>)}
                </div>
              )}
            </div>
          );
        }} />,
      );

    case 'boolean':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => (
          <div className="flex items-center gap-2 pt-1">
            <Switch id={id} checked={!!f.value} onCheckedChange={f.onChange} />
            <span className="text-sm text-muted-foreground">{f.value ? t('common.yes') : t('common.no')}</span>
          </div>
        )} />,
      );

    case 'image':
      // Item photos are managed in the Photos section; per-field image uploads aren't stored.
      return wrap(
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-5 text-center">
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">{t('itemForm.field.imageFieldHint')}</p>
        </div>,
      );

    case 'tags':
      return wrap(
        <Controller name={name} control={control} render={({ field: f }) => {
          const tags = splitList(f.value);
          return (
            <div className="space-y-2">
              <Input id={id} placeholder={field.placeholder ?? t('itemForm.tags.placeholder')}
                className={errorClass} {...f} value={(f.value as string) ?? ''} />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                </div>
              )}
            </div>
          );
        }} />,
      );

    default:
      return null;
  }
}
