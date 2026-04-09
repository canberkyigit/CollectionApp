import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { LendingRecord } from '@/types';
import {
  Send,
  ArrowDownLeft,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  Calendar,
  Plus,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader, EmptyState, LoadingSkeleton, StatCard } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { cn, formatDate } from '@/lib/utils';
import { useCollectionStore } from '@/store/useCollectionStore';
import { selectIsColdLoading } from '@/store/collectionStore.selectors';

interface ActiveLoan {
  itemId: string;
  itemTitle: string;
  categoryName: string;
  record: LendingRecord;
}

function getDaysBetween(from: string, to: string) {
  const msPerDay = 86_400_000;
  return Math.ceil(
    (new Date(to).getTime() - new Date(from).getTime()) / msPerDay,
  );
}

function conditionBadgeProps(condition: LendingRecord['condition']) {
  switch (condition) {
    case 'same':
      return { variant: 'success' as const, label: 'Same' };
    case 'better':
      return {
        variant: 'outline' as const,
        className:
          'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400',
        label: 'Better',
      };
    case 'worse':
      return { variant: 'warning' as const, label: 'Worse' };
    case 'damaged':
      return { variant: 'destructive' as const, label: 'Damaged' };
    default:
      return { variant: 'secondary' as const, label: 'Pending' };
  }
}

