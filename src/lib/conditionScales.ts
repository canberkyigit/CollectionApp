import type { Category } from '@/types';
import { isBookCategory } from '@/lib/categoryKind';

/**
 * Category-aware condition grading.
 *
 * Each collectible kind gets the scale collectors actually use (Sheldon-style
 * buckets for coins, Goldmine for records, bookseller terms for books…).
 * Stored values stay plain English strings so existing data, CSV exports and
 * filters keep working; `getConditionLabelKey` gives the i18n key for display.
 */
export type CollectibleKind = 'books' | 'coins' | 'vinyl' | 'stamps' | 'toys' | 'watches' | 'comics' | 'default';

type CategoryLike = Pick<Category, 'id' | 'name' | 'slug'> & { fields?: Category['fields']; icon?: string };

export interface ConditionGrade {
  /** Stored value (English, stable). */
  value: string;
  /** i18n key suffix under `itemForm.condition.` */
  code: string;
  /** 0 (best) … 5 (worst) — lets other views sort/colour any scale consistently. */
  tier: number;
}

const DEFAULT_SCALE: ConditionGrade[] = [
  { value: 'Mint', code: 'mint', tier: 0 },
  { value: 'Near Mint', code: 'nearMint', tier: 1 },
  { value: 'Very Good', code: 'veryGood', tier: 2 },
  { value: 'Good', code: 'good', tier: 3 },
  { value: 'Fair', code: 'fair', tier: 4 },
  { value: 'Poor', code: 'poor', tier: 5 },
];

const BOOK_SCALE: ConditionGrade[] = [
  { value: 'As New', code: 'asNew', tier: 0 },
  { value: 'Fine', code: 'fine', tier: 1 },
  { value: 'Very Good', code: 'veryGood', tier: 2 },
  { value: 'Good', code: 'good', tier: 3 },
  { value: 'Fair', code: 'fair', tier: 4 },
  { value: 'Poor', code: 'poor', tier: 5 },
];

const COIN_SCALE: ConditionGrade[] = [
  { value: 'Uncirculated (MS)', code: 'coinMs', tier: 0 },
  { value: 'About Uncirculated (AU)', code: 'coinAu', tier: 1 },
  { value: 'Extremely Fine (XF)', code: 'coinXf', tier: 1 },
  { value: 'Very Fine (VF)', code: 'coinVf', tier: 2 },
  { value: 'Fine (F)', code: 'coinF', tier: 3 },
  { value: 'Very Good (VG)', code: 'coinVg', tier: 3 },
  { value: 'Good (G)', code: 'coinG', tier: 4 },
  { value: 'About Good (AG)', code: 'coinAg', tier: 4 },
  { value: 'Poor (P)', code: 'coinP', tier: 5 },
];

const VINYL_SCALE: ConditionGrade[] = [
  { value: 'Mint (M)', code: 'vinylM', tier: 0 },
  { value: 'Near Mint (NM)', code: 'vinylNm', tier: 1 },
  { value: 'Very Good Plus (VG+)', code: 'vinylVgPlus', tier: 2 },
  { value: 'Very Good (VG)', code: 'vinylVg', tier: 3 },
  { value: 'Good Plus (G+)', code: 'vinylGPlus', tier: 4 },
  { value: 'Good (G)', code: 'vinylG', tier: 4 },
  { value: 'Fair (F)', code: 'vinylF', tier: 5 },
  { value: 'Poor (P)', code: 'vinylP', tier: 5 },
];

const STAMP_SCALE: ConditionGrade[] = [
  { value: 'Mint never hinged (MNH)', code: 'stampMnh', tier: 0 },
  { value: 'Mint hinged (MH)', code: 'stampMh', tier: 1 },
  { value: 'Mint no gum (MNG)', code: 'stampMng', tier: 2 },
  { value: 'Used', code: 'stampUsed', tier: 3 },
  { value: 'Damaged', code: 'stampDamaged', tier: 5 },
];

const TOY_SCALE: ConditionGrade[] = [
  { value: 'Sealed (MISB)', code: 'toySealed', tier: 0 },
  { value: 'New, open box', code: 'toyOpenBox', tier: 1 },
  { value: 'Used, complete', code: 'toyComplete', tier: 3 },
  { value: 'Used, incomplete', code: 'toyIncomplete', tier: 4 },
  { value: 'Parts only', code: 'toyParts', tier: 5 },
];

