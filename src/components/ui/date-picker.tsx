import * as React from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getLocale, useLanguageStore, useT } from '@/i18n';

function getMonthNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  return Array.from({ length: 12 }, (_, month) => formatter.format(new Date(2024, month, 1)));
}

/** Monday-first narrow weekday labels. */
function getWeekdayNames(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, offset) => formatter.format(new Date(2024, 0, 1 + offset)));
}

const MIN_YEAR = 1900;
const FUTURE_YEAR_BUFFER = 5;

function parseDateValue(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayValue(value?: string): string {
  const date = parseDateValue(value);
  if (!date) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function getCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayFirstOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - mondayFirstOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function sameDay(left: Date | null, right: Date | null): boolean {
  if (!left || !right) return false;
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function buildYearOptions(currentYear: number): number[] {
  const maxYear = currentYear + FUTURE_YEAR_BUFFER;
  return Array.from(
    { length: maxYear - MIN_YEAR + 1 },
    (_, index) => maxYear - index,
  );
}

interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  disabled,
  className,
  placeholder,
}, ref) => {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const MONTHS = React.useMemo(() => getMonthNames(getLocale(language)), [language]);
  const WEEKDAYS = React.useMemo(() => getWeekdayNames(getLocale(language)), [language]);
  const resolvedPlaceholder = placeholder ?? t('common.datePicker.placeholder');
  const selectedDate = React.useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = React.useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = React.useState(false);
  const [yearMenuOpen, setYearMenuOpen] = React.useState(false);
  const selectedMonthRef = React.useRef<HTMLButtonElement | null>(null);
  const selectedYearRef = React.useRef<HTMLButtonElement | null>(null);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const initial = selectedDate ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  React.useEffect(() => {
    if (!selectedDate) return;
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  React.useEffect(() => {
    if (!yearMenuOpen) return;
    selectedYearRef.current?.scrollIntoView({ block: 'center' });
  }, [yearMenuOpen]);

  React.useEffect(() => {
    if (!monthMenuOpen) return;
    selectedMonthRef.current?.scrollIntoView({ block: 'center' });
  }, [monthMenuOpen]);

  const today = React.useMemo(() => new Date(), []);
  const days = React.useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const yearOptions = React.useMemo(() => buildYearOptions(today.getFullYear()), [today]);

  const setMonth = (delta: number) => {
    setMonthMenuOpen(false);
    setYearMenuOpen(false);
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const setVisibleMonthIndex = (monthIndex: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), monthIndex, 1));
    setMonthMenuOpen(false);
  };

  const setVisibleYear = (year: number) => {
    setVisibleMonth((current) => new Date(year, current.getMonth(), 1));
    setYearMenuOpen(false);
  };

  const selectDate = (date: Date) => {
    onChange(formatDateValue(date));
    setMonthMenuOpen(false);
    setYearMenuOpen(false);
    setOpen(false);
  };

  const clearDate = () => {
    onChange('');
    setMonthMenuOpen(false);
    setYearMenuOpen(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
      />
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setMonthMenuOpen(false);
            setYearMenuOpen(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'surface-1 h-10 w-full justify-between rounded-lg border-input px-3 text-left font-normal',
              !value && 'text-muted-foreground',
              className,
            )}
          >
            <span>{value ? formatDisplayValue(value) : resolvedPlaceholder}</span>
            <CalendarDays className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-[70] max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[17rem] overflow-y-auto overflow-x-hidden rounded-lg border p-0 shadow-[0_24px_60px_rgb(0_0_0_/_0.22)]"
        >
          <div className="border-b border-border/70 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={t('common.datePicker.selectMonth')}
                      aria-expanded={monthMenuOpen}
                      onClick={() => {
                        setMonthMenuOpen((current) => !current);
                        setYearMenuOpen(false);
                      }}
                      className="surface-1 flex h-7 w-[6.75rem] items-center justify-between rounded-lg border border-input px-2 text-xs font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="truncate">{MONTHS[visibleMonth.getMonth()]}</span>
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                    {monthMenuOpen && (
                      <div
                        className="surface-3 absolute left-0 top-8 z-10 w-[6.75rem] rounded-lg border shadow-[0_16px_40px_rgb(0_0_0_/_0.2)]"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        <ScrollArea className="h-48 rounded-lg">
                          <div className="p-1">
                            {MONTHS.map((month, index) => {
                              const isSelectedMonth = index === visibleMonth.getMonth();

                              return (
                                <button
                                  key={month}
                                  ref={isSelectedMonth ? selectedMonthRef : undefined}
                                  type="button"
                                  onClick={() => setVisibleMonthIndex(index)}
                                  className={cn(
                                    'flex h-7 w-full items-center rounded-md px-2 text-left text-xs transition-colors',
                                    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isSelectedMonth && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                                  )}
                                >
                                  {month}
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label={t('common.datePicker.selectYear')}
                      aria-expanded={yearMenuOpen}
                      onClick={() => {
                        setYearMenuOpen((current) => !current);
                        setMonthMenuOpen(false);
                      }}
                      className="surface-1 flex h-7 w-[4.75rem] items-center justify-between rounded-lg border border-input px-2 text-xs font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>{visibleMonth.getFullYear()}</span>
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    </button>
                    {yearMenuOpen && (
                      <div
                        className="surface-3 absolute right-0 top-8 z-10 w-[4.75rem] rounded-lg border shadow-[0_16px_40px_rgb(0_0_0_/_0.2)]"
                        onWheel={(event) => event.stopPropagation()}
                      >
                        <ScrollArea className="h-40 rounded-lg">
                          <div className="p-1">
                            {yearOptions.map((year) => {
                              const isSelectedYear = year === visibleMonth.getFullYear();

                              return (
                                <button
                                  key={year}
                                  ref={isSelectedYear ? selectedYearRef : undefined}
                                  type="button"
                                  onClick={() => setVisibleYear(year)}
                                  className={cn(
                                    'flex h-6 w-full items-center justify-center rounded-md text-xs transition-colors',
                                    'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isSelectedYear && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                                  )}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Select purchase date
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => setMonth(-1)}
                  aria-label={t('common.datePicker.previousMonth')}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => setMonth(1)}
                  aria-label={t('common.datePicker.nextMonth')}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-2">
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
              {WEEKDAYS.map((weekday, index) => (
                <div key={`${weekday}-${index}`} className="py-0.5">
                  {weekday}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((date) => {
                const isOutside = date.getMonth() !== visibleMonth.getMonth();
                const isSelected = sameDay(date, selectedDate);
                const isToday = sameDay(date, today);

                return (
                  <button
                    key={formatDateValue(date)}
                    type="button"
                    onClick={() => selectDate(date)}
                    className={cn(
                      'flex h-7 items-center justify-center rounded-lg text-xs transition-colors',
                      'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isOutside && 'text-muted-foreground/55',
                      isToday && !isSelected && 'border border-primary/45 text-primary',
                      isSelected && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-border/70 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs"
                onClick={clearDate}
              >
                <X className="size-3.5" />
                {t('common.datePicker.clear')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs"
                onClick={() => selectDate(new Date())}
              >
                {t('common.datePicker.today')}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

DatePicker.displayName = 'DatePicker';

export { DatePicker };
