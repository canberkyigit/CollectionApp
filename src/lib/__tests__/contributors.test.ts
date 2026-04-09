import { describe, expect, it } from 'vitest';

import { buildContributorSummaries } from '../contributors';
import { createMockItem } from '@/test/helpers';

describe('buildContributorSummaries', () => {
  it('derives item count and value from live items', () => {
    const summaries = buildContributorSummaries(
      [
        {
          id: 'user-1',
          name: 'Ada Lovelace',
          avatar: '',
          role: 'admin',
          joinedAt: '2024-01-01T00:00:00Z',
          itemCount: 0,
          totalContributionValue: 0,
          lastContributionAt: '2024-01-01T00:00:00Z',
        },
      ],
      [
        {
          ...createMockItem({
            contributorId: 'user-1',
            valuationInfo: {
              currentEstimatedValue: 100,
              currentValueCurrency: 'USD',
              currentExchangeRate: 1,
              valueHistory: [],
            },
          }),
          id: 'item-1',
          createdAt: '2024-01-05T00:00:00Z',
          updatedAt: '2024-01-06T00:00:00Z',
        },
      ],
    );

    expect(summaries[0]).toMatchObject({
      id: 'user-1',
      derivedItemCount: 1,
      derivedTotalContributionValue: 100,
      derivedLastContributionAt: '2024-01-06T00:00:00Z',
    });
  });

  it('creates a fallback contributor summary for unknown contributor ids', () => {
    const summaries = buildContributorSummaries(
      [],
      [
        {
          ...createMockItem({ contributorId: 'ghost-user' }),
          id: 'item-2',
          createdAt: '2024-01-05T00:00:00Z',
          updatedAt: '2024-01-06T00:00:00Z',
        },
      ],
    );

    expect(summaries[0]).toMatchObject({
      id: 'ghost-user',
      name: 'Unknown Contributor',
      derivedItemCount: 1,
    });
  });
});
