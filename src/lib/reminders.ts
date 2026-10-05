import type { CollectionItem } from '@/types';
import { todayISO } from '@/lib/utils';

export type ReminderKind = 'loan-overdue' | 'loan-due' | 'maintenance-overdue' | 'maintenance-due';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  itemId: string;
  itemTitle: string;
  /** YYYY-MM-DD the reminder refers to (due date / scheduled date). */
  date: string;
  /** Negative = overdue by N days, 0 = today, positive = due in N days. */
  daysUntil: number;
  /** Borrower name for loans, maintenance type for maintenance. */
  detail?: string;
}

/** How many days ahead an upcoming loan/maintenance date counts as a reminder. */
export const REMINDER_LOOKAHEAD_DAYS = 7;

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Open loans that are overdue or due soon, plus scheduled maintenance that is
 * overdue or coming up. Sorted most urgent first.
 */
export function getReminders(
  items: CollectionItem[],
  today: string = todayISO(),
  lookaheadDays: number = REMINDER_LOOKAHEAD_DAYS,
): Reminder[] {
  const reminders: Reminder[] = [];

  for (const item of items) {
    if (item.isArchived) continue;

    for (const loan of item.lendingHistory ?? []) {
      if (loan.actualReturnDate || !loan.expectedReturnDate) continue;
      const daysUntil = daysBetween(today, loan.expectedReturnDate.slice(0, 10));
      if (daysUntil > lookaheadDays) continue;
      reminders.push({
        id: `loan:${item.id}:${loan.id}`,
        kind: daysUntil < 0 ? 'loan-overdue' : 'loan-due',
        itemId: item.id,
        itemTitle: item.title,
        date: loan.expectedReturnDate.slice(0, 10),
        daysUntil,
        detail: loan.borrowerName,
      });
    }

    // Only the latest entry's schedule counts — older entries' plans were superseded.
    const scheduled = [...(item.maintenanceLog ?? [])]
      .filter((entry) => entry.nextScheduled)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (scheduled?.nextScheduled) {
      const date = scheduled.nextScheduled.slice(0, 10);
      const daysUntil = daysBetween(today, date);
      if (daysUntil <= lookaheadDays) {
        reminders.push({
          id: `maintenance:${item.id}:${scheduled.id}`,
          kind: daysUntil < 0 ? 'maintenance-overdue' : 'maintenance-due',
          itemId: item.id,
          itemTitle: item.title,
          date,
          daysUntil,
          detail: scheduled.type,
        });
      }
    }
  }

  return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
}

function icsDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '');
}

function icsEscape(text: string): string {
  return text.replace(/[\\;,]/g, (char) => `\\${char}`).replace(/\n/g, '\\n');
}

/** Single all-day calendar event (RFC 5545) as an .ics string. */
export function buildIcsEvent({ uid, title, date, description }: {
  uid: string;
  title: string;
  date: string;
  description?: string;
}): string {
  const next = new Date(`${date.slice(0, 10)}T00:00:00`);
  next.setDate(next.getDate() + 1);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Curio//Collection Catalogue//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@curio`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(date)}`,
    `DTEND;VALUE=DATE:${icsDate(todayISO(next))}`,
    `SUMMARY:${icsEscape(title)}`,
    ...(description ? [`DESCRIPTION:${icsEscape(description)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:PT9H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
