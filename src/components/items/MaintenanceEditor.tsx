import { useState } from 'react';
import { AlertTriangle, CalendarClock, CalendarPlus, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { cn, formatCurrency, formatDate, todayISO } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem, MaintenanceEntry } from '@/types';
import {
  daysUntil,
  downloadCalendarEvent,
  getNextScheduledMaintenance,
  getScheduleState,
  scheduleStateClass,
} from './itemSchedule';

const MAINTENANCE_TYPES: MaintenanceEntry['type'][] = [
  'inspection',
  'cleaning',
  'repair',
  'restoration',
  'other',
];

type MaintenanceValues = Omit<MaintenanceEntry, 'id'>;

/** Original per-type accent colours for the log's icon tiles. */
const MAINTENANCE_TONES: Record<MaintenanceEntry['type'], { tile: string; icon: string }> = {
  repair: { tile: 'bg-amber-500/10', icon: 'text-amber-500' },
  restoration: { tile: 'bg-blue-500/10', icon: 'text-blue-500' },
  cleaning: { tile: 'bg-green-500/10', icon: 'text-green-500' },
  inspection: { tile: 'bg-primary/10', icon: 'text-primary' },
  other: { tile: 'bg-primary/10', icon: 'text-primary' },
};

interface MaintenanceFormState {
  date: string;
  type: MaintenanceEntry['type'];
  description: string;
  cost: string;
  currency: string;
  provider: string;
  nextScheduled: string;
}

function toFormState(entry: MaintenanceEntry | null | undefined, defaultCurrency: string): MaintenanceFormState {
  return {
    date: entry?.date?.slice(0, 10) ?? todayISO(),
    type: entry?.type ?? 'inspection',
    description: entry?.description ?? '',
    cost: entry?.cost != null ? String(entry.cost) : '',
    currency: entry?.currency ?? defaultCurrency,
    provider: entry?.provider ?? '',
    nextScheduled: entry?.nextScheduled?.slice(0, 10) ?? '',
  };
}

