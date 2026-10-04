import type {
  ActivityLogEntry,
  Category,
  CollectionItem,
  Contributor,
  DashboardWidgetConfig,
  Library,
  WishlistItem,
} from '@/types';
import { BRAND_NAME } from '@/lib/brand';
import { t } from '@/i18n';

export const SUPPORTED_BACKUP_SCHEMA_VERSION = 1;

export type BackupRestoreMode = 'merge' | 'replace';

export interface BackupUserSettings {
  displayCurrency: string;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  menuCollectionStyle: 'style1' | 'style2';
  dashboardWidgets: DashboardWidgetConfig[];
  readNotificationIds: string[];
  notifications: {
    valueChangeAlerts: boolean;
    newItemReminders: boolean;
    collectionMilestones: boolean;
  };
}

export interface BackupBundle {
  schemaVersion: number;
  exportedAt?: string;
  categories: Category[];
  items: CollectionItem[];
  libraries: Library[];
  wishlist: WishlistItem[];
  activityLog: ActivityLogEntry[];
  contributors: Contributor[];
  settings?: Partial<BackupUserSettings>;
}

export interface RestorableBackupState {
  categories: Category[];
  items: CollectionItem[];
  libraries: Library[];
  wishlist: WishlistItem[];
  activityLog: ActivityLogEntry[];
  contributors: Contributor[];
  settings: BackupUserSettings;
}

export interface BackupRestoreIssue {
  collection: 'categories' | 'items' | 'libraries' | 'wishlist' | 'activityLog' | 'contributors' | 'settings';
  index?: number;
  id?: string;
  title?: string;
  reason: string;
}

export interface BackupRestoreConflict {
  collection: BackupRestoreIssue['collection'];
  id: string;
  label: string;
}

export interface BackupRestorePreview {
  mode: BackupRestoreMode;
  schemaVersion: number | null;
  exportedAt?: string;
  canRestore: boolean;
  incomingCounts: Record<'categories' | 'items' | 'libraries' | 'wishlist' | 'activityLog' | 'contributors', number>;
  currentCounts: Record<'categories' | 'items' | 'libraries' | 'wishlist' | 'activityLog' | 'contributors', number>;
  resultCounts: Record<'categories' | 'items' | 'libraries' | 'wishlist' | 'activityLog' | 'contributors', number>;
  conflicts: BackupRestoreConflict[];
  skipped: BackupRestoreIssue[];
  errors: string[];
  warnings: string[];
}

type CollectionName = keyof BackupRestorePreview['incomingCounts'];

const EMPTY_COUNTS: BackupRestorePreview['incomingCounts'] = {
  categories: 0,
  items: 0,
  libraries: 0,
  wishlist: 0,
  activityLog: 0,
  contributors: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function countState(state: Pick<RestorableBackupState, CollectionName>) {
  return {
    categories: state.categories.length,
    items: state.items.length,
    libraries: state.libraries.length,
    wishlist: state.wishlist.length,
    activityLog: state.activityLog.length,
    contributors: state.contributors.length,
  };
}

function getLabel(entry: unknown): string {
  if (!isRecord(entry)) return t('common.untitled');
  const title = entry.title;
  if (typeof title === 'string' && title.trim()) return title;
  const name = entry.name;
  if (typeof name === 'string' && name.trim()) return name;
  const entityTitle = entry.entityTitle;
  if (typeof entityTitle === 'string' && entityTitle.trim()) return entityTitle;
  const id = entry.id;
  return typeof id === 'string' && id.trim() ? id : t('common.untitled');
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    // Circular or otherwise unserialisable data — treat as different.
    return false;
  }
}

function validCategory(entry: unknown): entry is Category {
  return isRecord(entry)
    && hasString(entry.id)
    && hasString(entry.name)
    && hasString(entry.slug)
    && hasString(entry.icon)
    && Array.isArray(entry.fields)
    && typeof entry.order === 'number'
    && hasString(entry.createdAt)
    && hasString(entry.updatedAt);
}

function validItem(entry: unknown, validCategoryIds: Set<string>): entry is CollectionItem {
  return isRecord(entry)
    && hasString(entry.id)
    && hasString(entry.categoryId)
    && validCategoryIds.has(entry.categoryId)
    && hasString(entry.title)
    && typeof entry.description === 'string'
    && isRecord(entry.customFields)
    && typeof entry.notes === 'string'
    && Array.isArray(entry.tags)
    && Array.isArray(entry.images)
    && isRecord(entry.purchaseInfo)
    && isRecord(entry.valuationInfo)
    && hasString(entry.contributorId)
    && hasString(entry.condition)
    && typeof entry.isFavorite === 'boolean'
    && Array.isArray(entry.maintenanceLog)
    && Array.isArray(entry.lendingHistory)
    && hasString(entry.createdAt)
    && hasString(entry.updatedAt);
}

function validLibrary(entry: unknown): entry is Library {
  return isRecord(entry)
    && hasString(entry.id)
    && hasString(entry.name)
    && typeof entry.order === 'number'
    && hasString(entry.createdAt)
    && hasString(entry.updatedAt);
}

