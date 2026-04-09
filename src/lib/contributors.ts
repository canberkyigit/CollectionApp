import type { CollectionItem, Contributor } from '@/types';
import { getItemCurrentValueUSD } from '@/lib/valuation';

export interface ContributorSummary extends Contributor {
  derivedItemCount: number;
  derivedTotalContributionValue: number;
  derivedLastContributionAt: string;
}

export function buildContributorSummaries(
  contributors: Contributor[],
  items: CollectionItem[],
): ContributorSummary[] {
  const contributorMap = new Map(contributors.map((contributor) => [contributor.id, contributor]));
  const metrics = new Map<string, { count: number; totalValue: number; lastAt: string }>();

  for (const item of items) {
    if (!item.contributorId || item.isArchived) continue;
    const current = metrics.get(item.contributorId) ?? {
      count: 0,
      totalValue: 0,
      lastAt: item.updatedAt || item.createdAt,
    };

    current.count += 1;
    current.totalValue += getItemCurrentValueUSD(item);

    const candidateDate = item.updatedAt || item.createdAt;
    if (new Date(candidateDate).getTime() > new Date(current.lastAt).getTime()) {
      current.lastAt = candidateDate;
    }

    metrics.set(item.contributorId, current);
  }

  for (const [contributorId, metric] of metrics) {
    if (!contributorMap.has(contributorId)) {
      contributorMap.set(contributorId, {
        id: contributorId,
        name: 'Unknown Contributor',
        avatar: '',
        role: 'viewer',
        joinedAt: metric.lastAt,
        itemCount: 0,
        totalContributionValue: 0,
        lastContributionAt: metric.lastAt,
      });
    }
  }

  return [...contributorMap.values()].map((contributor) => {
    const metric = metrics.get(contributor.id);
    return {
      ...contributor,
      derivedItemCount: metric?.count ?? 0,
      derivedTotalContributionValue: metric?.totalValue ?? 0,
      derivedLastContributionAt: metric?.lastAt ?? contributor.lastContributionAt,
    };
  });
}
