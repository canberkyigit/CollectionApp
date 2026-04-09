export const SETTINGS_ADMIN_PATH = '/settings?section=admin';

type AdminBreadcrumb = {
  label: string;
  href?: string;
};

export function isSettingsAdminSource(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('from') === 'settings';
}

export function getAdminRootPath(search: string): string {
  return isSettingsAdminSource(search) ? SETTINGS_ADMIN_PATH : '/admin';
}

export function withAdminSource(path: string, search: string): string {
  if (!isSettingsAdminSource(search)) return path;

  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('from', 'settings');
  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function getAdminBreadcrumbs(
  search: string,
  trail: AdminBreadcrumb[] = [],
): AdminBreadcrumb[] {
  if (isSettingsAdminSource(search)) {
    return [
      { label: 'Settings', href: SETTINGS_ADMIN_PATH },
      { label: 'Admin', href: SETTINGS_ADMIN_PATH },
      ...trail,
    ];
  }

  return [{ label: 'Admin', href: '/admin' }, ...trail];
}
