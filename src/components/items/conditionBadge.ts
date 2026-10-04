import { getConditionTier } from '@/lib/conditionScales';

type ConditionBadgeVariant = 'success' | 'outline' | 'warning' | 'destructive' | 'secondary';

/**
 * Original condition badge colours (green → blue → amber → red), mapped by
 * grade tier so every category scale (coins, vinyl, books…) gets a colour.
 */
export function getConditionBadgeStyle(condition: string): { variant: ConditionBadgeVariant; className?: string } {
  const tier = getConditionTier(condition);
  if (tier === undefined) return { variant: 'secondary' };
  if (tier <= 1) return { variant: 'success' };
  if (tier <= 3) {
    return {
      variant: 'outline',
      className: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400',
    };
  }
  if (tier === 4) return { variant: 'warning' };
  return { variant: 'destructive' };
}
