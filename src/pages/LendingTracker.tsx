import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  BellRing,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CheckCircle,
  Clock,
  Package,
  Plus,
  Send,
  AlertTriangle,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import type { LendingRecord } from '@/types';
import { PageHeader, EmptyState, LoadingSkeleton, StatCard } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { RemindersList } from '@/components/items/RemindersList';
import {
  combineIcsEvents,
  daysUntil,
  downloadCalendarEvent,
  getOpenLoan,
  getScheduleState,
  scheduleStateClass,
  useReminderCalendarEvent,
} from '@/components/items/itemSchedule';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/i18n';
import { buildIcsEvent, downloadIcs, getReminders } from '@/lib/reminders';
import { cn, formatDate, formatNumber, todayISO } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';

interface ActiveLoan {
  itemId: string;
  itemTitle: string;
  categoryName: string;
  record: LendingRecord;
}

const RETURN_CONDITIONS: Exclude<LendingRecord['condition'], 'pending'>[] = ['same', 'better', 'worse', 'damaged'];

function conditionBadgeProps(condition: LendingRecord['condition']): {
  variant: 'success' | 'outline' | 'warning' | 'destructive' | 'secondary';
  className?: string;
} {
  switch (condition) {
    case 'same':
      return { variant: 'success' };
    case 'better':
      return { variant: 'outline', className: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    case 'worse':
      return { variant: 'warning' };
    case 'damaged':
      return { variant: 'destructive' };
    default:
      return { variant: 'secondary' };
  }
}

/** Original icon-in-tile dialog header. */
function DialogIconHeader({
  icon: Icon,
  tone = 'primary',
  title,
  description,
}: {
  icon: typeof Send;
  tone?: 'primary' | 'green';
  title: string;
  description: string;
}) {
  return (
    <DialogHeader>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            tone === 'green' ? 'bg-green-500/15' : 'bg-primary/10',
          )}
          aria-hidden="true"
        >
          <Icon className={cn('size-5', tone === 'green' ? 'text-green-600 dark:text-green-400' : 'text-primary')} />
        </div>
        <div className="space-y-1.5 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
      </div>
    </DialogHeader>
  );
}

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

