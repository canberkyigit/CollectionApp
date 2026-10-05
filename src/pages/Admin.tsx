import { Navigate } from 'react-router-dom';

import { SETTINGS_ADMIN_PATH } from '@/lib/adminNavigation';

/** The admin hub lives in Settings → Admin; keep /admin working as a redirect. */
export default function Admin() {
  return <Navigate to={SETTINGS_ADMIN_PATH} replace />;
}
