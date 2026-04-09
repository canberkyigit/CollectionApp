import { describe, expect, it } from 'vitest';
import {
  canClearActivityLog,
  canEditContent,
  canManageCatalog,
  canPermanentlyDeleteItems,
  getPermissionDeniedMessage,
  hasPermission,
} from '@/lib/permissions';

describe('permissions helpers', () => {
  it('allows editors to edit content but not admin-only actions', () => {
    expect(canEditContent('editor')).toBe(true);
    expect(canManageCatalog('editor')).toBe(false);
    expect(canPermanentlyDeleteItems('editor')).toBe(false);
    expect(canClearActivityLog('editor')).toBe(false);
  });

  it('keeps viewers read-only', () => {
    expect(hasPermission('viewer', 'content:edit')).toBe(false);
    expect(hasPermission('viewer', 'catalog:manage')).toBe(false);
    expect(getPermissionDeniedMessage('content:edit')).toContain('read-only');
  });

  it('lets admins perform every protected action', () => {
    expect(hasPermission('admin', 'content:edit')).toBe(true);
    expect(hasPermission('admin', 'catalog:manage')).toBe(true);
    expect(hasPermission('admin', 'item:delete-permanently')).toBe(true);
    expect(hasPermission('admin', 'activity:clear')).toBe(true);
  });
});
