import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import type { Reminder } from '@/lib/reminders';
import { cn, formatDate } from '@/lib/utils';
import {
  downloadCalendarEvent,
  getScheduleState,
  reminderStatusKey,
  scheduleStateClass,
  useReminderCalendarEvent,
} from './itemSchedule';

/** Tinted reminder rows (red = overdue, amber = due soon) with per-row "Add to calendar". */
export function RemindersList({ reminders, className }: { reminders: Reminder[]; className?: string }) {
  const t = useT();
  const toCalendarEvent = useReminderCalendarEvent();

  return (
    <ul className={cn('space-y-2', className)}>
      {reminders.map((reminder) => {
        const state = getScheduleState(reminder.daysUntil);
        const status = reminderStatusKey(reminder);
        const isOverdue = state === 'overdue';
        const isSoon = state === 'soon' || state === 'today';
        const Icon = isOverdue ? AlertTriangle : Clock;
        return (
          <li
            key={reminder.id}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:gap-4',
              isOverdue
                ? 'border-red-500/30 bg-red-500/5'
                : isSoon
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'bg-muted/30',
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  isOverdue ? 'bg-red-500/10' : isSoon ? 'bg-amber-500/10' : 'bg-primary/10',
                )}
                aria-hidden="true"
              >
                <Icon
                  className={cn('size-4', isOverdue ? 'text-red-500' : isSoon ? 'text-amber-500' : 'text-primary')}
                />
              </div>
              <div className="min-w-0">
                <Link
                  to={`/items/${reminder.itemId}`}
                  className="block truncate text-sm font-semibold hover:text-primary hover:underline"
                >
                  {reminder.itemTitle}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {reminder.detail && <span>{reminder.detail}</span>}
                  {reminder.detail && <span aria-hidden="true"> · </span>}
                  <span className="tabular-nums">{formatDate(reminder.date)}</span>
                </p>
              </div>
            </div>
            <p className={cn('text-sm tabular-nums sm:w-40 sm:text-right', scheduleStateClass(state))}>
              {t(status.key, { count: status.count })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 self-start text-muted-foreground hover:text-primary sm:self-auto"
              aria-label={t('lending.addToCalendarNamed', { title: reminder.itemTitle })}
              onClick={() => {
                const event = toCalendarEvent(reminder);
                downloadCalendarEvent({ ...event, filename: `${reminder.itemTitle}-${reminder.date}` });
              }}
            >
              <CalendarPlus className="size-3.5" />
              <span className="sm:sr-only">{t('lending.addToCalendar')}</span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
