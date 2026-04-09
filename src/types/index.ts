export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'currency'
  | 'boolean'
  | 'image'
  | 'tags'
  | 'rich-notes';

export interface CategoryField {
  id: string;
  label: string;
  key: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string | number | boolean;
  order: number;
  helpText?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  coverImage?: string;
  description: string;
  fields: CategoryField[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyEquivalent {
  currency: string;
  rate: number;
  value: number;
}

export interface PurchaseInfo {
  purchasedAt: string;
  purchasePrice: number;
  purchaseCurrency: string;
  exchangeRateAtPurchase: number;
  purchaseLocation?: string;
  currencyEquivalents?: CurrencyEquivalent[];
}

export interface ValueHistoryEntry {
  date: string;
  value: number;
  currency: string;
}

export interface ValuationInfo {
  currentEstimatedValue: number;
  currentValueCurrency: string;
  currentExchangeRate: number;
  targetYearProjection?: number;
  targetEstimatedValue?: number;
  valueHistory: ValueHistoryEntry[];
}

export interface MaintenanceEntry {
  id: string;
  date: string;
  type: 'cleaning' | 'repair' | 'restoration' | 'inspection' | 'other';
  description: string;
  cost?: number;
  currency?: string;
  provider?: string;
  nextScheduled?: string;
}

export interface LendingRecord {
  id: string;
  borrowerName: string;
  borrowerContact?: string;
  lentDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  notes?: string;
  condition: 'same' | 'better' | 'worse' | 'damaged' | 'pending';
}

export interface CollectionItem {
  id: string;
  categoryId: string;
  libraryId?: string;
  title: string;
  description: string;
  customFields: Record<string, unknown>;
  notes: string;
  tags: string[];
  images: string[];
  purchaseInfo: PurchaseInfo;
  valuationInfo: ValuationInfo;
  contributorId: string;
  condition: string;
  location?: string;
  quantity?: number;
  isRead?: boolean;
  isFavorite: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  maintenanceLog: MaintenanceEntry[];
  lendingHistory: LendingRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Library {
  id: string;
  name: string;
  categoryIds?: string[];
  categoryId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  targetPrice?: number;
  targetCurrency?: string;
  priority: 'low' | 'medium' | 'high' | 'must-have';
  source?: string;
  sourceUrl?: string;
  notes?: string;
  images: string[];
  tags: string[];
  addedBy: string;
  isAcquired: boolean;
  acquiredItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityAction =
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'item_favorited'
  | 'item_unfavorited'
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  | 'item_lent'
  | 'item_returned'
  | 'maintenance_added'
  | 'wishlist_added'
  | 'wishlist_acquired'
  | 'export_created';

export interface ActivityLogEntry {
  id: string;
  action: ActivityAction;
  entityType: 'item' | 'category' | 'wishlist' | 'system';
  entityId: string;
  entityTitle: string;
  details?: string;
  userId: string;
  timestamp: string;
}

export type ContributorRole = 'admin' | 'editor' | 'viewer';

export interface Contributor {
  id: string;
  name: string;
  avatar: string;
  role: ContributorRole;
  joinedAt: string;
  itemCount: number;
  totalContributionValue: number;
  lastContributionAt: string;
}

export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  date: string;
}

export type ViewMode = 'grid' | 'table' | 'covers' | 'names';
export type SortField = 'title' | 'createdAt' | 'updatedAt' | 'purchasePrice' | 'currentValue' | 'condition' | 'publisher';
export type SortOrder = 'asc' | 'desc';

export type DashboardWidgetId =
  | 'stats'
  | 'value-over-time'
  | 'category-distribution'
  | 'value-by-category'
  | 'acquisition-timeline'
  | 'recent-items'
  | 'contributors'
  | 'starred-items'
  | 'wishlist'
  | 'recent-activity'
  | 'quick-actions';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  label: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
  size: 'full' | 'half' | 'third';
}