export default function LendingTracker() {
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

  const [lendDialogOpen, setLendDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<{
    itemId: string;
    recordId: string;
    itemTitle: string;
  } | null>(null);
  const [returnCondition, setReturnCondition] =
    useState<LendingRecord['condition']>('same');

  const [lendForm, setLendForm] = useState({
    itemId: '',
    borrowerName: '',
    borrowerContact: '',
    expectedReturnDate: '',
    notes: '',
  });

  const today = new Date().toISOString().slice(0, 10);

  const activeLoans = useMemo<ActiveLoan[]>(() => {
    const loans: ActiveLoan[] = [];
    for (const item of items) {
      if (!item.lendingHistory.some((record) => !record.actualReturnDate)) {
        continue;
      }
      const cat = getCategoryById(item.categoryId);
      for (const record of item.lendingHistory) {
        if (!record.actualReturnDate) {
          loans.push({
            itemId: item.id,
            itemTitle: item.title,
            categoryName: cat?.name ?? 'Unknown',
            record,
          });
        }
      }
    }
    return loans.sort(
      (a, b) =>
        new Date(a.record.expectedReturnDate).getTime() -
        new Date(b.record.expectedReturnDate).getTime(),
    );
  }, [items, getCategoryById]);

  const historyRecords = useMemo(() => {
    const records: (ActiveLoan & { duration: number })[] = [];
    for (const item of items) {
      const cat = getCategoryById(item.categoryId);
      for (const record of item.lendingHistory) {
        if (record.actualReturnDate) {
          records.push({
            itemId: item.id,
            itemTitle: item.title,
            categoryName: cat?.name ?? 'Unknown',
            record,
            duration: getDaysBetween(record.lentDate, record.actualReturnDate),
          });
        }
      }
    }
    return records.sort(
      (a, b) =>
        new Date(b.record.actualReturnDate!).getTime() -
        new Date(a.record.actualReturnDate!).getTime(),
    );
  }, [items, getCategoryById]);

  const stats = useMemo(() => {
    const overdueCount = activeLoans.filter(
      (l) => l.record.expectedReturnDate < today,
    ).length;
    const totalAllTime = items.reduce(
      (sum, item) => sum + item.lendingHistory.length,
      0,
    );
    return {
      currentlyLent: activeLoans.length,
      overdue: overdueCount,
      totalAllTime,
    };
  }, [activeLoans, items, today]);

  function handleLendSubmit() {
    if (!lendForm.itemId || !lendForm.borrowerName || !lendForm.expectedReturnDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    addLendingRecord(lendForm.itemId, {
      borrowerName: lendForm.borrowerName,
      borrowerContact: lendForm.borrowerContact || undefined,
      lentDate: today,
      expectedReturnDate: lendForm.expectedReturnDate,
      notes: lendForm.notes || undefined,
      condition: 'pending',
    });
    toast.success('Item lent successfully');
    setLendDialogOpen(false);
    setLendForm({
      itemId: '',
      borrowerName: '',
      borrowerContact: '',
      expectedReturnDate: '',
      notes: '',
    });
  }

  function openReturnDialog(itemId: string, recordId: string, itemTitle: string) {
    setReturnTarget({ itemId, recordId, itemTitle });
    setReturnCondition('same');
    setReturnDialogOpen(true);
  }

  function handleReturnSubmit() {
    if (!returnTarget) return;
    returnLendingRecord(returnTarget.itemId, returnTarget.recordId, returnCondition);
    toast.success('Item marked as returned');
    setReturnDialogOpen(false);
    setReturnTarget(null);
  }

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Lending Tracker"
        description="Keep track of items lent to others"
      >
        <Button onClick={() => setLendDialogOpen(true)}>
          <Plus className="size-4" />
          Lend Item
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
          title="Currently Lent"
          value={String(stats.currentlyLent)}
          icon={Send}
          subtitle="active loans"
        />
        <StatCard
          title="Overdue"
          value={String(stats.overdue)}
          icon={AlertTriangle}
          subtitle="past due date"
          className={stats.overdue > 0 ? 'border-amber-500/40' : undefined}
        />
        <StatCard
          title="Total Lent"
          value={String(stats.totalAllTime)}
          icon={Clock}
          subtitle="all time"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            <Send className="size-3.5" />
            Active Loans
            {activeLoans.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {activeLoans.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <CheckCircle className="size-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Active Loans */}
        <TabsContent value="active" className="mt-6">
          {activeLoans.length === 0 ? (
            <EmptyState
              icon={Package}
              eyebrow="Lending"
              title="No active loans"
              description="All your items are safely at home. Use the Lend Item button to track a new loan."
              action={{
                label: 'Lend an Item',
                onClick: () => setLendDialogOpen(true),
              }}
              secondaryAction={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
              hint="Loan records help you keep borrower details, due dates, and return condition in one place."
            />
          ) : (
            <div className="grid gap-4">
              {activeLoans.map((loan) => {
                const isOverdue = loan.record.expectedReturnDate < today;
                const daysRemaining = getDaysBetween(
                  today,
                  loan.record.expectedReturnDate,
                );

                return (
                  <Card
                    key={`${loan.itemId}-${loan.record.id}`}
                    className={cn(
                      'transition-colors',
                      isOverdue &&
                        'border-red-500/50 bg-red-500/5 dark:border-red-500/30 dark:bg-red-500/5',
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
                              <AlertTriangle className="size-3" />
                              OVERDUE {Math.abs(daysRemaining)}d
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="size-3.5" />
                            {loan.record.borrowerName}
                            {loan.record.borrowerContact && (
                              <span className="text-xs">
                                ({loan.record.borrowerContact})
                              </span>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            Lent {formatDate(loan.record.lentDate)}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5',
                              isOverdue
                                ? 'font-medium text-red-600 dark:text-red-400'
                                : daysRemaining <= 3
                                  ? 'font-medium text-amber-600 dark:text-amber-400'
                                  : '',
                            )}
                          >
                            <Clock className="size-3.5" />
                            {isOverdue
                              ? `Due ${formatDate(loan.record.expectedReturnDate)}`
                              : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                          </span>
                        </div>

                        {loan.record.notes && (
                          <p className="text-sm text-muted-foreground/80 italic">
                            {loan.record.notes}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            openReturnDialog(
                              loan.itemId,
                              loan.record.id,
                              loan.itemTitle,
                            )
                          }
                        >
                          <ArrowDownLeft className="size-3.5" />
                          Mark Returned
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
              eyebrow="Lending"
              title="No lending history"
              description="Completed loans will appear here once items are returned."
              action={{ label: 'Browse Collections', onClick: () => navigate('/collections') }}
              secondaryAction={{
                label: 'Track a Loan',
                onClick: () => setLendDialogOpen(true),
              }}
              hint="Once an item is marked returned, it moves from Active Loans into this history tab automatically."
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
                          <Badge
                            variant={badge.variant}
                            className={badge.className}
                          >
                            {badge.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="size-3.5" />
                            {entry.record.borrowerName}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            {formatDate(entry.record.lentDate)} &rarr;{' '}
                            {formatDate(entry.record.actualReturnDate!)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-3.5" />
                            {entry.duration} day{entry.duration !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {entry.record.notes && (
                          <p className="text-sm text-muted-foreground/80 italic">
                            {entry.record.notes}
                          </p>
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

      {/* Lend Item Dialog */}
      <Dialog open={lendDialogOpen} onOpenChange={setLendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lend an Item</DialogTitle>
            <DialogDescription>
              Track an item you're lending to someone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lend-item">Item *</Label>
              <Select
                value={lendForm.itemId}
                onValueChange={(v) =>
                  setLendForm((f) => ({ ...f, itemId: v }))
                }
              >
                <SelectTrigger id="lend-item">
                  <SelectValue placeholder="Select an item" />
                </SelectTrigger>
                <SelectContent>
                  {items.filter((item) => !item.isArchived).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="borrower-name">Borrower Name *</Label>
              <Input
                id="borrower-name"
                placeholder="Who are you lending to?"
                value={lendForm.borrowerName}
                onChange={(e) =>
                  setLendForm((f) => ({ ...f, borrowerName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="borrower-contact">Borrower Contact</Label>
              <Input
                id="borrower-contact"
                placeholder="Phone, email, etc."
                value={lendForm.borrowerContact}
                onChange={(e) =>
                  setLendForm((f) => ({
                    ...f,
                    borrowerContact: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected-return">Expected Return Date *</Label>
              <Input
                id="expected-return"
                type="date"
                min={today}
                value={lendForm.expectedReturnDate}
                onChange={(e) =>
                  setLendForm((f) => ({
                    ...f,
                    expectedReturnDate: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lend-notes">Notes</Label>
              <Textarea
                id="lend-notes"
                placeholder="Any special conditions or reminders..."
                value={lendForm.notes}
                onChange={(e) =>
                  setLendForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleLendSubmit}>
              <Send className="size-4" />
              Lend Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Returned Dialog */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Returned</DialogTitle>
            <DialogDescription>
              {returnTarget
                ? `Record the return condition for "${returnTarget.itemTitle}".`
                : 'Record the return condition.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Return Condition</Label>
              <Select
                value={returnCondition}
                onValueChange={(v) =>
                  setReturnCondition(v as LendingRecord['condition'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same">Same</SelectItem>
                  <SelectItem value="better">Better</SelectItem>
                  <SelectItem value="worse">Worse</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleReturnSubmit}>
              <CheckCircle className="size-4" />
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}