function validWishlist(entry: unknown, validCategoryIds: Set<string>): entry is WishlistItem {
  return isRecord(entry)
    && hasString(entry.id)
    && hasString(entry.categoryId)
    && validCategoryIds.has(entry.categoryId)
    && hasString(entry.title)
    && typeof entry.description === 'string'
    && hasString(entry.priority)
    && Array.isArray(entry.images)
    && Array.isArray(entry.tags)
    && hasString(entry.addedBy)
    && typeof entry.isAcquired === 'boolean'
    && hasString(entry.createdAt)
    && hasString(entry.updatedAt);
}

function validActivity(entry: unknown): entry is ActivityLogEntry {
  return isRecord(entry)
    && hasString(entry.id)
    && hasString(entry.action)
    && hasString(entry.entityType)
    && hasString(entry.entityId)
    && hasString(entry.entityTitle)
    && hasString(entry.userId)
    && hasString(entry.timestamp);
}

function validContributor(entry: unknown): entry is Contributor {
  return isRecord(entry)
    && hasString(entry.id)
    && hasString(entry.name)
    && hasString(entry.avatar)
    && hasString(entry.role)
    && hasString(entry.joinedAt)
    && typeof entry.itemCount === 'number'
    && typeof entry.totalContributionValue === 'number'
    && hasString(entry.lastContributionAt);
}

function collectValid<T>(
  collection: BackupRestoreIssue['collection'],
  entries: unknown[],
  validator: (entry: unknown) => entry is T,
  reason: string,
): { valid: T[]; skipped: BackupRestoreIssue[] } {
  const valid: T[] = [];
  const skipped: BackupRestoreIssue[] = [];

  entries.forEach((entry, index) => {
    if (validator(entry)) {
      valid.push(entry);
      return;
    }

    skipped.push({
      collection,
      index,
      id: isRecord(entry) && typeof entry.id === 'string' ? entry.id : undefined,
      title: getLabel(entry),
      reason,
    });
  });

  return { valid, skipped };
}

function sanitizeSettings(
  rawSettings: unknown,
  currentSettings: BackupUserSettings,
): BackupUserSettings {
  if (!isRecord(rawSettings)) return currentSettings;

  return {
    displayCurrency: typeof rawSettings.displayCurrency === 'string'
      ? rawSettings.displayCurrency
      : currentSettings.displayCurrency,
    theme: rawSettings.theme === 'dark' || rawSettings.theme === 'light'
      ? rawSettings.theme
      : currentSettings.theme,
    sidebarOpen: typeof rawSettings.sidebarOpen === 'boolean'
      ? rawSettings.sidebarOpen
      : currentSettings.sidebarOpen,
    menuCollectionStyle: rawSettings.menuCollectionStyle === 'style1' || rawSettings.menuCollectionStyle === 'style2'
      ? rawSettings.menuCollectionStyle
      : currentSettings.menuCollectionStyle,
    dashboardWidgets: Array.isArray(rawSettings.dashboardWidgets)
      ? rawSettings.dashboardWidgets as DashboardWidgetConfig[]
      : currentSettings.dashboardWidgets,
    readNotificationIds: Array.isArray(rawSettings.readNotificationIds)
      ? rawSettings.readNotificationIds.filter((id): id is string => typeof id === 'string')
      : currentSettings.readNotificationIds,
    notifications: isRecord(rawSettings.notifications)
      ? {
          valueChangeAlerts: typeof rawSettings.notifications.valueChangeAlerts === 'boolean'
            ? rawSettings.notifications.valueChangeAlerts
            : currentSettings.notifications.valueChangeAlerts,
          newItemReminders: typeof rawSettings.notifications.newItemReminders === 'boolean'
            ? rawSettings.notifications.newItemReminders
            : currentSettings.notifications.newItemReminders,
          collectionMilestones: typeof rawSettings.notifications.collectionMilestones === 'boolean'
            ? rawSettings.notifications.collectionMilestones
            : currentSettings.notifications.collectionMilestones,
        }
      : currentSettings.notifications,
  };
}

