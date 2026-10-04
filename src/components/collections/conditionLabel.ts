import { getConditionLabelKey } from '@/lib/conditionScales';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Localised label for a stored condition value (any category scale); free text is shown as-is. */
export function conditionLabel(t: Translate, condition: string): string {
  const key = getConditionLabelKey(condition);
  return key ? t(key) : condition;
}