export default function LendingTracker() {
  const t = useT();
  const navigate = useNavigate();
  const {
    items,
    addLendingRecord,
    returnLendingRecord,
    getCategoryById,
    ownerUserId,
    isRemoteDataLoading,
  } = useCollectionStore();
  const shouldShowLoadingState = selectIsColdLoading(
    { ownerUserId, isRemoteDataLoading },
    [items.length],
  );
  const toCalendarEvent = useReminderCalendarEvent();

  const [lendDialogOpen, setLendDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<{
    itemId: string;
    recordId: string;
    itemTitle: string;
  } | null>(null);
  const [returnCondition, setReturnCondition] = useState<LendingRecord['condition']>('same');

  const [lendForm, setLendForm] = useState({
    itemId: '',
    borrowerName: '',
    borrowerContact: '',
    expectedReturnDate: '',
    notes: '',
  });

  const today = todayISO();

  const activeLoans = useMemo<ActiveLoan[]>(() => {
    const loans: ActiveLoan[] = [];
    for (const item of items) {
      const cat = getCategoryById(item.categoryId);
      for (const record of item.lendingHistory) {
        if (!record.actualReturnDate) {
          loans.push({
            itemId: item.id,
            itemTitle: item.title,
            categoryName: cat?.name ?? t('lending.unknownCategory'),
            record,
          });
        }
      }
    }
    return loans.sort((a, b) => a.record.expectedReturnDate.localeCompare(b.record.expectedReturnDate));
  }, [items, getCategoryById, t]);

  const historyRecords = useMemo(() => {
    const records: (ActiveLoan & { duration: number })[] = [];
    for (const item of items) {
      const cat = getCategoryById(item.categoryId);
      for (const record of item.lendingHistory) {
        if (record.actualReturnDate) {
          records.push({
            itemId: item.id,
            itemTitle: item.title,
            categoryName: cat?.name ?? t('lending.unknownCategory'),
            record,
            duration: Math.max(0, daysUntil(record.actualReturnDate, record.lentDate)),
          });
        }
      }
    }
    return records.sort((a, b) => b.record.actualReturnDate!.localeCompare(a.record.actualReturnDate!));
  }, [items, getCategoryById, t]);

  const loanReminders = useMemo(
    () => getReminders(items, today).filter((reminder) => reminder.kind === 'loan-overdue' || reminder.kind === 'loan-due'),
    [items, today],
  );

  const lendableItems = useMemo(
    () =>
      items
        .filter((item) => !item.isArchived)
        .map((item) => ({ item, onLoan: Boolean(getOpenLoan(item)) }))
        .sort((a, b) => Number(a.onLoan) - Number(b.onLoan) || a.item.title.localeCompare(b.item.title)),
    [items],
  );

  const stats = useMemo(() => {
    const overdueCount = activeLoans.filter((l) => l.record.expectedReturnDate < today).length;
    const totalAllTime = items.reduce((sum, item) => sum + item.lendingHistory.length, 0);
    return {
      currentlyLent: activeLoans.length,
      overdue: overdueCount,
      totalAllTime,
    };
  }, [activeLoans, items, today]);

  function loanCalendarEvent(loan: ActiveLoan) {
    return toCalendarEvent({
      id: `loan:${loan.itemId}:${loan.record.id}`,
      kind: loan.record.expectedReturnDate < today ? 'loan-overdue' : 'loan-due',
      itemId: loan.itemId,
      itemTitle: loan.itemTitle,
      date: loan.record.expectedReturnDate.slice(0, 10),
      daysUntil: daysUntil(loan.record.expectedReturnDate, today),
      detail: loan.record.borrowerName,
    });
  }

  function handleExportAll() {
    const events = activeLoans
      .filter((loan) => loan.record.expectedReturnDate)
      .map((loan) => buildIcsEvent(loanCalendarEvent(loan)));
    if (events.length === 0) return;
    downloadIcs('curio-loan-reminders', combineIcsEvents(events));
    toast.success(t('lending.toast.exported', { count: events.length }));
  }

  function resetLendForm() {
    setLendForm({
      itemId: '',
      borrowerName: '',
      borrowerContact: '',
      expectedReturnDate: '',
      notes: '',
    });
  }

  function handleLendSubmit() {
    if (!lendForm.itemId || !lendForm.borrowerName.trim() || !lendForm.expectedReturnDate) {
      toast.error(t('lending.toast.required'));
      return;
    }
    const target = items.find((item) => item.id === lendForm.itemId);
    if (target && getOpenLoan(target)) {
      toast.error(t('lending.toast.alreadyOnLoan', { title: target.title }));
      return;
    }
    addLendingRecord(lendForm.itemId, {
      borrowerName: lendForm.borrowerName.trim(),
      borrowerContact: lendForm.borrowerContact.trim() || undefined,
      lentDate: today,
      expectedReturnDate: lendForm.expectedReturnDate,
      notes: lendForm.notes.trim() || undefined,
      condition: 'pending',
    });
    toast.success(t('lending.toast.lent'));
    setLendDialogOpen(false);
    resetLendForm();
  }

  function openReturnDialog(itemId: string, recordId: string, itemTitle: string) {
    setReturnTarget({ itemId, recordId, itemTitle });
    setReturnCondition('same');
    setReturnDialogOpen(true);
  }

  function handleReturnSubmit() {
    if (!returnTarget) return;
    returnLendingRecord(returnTarget.itemId, returnTarget.recordId, returnCondition);
    toast.success(t('lending.toast.returned'));
    setReturnDialogOpen(false);
    setReturnTarget(null);
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader title={t('lending.title')} description={t('lending.description')}>
          {activeLoans.length > 0 && (
            <Button variant="outline" onClick={handleExportAll}>
              <CalendarPlus className="size-4" />
              {t('lending.exportAll')}
            </Button>
          )}
          <Button onClick={() => setLendDialogOpen(true)}>
            <Plus className="size-4" />
            {t('lending.lendItem')}
          </Button>
        </PageHeader>

        {shouldShowLoadingState ? (
          <div className="space-y-4">
            <LoadingSkeleton variant="list" count={3} />
            <LoadingSkeleton variant="list" count={4} />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                title={t('lending.stats.currentlyLent')}
                value={formatNumber(stats.currentlyLent)}
                icon={Send}
                subtitle={t('lending.stats.currentlyLentHint')}
              />
              <StatCard
                title={t('lending.stats.overdue')}
                value={formatNumber(stats.overdue)}
                icon={AlertTriangle}
                subtitle={t('lending.stats.overdueHint')}
                className={stats.overdue > 0 ? 'border-amber-500/40' : undefined}
              />
              <StatCard
                title={t('lending.stats.total')}
                value={formatNumber(stats.totalAllTime)}
                icon={Clock}
                subtitle={t('lending.stats.totalHint')}
              />
            </div>

            {/* Reminders */}
            {loanReminders.length > 0 && (
              <Card className="relative overflow-hidden border-amber-500/30">
                <div
                  className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400/80 via-orange-400/60 to-rose-400/40"
                  aria-hidden="true"
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10" aria-hidden="true">
                      <BellRing className="size-5 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                        {t('lending.reminders.eyebrow')}
                      </p>
                      <CardTitle className="text-base">{t('lending.reminders.title')}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {t('lending.reminders.description', { count: loanReminders.length })}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <RemindersList reminders={loanReminders} />
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active" className="gap-1.5">
                  <Send className="size-3.5" aria-hidden="true" />
                  {t('lending.tab.active')}
                  {activeLoans.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] tabular-nums">
                      {activeLoans.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <CheckCircle className="size-3.5" aria-hidden="true" />
                  {t('lending.tab.history')}
                  {historyRecords.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] tabular-nums">
                      {historyRecords.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Active loans */}
              <TabsContent value="active" className="mt-6">
                {activeLoans.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    eyebrow={t('lending.empty.eyebrow')}
                    title={t('lending.empty.activeTitle')}
                    description={t('lending.empty.activeDescription')}
                    action={{ label: t('lending.dialog.lendTitle'), onClick: () => setLendDialogOpen(true) }}
                    secondaryAction={{ label: t('lending.empty.browse'), onClick: () => navigate('/collections') }}
                    hint={t('lending.empty.activeHint')}
                  />
                ) : (
                  <div className="grid gap-4">
                    {activeLoans.map((loan) => {
                      const days = daysUntil(loan.record.expectedReturnDate, today);
                      const state = getScheduleState(days);
                      const isOverdue = state === 'overdue';
                      const statusText =
                        state === 'overdue'
                          ? t('lending.reminders.overdue', { count: Math.abs(days) })
                          : state === 'today'
                            ? t('lending.reminders.today')
                            : t('lending.reminders.dueIn', { count: days });

                      return (
                        <Card
                          key={`${loan.itemId}-${loan.record.id}`}
                          className={cn(
                            'transition-colors',
                            isOverdue && 'border-red-500/50 bg-red-500/5 dark:border-red-500/30 dark:bg-red-500/5',
                          )}
                        >
                          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  to={`/items/${loan.itemId}`}
                                  className="truncate text-base font-semibold hover:text-primary hover:underline"
                                >
                                  {loan.itemTitle}
                                </Link>
                                <Badge variant="secondary">{loan.categoryName}</Badge>
                                {isOverdue && (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="size-3" aria-hidden="true" />
                                    {t('lending.overdueBadge', { count: Math.abs(days) })}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <User className="size-3.5" aria-hidden="true" />
                                  {loan.record.borrowerName}
                                  {loan.record.borrowerContact && (
                                    <span className="text-xs">({loan.record.borrowerContact})</span>
                                  )}
                                </span>
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                  <Calendar className="size-3.5" aria-hidden="true" />
                                  {t('lending.lentOn', { date: formatDate(loan.record.lentDate) })}
                                </span>
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                  <CalendarClock className="size-3.5" aria-hidden="true" />
                                  {t('lending.dueOn', { date: formatDate(loan.record.expectedReturnDate) })}
                                </span>
                                <span className={cn('inline-flex items-center gap-1.5 tabular-nums', scheduleStateClass(state))}>
                                  <Clock className="size-3.5" aria-hidden="true" />
                                  {statusText}
                                </span>
                              </div>

                              {loan.record.notes && (
                                <p className="text-sm italic text-muted-foreground/80">{loan.record.notes}</p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 text-muted-foreground hover:text-primary sm:size-8"
                                aria-label={t('lending.addToCalendarNamed', { title: loan.itemTitle })}
                                onClick={() =>
                                  downloadCalendarEvent({
                                    ...loanCalendarEvent(loan),
                                    filename: `${loan.itemTitle}-${loan.record.expectedReturnDate}`,
                                  })
                                }
                              >
                                <CalendarPlus className="size-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 max-sm:h-9"
                                onClick={() => openReturnDialog(loan.itemId, loan.record.id, loan.itemTitle)}
                              >
                                <ArrowDownLeft className="size-3.5" />
                                {t('lending.markReturned')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* History */}
              <TabsContent value="history" className="mt-6">
                {historyRecords.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle}
                    eyebrow={t('lending.empty.eyebrow')}
                    title={t('lending.empty.historyTitle')}
                    description={t('lending.empty.historyDescription')}
                    action={{ label: t('lending.empty.browse'), onClick: () => navigate('/collections') }}
                    secondaryAction={{ label: t('lending.empty.trackLoan'), onClick: () => setLendDialogOpen(true) }}
                    hint={t('lending.empty.historyHint')}
                  />
                ) : (
                  <div className="grid gap-4">
                    {historyRecords.map((entry) => {
                      const badge = conditionBadgeProps(entry.record.condition);
                      return (
                        <Card key={`${entry.itemId}-${entry.record.id}`}>
                          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  to={`/items/${entry.itemId}`}
                                  className="truncate text-base font-semibold hover:text-primary hover:underline"
                                >
                                  {entry.itemTitle}
                                </Link>
                                <Badge variant="secondary">{entry.categoryName}</Badge>
                                <Badge variant={badge.variant} className={badge.className}>
                                  {t(`lending.condition.${entry.record.condition}`)}
                                </Badge>
                              </div>

                              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <User className="size-3.5" aria-hidden="true" />
                                  {entry.record.borrowerName}
                                </span>
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                  <Calendar className="size-3.5" aria-hidden="true" />
                                  {formatDate(entry.record.lentDate)} → {formatDate(entry.record.actualReturnDate!)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                  <Clock className="size-3.5" aria-hidden="true" />
                                  {t('lending.duration', { count: entry.duration })}
                                </span>
                              </div>

                              {entry.record.notes && (
                                <p className="text-sm italic text-muted-foreground/80">{entry.record.notes}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Lend dialog */}
        <Dialog
          open={lendDialogOpen}
          onOpenChange={(open) => {
            setLendDialogOpen(open);
            if (!open) resetLendForm();
          }}
        >
          <DialogContent>
            <DialogIconHeader
              icon={Send}
              title={t('lending.dialog.lendTitle')}
              description={t('lending.dialog.lendDescription')}
            />

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="lend-item">
                  {t('lending.field.item')}
                  <RequiredMark />
                </Label>
                <Select value={lendForm.itemId} onValueChange={(v) => setLendForm((f) => ({ ...f, itemId: v }))}>
                  <SelectTrigger id="lend-item">
                    <SelectValue placeholder={t('lending.field.itemPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {lendableItems.map(({ item, onLoan }) => (
                      <SelectItem key={item.id} value={item.id} disabled={onLoan}>
                        {onLoan ? t('lending.field.itemOnLoan', { title: item.title }) : item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="borrower-name">
                  {t('lending.field.borrowerName')}
                  <RequiredMark />
                </Label>
                <Input
                  id="borrower-name"
                  placeholder={t('lending.field.borrowerNamePlaceholder')}
                  value={lendForm.borrowerName}
                  onChange={(e) => setLendForm((f) => ({ ...f, borrowerName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="borrower-contact">{t('lending.field.borrowerContact')}</Label>
                <Input
                  id="borrower-contact"
                  placeholder={t('lending.field.borrowerContactPlaceholder')}
                  value={lendForm.borrowerContact}
                  onChange={(e) => setLendForm((f) => ({ ...f, borrowerContact: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected-return">
                  {t('lending.field.expectedReturn')}
                  <RequiredMark />
                </Label>
                <Input
                  id="expected-return"
                  type="date"
                  className="dark:[color-scheme:dark]"
                  min={today}
                  value={lendForm.expectedReturnDate}
                  onChange={(e) => setLendForm((f) => ({ ...f, expectedReturnDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lend-notes">{t('lending.field.notes')}</Label>
                <Textarea
                  id="lend-notes"
                  placeholder={t('lending.field.notesPlaceholder')}
                  value={lendForm.notes}
                  onChange={(e) => setLendForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setLendDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleLendSubmit}>
                <Send className="size-4" />
                {t('lending.lendItem')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark returned dialog */}
        <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogIconHeader
              icon={CheckCircle}
              tone="green"
              title={t('lending.dialog.returnTitle')}
              description={
                returnTarget
                  ? t('lending.dialog.returnDescriptionNamed', { title: returnTarget.itemTitle })
                  : t('lending.dialog.returnDescription')
              }
            />

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="return-condition">{t('lending.field.returnCondition')}</Label>
                <Select
                  value={returnCondition}
                  onValueChange={(v) => setReturnCondition(v as LendingRecord['condition'])}
                >
                  <SelectTrigger id="return-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_CONDITIONS.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {t(`lending.condition.${condition}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleReturnSubmit}>
                <CheckCircle className="size-4" />
                {t('lending.confirmReturn')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
