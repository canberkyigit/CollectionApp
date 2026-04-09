import { PageHeader } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { AdminPanelSection } from '@/components/settings/AdminPanelSection';

export default function Admin() {
  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title="Admin Panel"
          description="Manage categories, fields, and application settings"
        />
        <AdminPanelSection />
      </div>
    </PageTransition>
  );
}
