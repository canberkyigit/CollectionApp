import { t } from '@/i18n';

/** The admin hub lives inside Settings; /admin redirects here. */
export const SETTINGS_ADMIN_PATH = '/settings?section=admin';

type AdminBreadcrumb = {
  label: string;
  href?: string;
};

export function isSettingsAdminSource(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('from') === 'settings';
}

export function getAdminRootPath(_search?: string): string {
  return SETTINGS_ADMIN_PATH;
}

/** Keeps the `from=settings` marker on admin child links (harmless now that every root is Settings). */
export function withAdminSource(path: string, search: string): string {
  if (!isSettingsAdminSource(search)) return path;

  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('from', 'settings');
  const nextQuery = params.toString();

  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

/** Settings › Admin › …trail — admin pages always sit under the Settings admin section. */
export function getAdminBreadcrumbs(
  _search: string,
  trail: AdminBreadcrumb[] = [],
): AdminBreadcrumb[] {
  return [
    { label: t('admin.breadcrumb.settings'), href: SETTINGS_ADMIN_PATH },
    { label: t('admin.breadcrumb.admin'), href: SETTINGS_ADMIN_PATH },
    ...trail,
  ];
}