function validateBackup(rawBackup: unknown, current: RestorableBackupState) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skipped: BackupRestoreIssue[] = [];

  if (!isBackupBundle(rawBackup)) {
    errors.push(t('data.backup.error.invalidFile', { brand: BRAND_NAME }));
    return {
      bundle: null,
      skipped,
      errors,
      warnings,
    };
  }

  if (rawBackup.schemaVersion !== SUPPORTED_BACKUP_SCHEMA_VERSION) {
    errors.push(t('data.backup.error.unsupportedSchema', {
      version: String(rawBackup.schemaVersion),
      supported: SUPPORTED_BACKUP_SCHEMA_VERSION,
    }));
    return {
      bundle: null,
      skipped,
      errors,
      warnings,
    };
  }

  const requiredCollections: CollectionName[] = [
    'categories',
    'items',
    'libraries',
    'wishlist',
    'activityLog',
    'contributors',
  ];
  for (const collection of requiredCollections) {
    if (!Array.isArray(rawBackup[collection])) {
      errors.push(t('data.backup.error.missingArray', { collection }));
    }
  }
  if (errors.length > 0) {
    return {
      bundle: null,
      skipped,
      errors,
      warnings,
    };
  }

  const categories = collectValid<Category>(
    'categories',
    asArray(rawBackup.categories),
    validCategory,
    t('data.backup.skip.category'),
  );
  skipped.push(...categories.skipped);

  const validCategoryIds = new Set([
    ...current.categories.map((category) => category.id),
    ...categories.valid.map((category) => category.id),
  ]);

  const items = collectValid<CollectionItem>(
    'items',
    asArray(rawBackup.items),
    (entry): entry is CollectionItem => validItem(entry, validCategoryIds),
    t('data.backup.skip.item'),
  );
  const libraries = collectValid<Library>(
    'libraries',
    asArray(rawBackup.libraries),
    validLibrary,
    t('data.backup.skip.library'),
  );
  const wishlist = collectValid<WishlistItem>(
    'wishlist',
    asArray(rawBackup.wishlist),
    (entry): entry is WishlistItem => validWishlist(entry, validCategoryIds),
    t('data.backup.skip.wishlist'),
  );
  const activityLog = collectValid<ActivityLogEntry>(
    'activityLog',
    asArray(rawBackup.activityLog),
    validActivity,
    t('data.backup.skip.activity'),
  );
  const contributors = collectValid<Contributor>(
    'contributors',
    asArray(rawBackup.contributors),
    validContributor,
    t('data.backup.skip.contributor'),
  );

  skipped.push(
    ...items.skipped,
    ...libraries.skipped,
    ...wishlist.skipped,
    ...activityLog.skipped,
    ...contributors.skipped,
  );

  if (!isRecord(rawBackup.settings)) {
    warnings.push(t('data.backup.warning.noSettings'));
  }

  return {
    bundle: {
      schemaVersion: rawBackup.schemaVersion,
      exportedAt: rawBackup.exportedAt,
      categories: categories.valid,
      items: items.valid,
      libraries: libraries.valid,
      wishlist: wishlist.valid,
      activityLog: activityLog.valid,
      contributors: contributors.valid,
      settings: sanitizeSettings(rawBackup.settings, current.settings),
    },
    skipped,
    errors,
    warnings,
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()];
}

function buildConflicts<T extends { id: string }>(
  collection: BackupRestoreIssue['collection'],
  current: T[],
  incoming: T[],
) {
  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  return incoming.flatMap((entry): BackupRestoreConflict[] => {
    const existing = currentById.get(entry.id);
    if (!existing || sameJson(existing, entry)) return [];
    return [{ collection, id: entry.id, label: getLabel(entry) }];
  });
}

export function isBackupBundle(value: unknown): value is BackupBundle {
  return isRecord(value) && typeof value.schemaVersion === 'number' && Number.isFinite(value.schemaVersion);
}

export function buildBackupRestoreState(
  rawBackup: unknown,
  current: RestorableBackupState,
  mode: BackupRestoreMode,
): RestorableBackupState | null {
  const { bundle, errors } = validateBackup(rawBackup, current);
  if (!bundle || errors.length > 0) return null;

  if (mode === 'replace') {
    return {
      categories: bundle.categories,
      items: bundle.items,
      libraries: bundle.libraries,
      wishlist: bundle.wishlist,
      activityLog: bundle.activityLog,
      contributors: bundle.contributors,
      settings: bundle.settings,
    };
  }

  return {
    categories: mergeById(current.categories, bundle.categories),
    items: mergeById(current.items, bundle.items),
    libraries: mergeById(current.libraries, bundle.libraries),
    wishlist: mergeById(current.wishlist, bundle.wishlist),
    activityLog: mergeById(current.activityLog, bundle.activityLog),
    contributors: mergeById(current.contributors, bundle.contributors),
    settings: current.settings,
  };
}

export function buildBackupRestorePreview(
  rawBackup: unknown,
  current: RestorableBackupState,
  mode: BackupRestoreMode,
): BackupRestorePreview {
  const { bundle, skipped, errors, warnings } = validateBackup(rawBackup, current);
  const restored = buildBackupRestoreState(rawBackup, current, mode);

  const conflicts = bundle
    ? [
        ...buildConflicts('categories', current.categories, bundle.categories),
        ...buildConflicts('items', current.items, bundle.items),
        ...buildConflicts('libraries', current.libraries, bundle.libraries),
        ...buildConflicts('wishlist', current.wishlist, bundle.wishlist),
        ...buildConflicts('activityLog', current.activityLog, bundle.activityLog),
        ...buildConflicts('contributors', current.contributors, bundle.contributors),
      ]
    : [];

  return {
    mode,
    schemaVersion: isBackupBundle(rawBackup) ? rawBackup.schemaVersion : null,
    exportedAt: bundle?.exportedAt,
    canRestore: Boolean(bundle && restored && errors.length === 0),
    incomingCounts: bundle ? countState(bundle) : EMPTY_COUNTS,
    currentCounts: countState(current),
    resultCounts: restored ? countState(restored) : countState(current),
    conflicts,
    skipped,
    errors,
    warnings,
  };
}
