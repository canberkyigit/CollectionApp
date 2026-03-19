import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  variant: 'card' | 'table' | 'detail' | 'list';
  count?: number;
  className?: string;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border p-6 space-y-4">
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton className="size-10 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-6 w-14 rounded-full" />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <Skeleton className="h-64 w-full rounded-xl sm:w-80" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <Skeleton className="size-12 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/5" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

const skeletonComponents = {
  card: CardSkeleton,
  table: TableSkeleton,
  detail: DetailSkeleton,
  list: ListSkeleton,
} as const;

export function LoadingSkeleton({
  variant,
  count = 4,
  className,
}: LoadingSkeletonProps) {
  const SkeletonItem = skeletonComponents[variant];

  if (variant === 'detail') {
    return (
      <div className={className}>
        <DetailSkeleton />
      </div>
    );
  }

  return (
    <div
      className={cn(
        variant === 'card'
          ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'
          : 'space-y-2',
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonItem key={i} />
      ))}
    </div>
  );
}
