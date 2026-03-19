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
  BarChart3,
  Columns3,
  Square,
  RectangleHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardWidgetConfig } from '@/types';

import { useCollectionStore } from '@/store/useCollectionStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
};

function getWidgetIcon(name: string): LucideIcon {
  return widgetIconMap[name] ?? BarChart3;
}

const sizeLabels: Record<DashboardWidgetConfig['size'], { label: string; icon: LucideIcon }> = {
  full: { label: 'Full', icon: RectangleHorizontal },
  half: { label: 'Half', icon: Square },
  third: { label: 'Third', icon: Columns3 },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomizeDashboard({ open, onOpenChange }: Props) {
  const {
    dashboardWidgets,
    toggleWidgetVisibility,
    moveWidget,
    setWidgetSize,
    resetDashboardLayout,
  } = useCollectionStore();

  const sorted = [...dashboardWidgets].sort((a, b) => a.order - b.order);
  const visibleCount = sorted.filter((w) => w.visible).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" />
            Customize Dashboard
          </DialogTitle>
          <DialogDescription>
            Show, hide, and reorder your dashboard widgets
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-muted-foreground">
            {visibleCount} of {sorted.length} widgets visible
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetDashboardLayout}
            className="text-xs"
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Reset to Default
          </Button>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 py-2 scrollbar-thin">
          {sorted.map((widget, idx) => {
            const Icon = getWidgetIcon(widget.icon);
            return (
              <div
                key={widget.id}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl border p-3 transition-all',
                  widget.visible
                    ? 'border-border bg-card'
                    : 'border-dashed border-border/50 bg-muted/30 opacity-60',
                )}
              >
                <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                  <button
                    onClick={() => moveWidget(widget.id, 'up')}
                    disabled={idx === 0}
                    className="rounded p-0.5 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <GripVertical className="size-3.5 opacity-30" />
                  <button
                    onClick={() => moveWidget(widget.id, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="rounded p-0.5 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>

                <div className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                  widget.visible ? 'bg-primary/10' : 'bg-muted',
                )}>
                  <Icon className={cn(
                    'size-4',
                    widget.visible ? 'text-primary' : 'text-muted-foreground',
                  )} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{widget.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-tight">
                    {widget.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {widget.visible && (
                    <div className="flex rounded-md border">
                      {(['full', 'half', 'third'] as const).map((s) => {
                        const SizeIcon = sizeLabels[s].icon;
                        return (
                          <button
                            key={s}
                            onClick={() => setWidgetSize(widget.id, s)}
                            title={sizeLabels[s].label}
                            className={cn(
                              'flex items-center justify-center p-1.5 transition-colors first:rounded-l-md last:rounded-r-md',
                              widget.size === s
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                          >
                            <SizeIcon className="size-3" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={() => toggleWidgetVisibility(widget.id)}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2 transition-colors',
                      widget.visible
                        ? 'text-foreground hover:bg-accent'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {widget.visible ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <RectangleHorizontal className="mr-1 size-3" />
              Full Width
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Square className="mr-1 size-3" />
              Half
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Columns3 className="mr-1 size-3" />
              Third
            </Badge>
          </div>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