const SCALES: Record<CollectibleKind, ConditionGrade[]> = {
  books: BOOK_SCALE,
  coins: COIN_SCALE,
  vinyl: VINYL_SCALE,
  stamps: STAMP_SCALE,
  toys: TOY_SCALE,
  watches: DEFAULT_SCALE,
  comics: DEFAULT_SCALE,
  default: DEFAULT_SCALE,
};

/** Legacy global scale (kept for callers that don't know the category). */
export const DEFAULT_CONDITION_VALUES = DEFAULT_SCALE.map((grade) => grade.value);

/** Case-insensitive whole-word matcher that also works for Turkish letters. */
function words(...alternatives: string[]): RegExp {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${alternatives.join('|')})(?:$|[^\\p{L}\\p{N}])`, 'iu');
}

const KIND_PATTERNS: { kind: CollectibleKind; ids: string[]; icons: string[]; pattern: RegExp }[] = [
  {
    kind: 'coins',
    ids: ['cat-coins'],
    icons: ['Coins'],
    pattern: words('coins?', 'numismatics?', 'banknotes?', 'madeni paralar?', 'paralar', 'sikkeler?', 'nümismatik', 'numismatik'),
  },
  {
    kind: 'vinyl',
    ids: ['cat-vinyl', 'cat-records'],
    icons: ['Disc', 'Disc2', 'Disc3', 'Music'],
    pattern: words('vinyls?', 'records?', 'lps?', 'plaklar?', '45 ?lik'),
  },
  {
    kind: 'stamps',
    ids: ['cat-stamps'],
    icons: ['Stamp'],
    pattern: words('stamps?', 'philately', 'pullar', 'pul', 'filateli'),
  },
  {
    kind: 'toys',
    ids: ['cat-lego'],
    icons: ['Puzzle', 'Gamepad2', 'Joystick'],
    pattern: words('lego', 'toys?', 'action figures?', 'figures', 'oyuncaklar?', 'figürler?'),
  },
  {
    kind: 'watches',
    ids: ['cat-watches'],
    icons: ['Watch'],
    pattern: words('watch(?:es)?', 'timepieces?', 'saatler?', 'kol saatleri?'),
  },
  {
    kind: 'comics',
    ids: ['cat-comics'],
    icons: [],
    pattern: words('comics?', 'manga', 'çizgi romanlar?', 'cizgi romanlar?'),
  },
];

/** Best guess at what a category holds — drives condition scale and lookup providers. */
export function getCollectibleKind(category: CategoryLike | null | undefined): CollectibleKind {
  if (!category) return 'default';
  if (isBookCategory(category)) return 'books';
  for (const entry of KIND_PATTERNS) {
    if (entry.ids.includes(category.id)) return entry.kind;
  }
  const haystacks = [category.name, category.slug.replace(/-/g, ' ')];
  for (const entry of KIND_PATTERNS) {
    if (haystacks.some((text) => entry.pattern.test(text))) return entry.kind;
  }
  for (const entry of KIND_PATTERNS) {
    if (category.icon && entry.icons.includes(category.icon)) return entry.kind;
  }
  return 'default';
}

export function getConditionScale(category: CategoryLike | null | undefined): ConditionGrade[] {
  return SCALES[getCollectibleKind(category)];
}

/**
 * Options for the condition select. A stored value that isn't on the scale
 * (older data, imports) is kept as an extra option so it still shows.
 */
export function getConditionOptions(
  category: CategoryLike | null | undefined,
  currentValue?: string,
): ConditionGrade[] {
  const scale = getConditionScale(category);
  const trimmed = currentValue?.trim();
  if (trimmed && !scale.some((grade) => grade.value === trimmed)) {
    const known = findGrade(trimmed);
    return [...scale, { value: trimmed, code: known?.code ?? '', tier: known?.tier ?? 3 }];
  }
  return scale;
}

const ALL_GRADES = Object.values(SCALES).flat();

function findGrade(value: string): ConditionGrade | undefined {
  const lower = value.trim().toLowerCase();
  return ALL_GRADES.find((grade) => grade.value.toLowerCase() === lower);
}

/** i18n key for a stored condition value, or undefined when it's free text. */
export function getConditionLabelKey(value: string): string | undefined {
  const grade = findGrade(value);
  return grade?.code ? `itemForm.condition.${grade.code}` : undefined;
}

/** 0 (best) … 5 (worst) for any known grade; undefined for free text. */
export function getConditionTier(value: string): number | undefined {
  return findGrade(value)?.tier;
}
