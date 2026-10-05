import type { CollectionItem, LendingRecord, MaintenanceEntry } from '@/types';
import { useT } from '@/i18n';
import { buildIcsEvent, downloadIcs, REMINDER_LOOKAHEAD_DAYS, type Reminder } from '@/lib/reminders';
import { slugify, todayISO } from '@/lib/utils';

export type ScheduleState = 'overdue' | 'today' | 'soon' | 'upcoming';

/** Whole days from `today` to `dateISO` (negative = in the past). */
export function daysUntil(dateISO: string, today: string = todayISO()): number {
  const from = new Date(`${today.slice(0, 10)}T00:00:00`);
  const to = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function getScheduleState(days: number, lookahead: number = REMINDER_LOOKAHEAD_DAYS): ScheduleState {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= lookahead) return 'soon';
  return 'upcoming';
}

/** Tailwind text colour for a schedule state (original red / amber accents). */
export function scheduleStateClass(state: ScheduleState): string {
  switch (state) {
    case 'overdue':
      return 'font-medium text-red-600 dark:text-red-400';
    case 'today':
    case 'soon':
      return 'font-medium text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * The maintenance entry whose `nextScheduled` currently applies — only the
 * latest entry's plan counts (mirrors getReminders in @/lib/reminders).
 */
export function getNextScheduledMaintenance(item: Pick<CollectionItem, 'maintenanceLog'>): MaintenanceEntry | undefined {
  return [...(item.maintenanceLog ?? [])]
    .filter((entry) => entry.nextScheduled)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

export function getOpenLoan(item: Pick<CollectionItem, 'lendingHistory'>): LendingRecord | undefined {
  return (item.lendingHistory ?? []).find((record) => !record.actualReturnDate);
}

/** Merges several single-event calendars (from buildIcsEvent) into one VCALENDAR. */
export function combineIcsEvents(calendars: string[]): string {
  const events = calendars.flatMap((ics) => {
    const lines = ics.split('\r\n');
    const start = lines.indexOf('BEGIN:VEVENT');
    const end = lines.lastIndexOf('END:VEVENT');
    return start >= 0 && end > start ? lines.slice(start, end + 1) : [];
  });
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Curio//Collection Catalogue//EN',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadCalendarEvent(options: {
  uid: string;
  title: string;
  date: string;
  description?: string;
  filename: string;
}): void {
  const { filename, ...event } = options;
  downloadIcs(slugify(filename), buildIcsEvent(event));
}

/** Calendar title + description for a reminder (loan due date or scheduled service). */
export function useReminderCalendarEvent() {
  const t = useT();
  return (reminder: Reminder) => {
    const isLoan = reminder.kind === 'loan-due' || reminder.kind === 'loan-overdue';
    return {
      uid: reminder.id.replace(/:/g, '-'),
      date: reminder.date,
      title: isLoan
        ? t('lending.calendar.title', { title: reminder.itemTitle, borrower: reminder.detail ?? '' })
        : t('itemDetail.service.calendarTitle', {
            type: t(`itemDetail.maintenance.type.${reminder.detail ?? 'other'}`),
            title: reminder.itemTitle,
          }),
      description: isLoan ? t('lending.calendar.description', { borrower: reminder.detail ?? '' }) : undefined,
    };
  };
}

export function reminderStatusKey(reminder: Reminder): { key: string; count: number } {
  const state = getScheduleState(reminder.daysUntil);
  if (state === 'overdue') return { key: 'lending.reminders.overdue', count: Math.abs(reminder.daysUntil) };
  if (state === 'today') return { key: 'lending.reminders.today', count: 0 };
  return { key: 'lending.reminders.dueIn', count: reminder.daysUntil };
}
