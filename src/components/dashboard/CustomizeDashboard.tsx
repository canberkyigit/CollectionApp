import { useState, type DragEvent } from 'react';
import {
  Settings2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  GripVertical,
  TrendingUp,
  PieChart,
  BarChart,
  Calendar,
  Clock,
  Users,
  Star,
  Heart,
  Activity,
  Zap,
  Scale,
  BarChart3,
  Columns3,
  Square,
  RectangleHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { DashboardWidgetConfig, DashboardWidgetId } from '@/types';
import { useCollectionStore } from '@/store/useCollectionStore';
import { normalizeDashboardWidgets } from '@/pages/dashboard-helpers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n';

const widgetIconMap: Record<string, LucideIcon> = {
  BarChart3,
  TrendingUp,
  PieChart,
  BarChart,
  Calendar,
  Clock,
  Users,
  Star,
  Heart,
  Activity,
  Zap,
  Scale,
};

function getWidgetIcon(name: string): LucideIcon {
  return widgetIconMap[name] ?? BarChart3;
}

const SIZES: DashboardWidgetConfig['size'][] = ['full', 'half', 'third'];
const SIZE_ICONS: Record<DashboardWidgetConfig['size'], LucideIcon> = {
  full: RectangleHorizontal,
  half: Square,
  third: Columns3,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomizeDashboard({ open, onOpenChange }: Props) {
  const t = useT();
  const {
    dashboardWidgets,
    toggleWidgetVisibility,
    moveWidget,
    setWidgetSize,
    setDashboardWidgets,
    resetDashboardLayout,
  } = useCollectionStore();
  const [dragId, setDragId] = useState<DashboardWidgetId | null>(null);
  const [overId, setOverId] = useState<DashboardWidgetId | null>(null);

  const normalized = normalizeDashboardWidgets(dashboardWidgets);
  const sorted = [...normalized].sort((a, b) => a.order - b.order);
  const visibleCount = sorted.filter((w) => w.visible).length;

  /** Persist newly added default widgets before mutating so the store actions can find them. */
  const withStoredWidgets = (action: () => void) => {
    if (normalized !== dashboardWidgets) setDashboardWidgets(sorted);
    action();
  };

  const widgetLabel = (widget: DashboardWidgetConfig) => t(`dashboard.widget.${widget.id}`);

  const handleDrop = (event: DragEvent, targetId: DashboardWidgetId) => {
    event.preventDefault();
    const sourceId = dragId ?? (event.dataTransfer.getData('text/plain') as DashboardWidgetId);
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const next = sorted.filter((widget) => widget.id !== sourceId);
    const source = sorted.find((widget) => widget.id === sourceId);
    const targetIndex = next.findIndex((widget) => widget.id === targetId);
    if (!source || targetIndex === -1) return;
    const sourceIndex = sorted.findIndex((widget) => widget.id === sourceId);
    const originalTargetIndex = sorted.findIndex((widget) => widget.id === targetId);
    // Dropping onto a lower row places the widget after it; onto a higher row, before it.
    next.splice(sourceIndex < originalTargetIndex ? targetIndex + 1 : targetIndex, 0, source);
    setDashboardWidgets(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" aria-hidden="true" />
            {t('dashboard.customizeTitle')}
          </DialogTitle>
          <DialogDescription>{t('dashboard.customizeDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground tabular-nums">
              {t('dashboard.visibleCount', { visible: visibleCount, total: sorted.length })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/80">{t('dashboard.dragHint')}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={resetDashboardLayout} className="shrink-0 text-xs">
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
            {t('dashboard.resetLayout')}
          </Button>
        </div>

        <Separator />

        <ul className="scrollbar-thin -mx-1 flex-1 space-y-1.5 overflow-y-auto px-1 py-2">
          {sorted.map((widget, idx) => {
            const label = widgetLabel(widget);
            const Icon = getWidgetIcon(widget.icon);
            return (
              <li
                key={widget.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', widget.id);
                  setDragId(widget.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (overId !== widget.id) setOverId(widget.id);
                }}
                onDragLeave={() => setOverId((current) => (current === widget.id ? null : current))}
                onDrop={(event) => handleDrop(event, widget.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl border p-3 transition-all',
                  widget.visible
                    ? 'border-border bg-card'
                    : 'border-dashed border-border/50 bg-muted/30',
                  dragId === widget.id && 'opacity-50',
                  overId === widget.id && dragId !== widget.id && 'border-primary/40 bg-primary/5 ring-2 ring-primary/20',
                )}
              >
                <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => withStoredWidgets(() => moveWidget(widget.id, 'up'))}
                    disabled={idx === 0}
                    aria-label={t('dashboard.moveUp', { name: label })}
                    className="rounded p-0.5 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                  >
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <GripVertical className="size-3.5 cursor-grab opacity-30" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => withStoredWidgets(() => moveWidget(widget.id, 'down'))}
                    disabled={idx === sorted.length - 1}
                    aria-label={t('dashboard.moveDown', { name: label })}
                    className="rounded p-0.5 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20"
                  >
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    widget.visible ? 'bg-primary/10' : 'bg-muted opacity-60',
                  )}
                  aria-hidden="true"
                >
                  <Icon className={cn('size-4', widget.visible ? 'text-primary' : 'text-muted-foreground')} />
                </div>

                <div className={cn('min-w-0 flex-1', !widget.visible && 'opacity-60')}>
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                    {t(`dashboard.widgetDescription.${widget.id}`)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {widget.visible && (
                    <div role="group" aria-label={t('dashboard.sizeLabel', { name: label })} className="flex rounded-md border">
                      {SIZES.map((size) => {
                        const SizeIcon = SIZE_ICONS[size];
                        return (
                          <button
                            key={size}
                            type="button"
                            aria-pressed={widget.size === size}
                            aria-label={t(`dashboard.size.${size}`)}
                            title={t(`dashboard.size.${size}`)}
                            onClick={() => withStoredWidgets(() => setWidgetSize(widget.id, size))}
                            className={cn(
                              'flex items-center justify-center p-1.5 transition-colors first:rounded-l-md last:rounded-r-md',
                              widget.size === size
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                          >
                            <SizeIcon className="size-3" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label={widget.visible ? t('dashboard.hideWidget', { name: label }) : t('dashboard.showWidget', { name: label })}
                    aria-pressed={widget.visible}
                    onClick={() => withStoredWidgets(() => toggleWidgetVisibility(widget.id))}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2 transition-colors',
                      widget.visible
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {widget.visible ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <Separator />

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
            {SIZES.map((size) => {
              const SizeIcon = SIZE_ICONS[size];
              return (
                <Badge key={size} variant="secondary" className="text-xs">
                  <SizeIcon className="mr-1 size-3" />
                  {t(`dashboard.size.${size}`)}
                </Badge>
              );
            })}
          </div>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            {t('dashboard.done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
