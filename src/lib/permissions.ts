import type { ContributorRole } from '@/types';
import { t } from '@/i18n';

export type CollectionPermission =
  | 'content:edit'
  | 'catalog:manage'
  | 'item:delete-permanently'
  | 'activity:clear';

const ROLE_RANK: Record<ContributorRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
};

function hasMinimumRole(role: ContributorRole, minimum: ContributorRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canEditContent(role: ContributorRole): boolean {
  return hasMinimumRole(role, 'editor');
}

export function canManageCatalog(role: ContributorRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function canPermanentlyDeleteItems(role: ContributorRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function canClearActivityLog(role: ContributorRole): boolean {
  return hasMinimumRole(role, 'admin');
}

export function hasPermission(role: ContributorRole, permission: CollectionPermission): boolean {
  switch (permission) {
    case 'content:edit':
      return canEditContent(role);
    case 'catalog:manage':
      return canManageCatalog(role);
    case 'item:delete-permanently':
      return canPermanentlyDeleteItems(role);
    case 'activity:clear':
      return canClearActivityLog(role);
    default:
      return false;
  }
}

export function getPermissionDeniedMessage(permission: CollectionPermission): string {
  switch (permission) {
    case 'content:edit':
      return t('common.permission.contentEdit');
    case 'catalog:manage':
      return t('common.permission.catalogManage');
    case 'item:delete-permanently':
      return t('common.permission.deletePermanently');
    case 'activity:clear':
      return t('common.permission.activityClear');
    default:
      return t('common.permission.default');
  }
}
