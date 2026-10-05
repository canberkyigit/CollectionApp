import { cn, formatDateTime, formatRelativeDate } from '@/lib/utils';

/** "3 days ago" with the exact date and time on hover and for assistive tech. */
export function RelativeTime({ date, className }: { date: string; className?: string }) {
  const full = formatDateTime(date);
  return (
    <time dateTime={date} title={full || undefined} className={cn('cursor-default', className)}>
      {formatRelativeDate(date)}
    </time>
  );
}