function MaintenanceEntryForm({
  entry,
  defaultCurrency,
  onCancel,
  onSubmit,
}: {
  entry?: MaintenanceEntry | null;
  defaultCurrency: string;
  onCancel: () => void;
  onSubmit: (values: MaintenanceValues) => void;
}) {
  const t = useT();
  const [form, setForm] = useState(() => toFormState(entry, defaultCurrency));
  const [error, setError] = useState<string | null>(null);
  const currencies = ITEM_FORM_CURRENCIES as readonly string[];

  const update = <K extends keyof MaintenanceFormState>(key: K, value: MaintenanceFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.date) {
      setError(t('itemDetail.maintenance.error.date'));
      return;
    }
    if (!form.description.trim()) {
      setError(t('itemDetail.maintenance.error.description'));
      return;
    }
    const cost = form.cost.trim() === '' ? undefined : Number(form.cost);
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      setError(t('itemDetail.maintenance.error.cost'));
      return;
    }
    if (form.nextScheduled && form.nextScheduled < form.date) {
      setError(t('itemDetail.maintenance.error.nextScheduled'));
      return;
    }

    onSubmit({
      date: form.date,
      type: form.type,
      description: form.description.trim(),
      cost,
      currency: cost !== undefined ? form.currency : undefined,
      provider: form.provider.trim() || undefined,
      nextScheduled: form.nextScheduled || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="maintenance-date">{t('itemDetail.maintenance.field.date')}</Label>
          <Input
            id="maintenance-date"
            type="date"
            value={form.date}
            onChange={(event) => update('date', event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maintenance-type">{t('itemDetail.maintenance.field.type')}</Label>
          <Select value={form.type} onValueChange={(value) => update('type', value as MaintenanceEntry['type'])}>
            <SelectTrigger id="maintenance-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAINTENANCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`itemDetail.maintenance.type.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maintenance-description">{t('itemDetail.maintenance.field.description')}</Label>
        <Textarea
          id="maintenance-description"
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          placeholder={t('itemDetail.maintenance.field.descriptionPlaceholder')}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <div className="space-y-2">
          <Label htmlFor="maintenance-cost">{t('itemDetail.maintenance.field.cost')}</Label>
          <Input
            id="maintenance-cost"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className="tabular-nums"
            value={form.cost}
            onChange={(event) => update('cost', event.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maintenance-currency">{t('itemDetail.maintenance.field.currency')}</Label>
          <Select value={form.currency} onValueChange={(value) => update('currency', value)}>
            <SelectTrigger id="maintenance-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(currencies.includes(form.currency) ? currencies : [form.currency, ...currencies]).map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="maintenance-provider">{t('itemDetail.maintenance.field.provider')}</Label>
          <Input
            id="maintenance-provider"
            value={form.provider}
            onChange={(event) => update('provider', event.target.value)}
            placeholder={t('itemDetail.maintenance.field.providerPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maintenance-next">{t('itemDetail.maintenance.field.nextScheduled')}</Label>
          <Input
            id="maintenance-next"
            type="date"
            min={form.date || undefined}
            value={form.nextScheduled}
            onChange={(event) => update('nextScheduled', event.target.value)}
          />
        </div>
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
          {entry ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
          {entry ? t('itemDetail.maintenance.saveChanges') : t('itemDetail.maintenance.addEntry')}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MaintenanceEntryDialog({
  open,
  onOpenChange,
  entry,
  defaultCurrency,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: MaintenanceEntry | null;
  defaultCurrency: string;
  onSubmit: (values: MaintenanceValues) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden="true">
              <Wrench className="size-5 text-primary" />
            </div>
            <div className="space-y-1.5 text-left">
              <DialogTitle>
                {entry ? t('itemDetail.maintenance.editTitle') : t('itemDetail.maintenance.addTitle')}
              </DialogTitle>
              <DialogDescription>{t('itemDetail.maintenance.dialogDescription')}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <MaintenanceEntryForm
          entry={entry}
          defaultCurrency={defaultCurrency}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Card listing an item's maintenance log with add / edit / delete. */
export function MaintenanceLog({ item, displayCurrency }: { item: CollectionItem; displayCurrency: string }) {
  const t = useT();
  const addMaintenanceEntry = useCollectionStore((state) => state.addMaintenanceEntry);
  const updateMaintenanceEntry = useCollectionStore((state) => state.updateMaintenanceEntry);
  const removeMaintenanceEntry = useCollectionStore((state) => state.removeMaintenanceEntry);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceEntry | null>(null);

  const entries = [...item.maintenanceLog].sort((left, right) => right.date.localeCompare(left.date));
  const nextScheduled = getNextScheduledMaintenance(item);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSubmit = (values: MaintenanceValues) => {
    if (editing) {
      updateMaintenanceEntry(item.id, editing.id, values);
      toast.success(t('itemDetail.maintenance.toast.updated'));
    } else {
      addMaintenanceEntry(item.id, values);
      toast.success(t('itemDetail.maintenance.toast.added'));
    }
    setDialogOpen(false);
    setEditing(null);
  };

  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="size-4" aria-hidden="true" />
            {t('itemDetail.maintenance.title')}
          </CardTitle>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-3.5" />
            {t('itemDetail.maintenance.addEntry')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <ul className="space-y-4">
            {entries.map((entry) => {
              const tone = MAINTENANCE_TONES[entry.type] ?? MAINTENANCE_TONES.other;
              return (
                <li key={entry.id} className="group relative rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone.tile)}
                        aria-hidden="true"
                      >
                        <Wrench className={cn('size-4', tone.icon)} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {t(`itemDetail.maintenance.type.${entry.type}`)}
                          </Badge>
                          <time dateTime={entry.date} className="text-xs tabular-nums text-muted-foreground">
                            {formatDate(entry.date)}
                          </time>
                        </div>
                        <p className="mt-1 text-sm">{entry.description}</p>
                        {(entry.cost != null || entry.provider) && (
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {entry.cost != null && (
                              <span className="tabular-nums">
                                {t('itemDetail.maintenance.field.cost')}:{' '}
                                {formatCurrency(entry.cost, entry.currency || displayCurrency)}
                              </span>
                            )}
                            {entry.provider && (
                              <span>
                                {t('itemDetail.maintenance.field.provider')}: {entry.provider}
                              </span>
                            )}
                          </div>
                        )}
                        {entry.nextScheduled && (
                          <p
                            className={cn(
                              'mt-1 flex items-center gap-1 text-xs tabular-nums',
                              entry.id === nextScheduled?.id
                                ? scheduleStateClass(getScheduleState(daysUntil(entry.nextScheduled)))
                                : 'text-amber-500',
                            )}
                          >
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            {t('itemDetail.maintenance.nextOn', { date: formatDate(entry.nextScheduled) })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-0.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-muted-foreground"
                        aria-label={t('itemDetail.maintenance.editEntry')}
                        onClick={() => {
                          setEditing(entry);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={t('itemDetail.maintenance.deleteEntry')}
                        onClick={() => {
                          removeMaintenanceEntry(item.id, entry.id);
                          toast.success(t('itemDetail.maintenance.toast.removed'));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <Wrench className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">{t('itemDetail.maintenance.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('itemDetail.maintenance.emptyDescription')}</p>
          </div>
        )}
      </CardContent>

      <MaintenanceEntryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        entry={editing}
        defaultCurrency={displayCurrency}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}

/** Prominent "next service" notice with overdue / upcoming state and calendar export. */
export function NextServiceCard({ item }: { item: CollectionItem }) {
  const t = useT();
  const scheduled = getNextScheduledMaintenance(item);
  if (!scheduled?.nextScheduled) return null;

  const date = scheduled.nextScheduled.slice(0, 10);
  const days = daysUntil(date);
  const state = getScheduleState(days);
  const typeLabel = t(`itemDetail.maintenance.type.${scheduled.type}`);

  const statusText =
    state === 'overdue'
      ? t('itemDetail.service.overdue', { count: Math.abs(days) })
      : state === 'today'
        ? t('itemDetail.service.today')
        : t('itemDetail.service.inDays', { count: days });

  const isOverdue = state === 'overdue';
  const isSoon = state === 'soon' || state === 'today';

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/70',
        isOverdue && 'border-red-500/40',
        isSoon && 'border-amber-500/40',
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          isOverdue
            ? 'from-red-500/80 via-rose-400/60 to-orange-400/40'
            : isSoon
              ? 'from-amber-400/80 via-orange-400/60 to-rose-400/40'
              : 'from-primary/70 via-primary/40 to-transparent',
        )}
        aria-hidden="true"
      />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full',
              isOverdue ? 'bg-red-500/10' : isSoon ? 'bg-amber-500/10' : 'bg-primary/10',
            )}
            aria-hidden="true"
          >
            <CalendarClock
              className={cn('size-5', isOverdue ? 'text-red-500' : isSoon ? 'text-amber-500' : 'text-primary')}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t('itemDetail.service.title')}
            </p>
            <p className="text-lg font-bold tracking-tight tabular-nums">{formatDate(date)}</p>
            <p className={cn('text-sm', scheduleStateClass(state))}>
              {statusText}
              <span className="font-normal text-muted-foreground"> · {typeLabel}</span>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            downloadCalendarEvent({
              uid: `maintenance-${item.id}-${scheduled.id}`,
              title: t('itemDetail.service.calendarTitle', { type: typeLabel, title: item.title }),
              date,
              description: scheduled.description,
              filename: `${item.title}-service`,
            })
          }
        >
          <CalendarPlus className="size-3.5" />
          {t('itemDetail.service.addToCalendar')}
        </Button>
      </CardContent>
    </Card>
  );
}
