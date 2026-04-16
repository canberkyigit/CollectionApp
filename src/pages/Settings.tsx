import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useCollectionStore } from '@/store/useCollectionStore';
import { ConfirmDialog, PageHeader } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sun,
  Moon,
  Database,
  Bell,
  Palette,
  Settings2,
  Trash2,
  Sparkles,
  PanelLeft,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { AdminPanelSection } from '@/components/settings/AdminPanelSection';
import { ImportExportPanel, type ImportExportTab } from '@/components/settings/ImportExportPanel';
import { currencyService } from '@/services/currencyService';

type SettingsSection = 'admin' | 'appearance' | 'notifications' | 'data';

const sectionContent = {
  admin: {
    title: 'Workspace Control',
    description: 'Manage categories, libraries, and advanced tools from a single control center.',
    chips: ['Libraries', 'Categories', 'Automation'],
  },
  appearance: {
    title: 'Visual Preferences',
    description: 'Control theme, display currency, and navigation behavior for everyday browsing.',
    chips: ['Theme', 'Currency', 'Sidebar'],
  },
  notifications: {
    title: 'Alerts & Nudges',
    description: 'Choose which updates should surface while you manage and grow the collection.',
    chips: ['Value Alerts', 'Reminders', 'Milestones'],
  },
  data: {
    title: 'Data & Recovery',
    description: 'Handle imports, exports, backups, and destructive actions with a clear safety boundary.',
    chips: ['Import', 'Export', 'Local Sync'],
  },
} satisfies Record<SettingsSection, { title: string; description: string; chips: string[] }>;

function SettingsSummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-border/65 bg-background/55 p-4 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.32)] backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const {
    theme,
    toggleTheme,
    displayCurrency,
    setDisplayCurrency,
    menuCollectionStyle,
    setMenuCollectionStyle,
    notifications,
    setNotifications,
    wipeAllData,
  } = useCollectionStore();
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const requestedSection = searchParams.get('section') as SettingsSection | null;
  const fallbackSection: SettingsSection = isAdmin ? 'admin' : 'appearance';
  const activeSection = requestedSection === 'admin' && !isAdmin
    ? 'appearance'
    : (requestedSection ?? fallbackSection);
  const activeSectionMeta = sectionContent[activeSection];
  const requestedDataTab = searchParams.get('dataTab');
  const dataTab: ImportExportTab = requestedDataTab === 'import' || requestedDataTab === 'local-sync'
    ? requestedDataTab
    : 'export';

  const updateSearchParams = (updates: Partial<{ section: SettingsSection; dataTab: ImportExportTab }>) => {
    const nextParams = new URLSearchParams(searchParams);
    if (updates.section) {
      nextParams.set('section', updates.section);
    }
    if (updates.dataTab) {
      nextParams.set('dataTab', updates.dataTab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetAllData = async () => {
    try {
      await wipeAllData();
      setResetDialogOpen(false);
      toast.success('All collection data has been reset');
    } catch {
      toast.error('Failed to reset data');
    }
  };

  return (
    <PageTransition>
      <div className="max-w-6xl space-y-4 sm:space-y-6 md:space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your application preferences"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.9))] shadow-[0_18px_50px_rgb(15_23_42_/_0.06)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(15,23,42,0.9))] dark:shadow-[0_20px_60px_rgb(0_0_0_/_0.24)]">
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] lg:items-start">
          <div className="space-y-4">
            <Badge className="h-7 rounded-full border border-primary/15 bg-background/70 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
              <Sparkles className="mr-1.5 size-3.5" />
              Preferences Hub
            </Badge>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {activeSectionMeta.title}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                {activeSectionMeta.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeSectionMeta.chips.map((chip) => (
                <Badge key={chip} variant="secondary" className="h-6 rounded-full px-2.5 text-[11px]">
                  {chip}
                </Badge>
              ))}
              {isAdmin && (
                <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px]">
                  <ShieldCheck className="mr-1 size-3.5 text-primary" />
                  Admin access
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <SettingsSummaryTile
              label="Theme"
              value={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              hint="Applied across dashboard, detail, and collection views."
            />
            <SettingsSummaryTile
              label="Currency"
              value={`${currencyService.getCurrencySymbol(displayCurrency)} ${displayCurrency}`}
              hint="Used for totals, charts, valuation cards, and summaries."
            />
            <SettingsSummaryTile
              label="Sidebar"
              value={menuCollectionStyle === 'style2' ? 'Drill-in' : 'Tree View'}
              hint="Controls how categories and libraries are explored in the left rail."
            />
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeSection}
        onValueChange={(value) => updateSearchParams({ section: value as SettingsSection })}
        className="space-y-6"
      >
        <Card className="border-border/70 shadow-[0_10px_30px_rgb(15_23_42_/_0.04)]">
          <CardContent className="flex flex-col gap-4 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PanelLeft className="size-4 text-primary" />
                Sections
              </div>
              <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                Active
                <ChevronRight className="size-3.5" />
                <span className="font-medium text-foreground">{activeSectionMeta.title}</span>
              </div>
            </div>
            <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-muted/35 p-1.5">
              {isAdmin && (
                <TabsTrigger value="admin" className="gap-2 rounded-xl">
                  <Settings2 className="size-4" />
                  Admin
                </TabsTrigger>
              )}
              <TabsTrigger value="appearance" className="gap-2 rounded-xl">
                <Palette className="size-4" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 rounded-xl">
                <Bell className="size-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2 rounded-xl">
                <Database className="size-4" />
                Data
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <AdminPanelSection />
          </TabsContent>
        )}

        <TabsContent value="appearance" className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Display
              </CardTitle>
              <CardDescription>Control the main presentation of the app across pages and charts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle between dark and light themes
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Display Currency</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose the currency used for portfolio totals, charts, and valuation summaries
                  </p>
                </div>
                <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                  <SelectTrigger className="w-[180px]" aria-label="Display Currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyService.getSupportedCurrencies().map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currencyService.getCurrencySymbol(currency)} {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PanelLeft className="h-5 w-5 text-primary" />
                Workspace Layout
              </CardTitle>
              <CardDescription>Adjust navigation density and the way collections are explored</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Reduce spacing for denser layouts
                  </p>
                </div>
                <Switch disabled />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Menu Collection Style</Label>
                  <p className="text-sm text-muted-foreground">
                    How collections and libraries appear in the sidebar
                  </p>
                </div>
                <Select
                  value={menuCollectionStyle}
                  onValueChange={(v) => setMenuCollectionStyle(v as 'style1' | 'style2')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="style1">Style 1 - Tree View</SelectItem>
                    <SelectItem value="style2">Style 2 - Drill-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose which updates deserve proactive attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Value change alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when item values change by 10% or more</p>
                </div>
                <Switch
                  checked={notifications.valueChangeAlerts}
                  onCheckedChange={(v) => setNotifications({ valueChangeAlerts: v })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">New item reminders</Label>
                  <p className="text-sm text-muted-foreground">Remind to add items periodically</p>
                </div>
                <Switch
                  checked={notifications.newItemReminders}
                  onCheckedChange={(v) => setNotifications({ newItemReminders: v })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Collection milestones</Label>
                  <p className="text-sm text-muted-foreground">Celebrate when you reach 10, 25, 50, 100... items</p>
                </div>
                <Switch
                  checked={notifications.collectionMilestones}
                  onCheckedChange={(v) => setNotifications({ collectionMilestones: v })}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Delivery Notes
              </CardTitle>
              <CardDescription>How these notifications fit into the broader workflow</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Value alerts are best for collectors actively tracking appreciation and resale opportunities.
              </p>
              <p>
                New item reminders work well when capture speed matters and entries are often added in batches.
              </p>
              <p>
                Milestone notifications keep the product celebratory without adding noisy day-to-day interruptions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data Management
              </CardTitle>
              <CardDescription>Import, export, and manage your collection data in one place</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">Export</Badge>
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">Import</Badge>
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">Backup</Badge>
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">Local Sync</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Use the tools below to create backups, move data between devices, or import spreadsheets directly into your collection.
              </p>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base text-destructive">Danger Zone</Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all data. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={user?.role !== 'admin'}
                  onClick={() => setResetDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset All Data
                </Button>
              </div>
            </CardContent>
          </Card>

          <ImportExportPanel
            activeTab={dataTab}
            onTabChange={(nextTab) => updateSearchParams({ section: 'data', dataTab: nextTab })}
          />
        </TabsContent>
      </Tabs>

    </div>
    <ConfirmDialog
      open={resetDialogOpen}
      onClose={() => setResetDialogOpen(false)}
      onConfirm={() => void handleResetAllData()}
      title="Reset all collection data?"
      description="This will permanently remove categories, items, contributors, wishlist data, and activity history for the current account."
      confirmLabel="Reset Data"
      destructive
    />
    </PageTransition>
  );
}
