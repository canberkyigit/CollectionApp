import type { Contributor } from '@/types';

export const mockContributors: Contributor[] = [
  {
    id: 'contrib-1',
    name: 'Ahmet Yilmaz',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmet',
    role: 'admin',
    joinedAt: '2022-01-15T09:00:00Z',
    itemCount: 9,
    totalContributionValue: 4930,
    lastContributionAt: '2025-02-25T08:00:00Z',
  },
  {
    id: 'contrib-2',
    name: 'Elif Demir',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elif',
    role: 'editor',
    joinedAt: '2023-03-10T14:00:00Z',
    itemCount: 6,
    totalContributionValue: 2255,
    lastContributionAt: '2025-02-20T08:45:00Z',
  },
  {
    id: 'contrib-3',
    name: 'Can Ozturk',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Can',
    role: 'editor',
    joinedAt: '2023-06-22T10:00:00Z',
    itemCount: 5,
    totalContributionValue: 1815,
    lastContributionAt: '2025-02-25T10:00:00Z',
  },
  {
    id: 'contrib-4',
    name: 'Zeynep Kaya',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zeynep',
    role: 'viewer',
    joinedAt: '2024-01-08T11:30:00Z',
    itemCount: 4,
    totalContributionValue: 1655,
    lastContributionAt: '2025-02-25T10:00:00Z',
  },
];
