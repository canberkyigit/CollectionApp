import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
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
  KeyRound,
  type LucideIcon,
} from 'lucide-react';

import { useCollectionStore } from '@/store/useCollectionStore';
import { useAuthStore } from '@/store/useAuthStore';
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
import { AdminPanelSection } from '@/components/settings/AdminPanelSection';
import { IntegrationsSection } from '@/components/settings/IntegrationsSection';
import { ImportExportPanel, type ImportExportTab } from '@/components/settings/ImportExportPanel';
import { currencyService } from '@/services/currencyService';
import { LANGUAGES, useLanguageStore, useT, type Language } from '@/i18n';

const SECTIONS = ['admin', 'appearance', 'notifications', 'integrations', 'data'] as const;
type SettingsSection = (typeof SECTIONS)[number];

const SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  admin: Settings2,
  appearance: Palette,
  notifications: Bell,
  integrations: KeyRound,
  data: Database,
};

const SECTION_CHIPS = ['chip1', 'chip2', 'chip3'] as const;

function isSettingsSection(value: string | null): value is SettingsSection {
  return value !== null && (SECTIONS as readonly string[]).includes(value);
}

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

/** One setting: label + description on the left, control on the right. */
function SettingRow({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-base">{label}</Label>
        {description && (
          <p id={`${id}-description`} className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  contentClassName = 'space-y-6',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export default function Settings() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const {
    theme,
    toggleTheme,
    displayCurrency,
    setDisplayCurrency,
    menuCollectionStyle,
    setMenuCollectionStyle,
    compactMode,
    setCompactMode,
    notifications,
    setNotifications,
    wipeAllData,
  } = useCollectionStore();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isAdmin = user?.role === 'admin';

  const requestedSection = searchParams.get('section');
  const fallbackSection: SettingsSection = isAdmin ? 'admin' : 'appearance';
  const activeSection: SettingsSection = !isSettingsSection(requestedSection)
    ? fallbackSection
    : requestedSection === 'admin' && !isAdmin
      ? 'appearance'
      : requestedSection;
  const visibleSections = SECTIONS.filter((section) => section !== 'admin' || isAdmin);
  const activeSectionTitle = t(`settings.meta.${activeSection}.title`);

  const requestedDataTab = searchParams.get('dataTab');
  const dataTab: ImportExportTab = requestedDataTab === 'import' || requestedDataTab === 'local-sync'
    ? requestedDataTab
    : 'export';

  const updateSearchParams = (updates: Partial<{ section: SettingsSection; dataTab: ImportExportTab }>) => {
    const nextParams = new URLSearchParams(searchParams);
    if (updates.section) nextParams.set('section', updates.section);
    if (updates.dataTab) nextParams.set('dataTab', updates.dataTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      await wipeAllData();
      setResetDialogOpen(false);
      toast.success(t('settings.data.resetDone'));
    } catch {
      toast.error(t('settings.data.resetFailed'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-6xl space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('settings.title')}
          description={t('settings.description')}
          breadcrumbs={[{ label: t('settings.title') }]}
        />

        <Card className="overflow-hidden border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.9))] shadow-[0_18px_50px_rgb(15_23_42_/_0.06)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(15,23,42,0.9))] dark:shadow-[0_20px_60px_rgb(0_0_0_/_0.24)]">
          <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] lg:items-start">
            <div className="space-y-4">
              <Badge className="h-7 rounded-full border border-primary/15 bg-background/70 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm hover:bg-background/70">
                <Sparkles className="mr-1.5 size-3.5" aria-hidden="true" />
                {t('settings.hero.eyebrow')}
              </Badge>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {activeSectionTitle}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  {t(`settings.meta.${activeSection}.description`)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {SECTION_CHIPS.map((chip) => (
                  <Badge key={chip} variant="secondary" className="h-6 rounded-full px-2.5 text-[11px]">
                    {t(`settings.meta.${activeSection}.${chip}`)}
                  </Badge>
                ))}
                {isAdmin && (
                  <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[11px]">
                    <ShieldCheck className="mr-1 size-3.5 text-primary" aria-hidden="true" />
                    {t('settings.hero.adminAccess')}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <SettingsSummaryTile
                label={t('settings.summary.theme')}
                value={theme === 'dark' ? t('settings.summary.themeDark') : t('settings.summary.themeLight')}
                hint={t('settings.summary.themeHint')}
              />
              <SettingsSummaryTile
                label={t('settings.summary.currency')}
                value={`${currencyService.getCurrencySymbol(displayCurrency)} ${displayCurrency}`}
                hint={t('settings.summary.currencyHint')}
              />
              <SettingsSummaryTile
                label={t('settings.summary.sidebar')}
                value={menuCollectionStyle === 'style2' ? t('settings.appearance.menuStyleDrill') : t('settings.appearance.menuStyleTree')}
                hint={t('settings.summary.sidebarHint')}
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
                  <PanelLeft className="size-4 text-primary" aria-hidden="true" />
                  {t('settings.nav.sections')}
                </div>
                <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  {t('settings.nav.active')}
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                  <span className="font-medium text-foreground">{activeSectionTitle}</span>
                </div>
              </div>
              <TabsList
                aria-label={t('settings.sectionsLabel')}
                className="h-auto flex-wrap justify-start gap-2 rounded-2xl bg-muted/35 p-1.5"
              >
                {visibleSections.map((section) => {
                  const Icon = SECTION_ICONS[section];
                  return (
                    <TabsTrigger key={section} value={section} className="gap-2 rounded-xl">
                      <Icon className="size-4" aria-hidden="true" />
                      {t(`settings.section.${section}`)}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </CardContent>
          </Card>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminPanelSection />
            </TabsContent>
          )}

          <TabsContent value="appearance" className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <SettingsCard
              icon={Palette}
              title={t('settings.appearance.displayTitle')}
              description={t('settings.appearance.displayDescription')}
            >
              <SettingRow id="setting-dark-mode" label={t('settings.appearance.darkMode')} description={t('settings.appearance.darkModeDescription')}>
                <div className="flex items-center gap-3">
                  <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Switch
                    id="setting-dark-mode"
                    aria-describedby="setting-dark-mode-description"
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </SettingRow>

              <Separator />

              <SettingRow id="setting-language" label={t('common.language')} description={t('settings.appearance.languageDescription')}>
                <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                  <SelectTrigger id="setting-language" className="w-[180px]" aria-describedby="setting-language-description">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((option) => (
                      <SelectItem key={option.value} value={option.value} lang={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator />

              <SettingRow id="setting-currency" label={t('settings.appearance.currency')} description={t('settings.appearance.currencyDescription')}>
                <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                  <SelectTrigger id="setting-currency" className="w-[180px]" aria-describedby="setting-currency-description">
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
              </SettingRow>
            </SettingsCard>

            <SettingsCard
              icon={PanelLeft}
              title={t('settings.appearance.layoutTitle')}
              description={t('settings.appearance.layoutDescription')}
            >
              <SettingRow id="setting-compact" label={t('settings.appearance.compact')} description={t('settings.appearance.compactDescription')}>
                <Switch
                  id="setting-compact"
                  aria-describedby="setting-compact-description"
                  checked={compactMode}
                  onCheckedChange={setCompactMode}
                />
              </SettingRow>

              <Separator />

              <SettingRow id="setting-menu-style" label={t('settings.appearance.menuStyle')} description={t('settings.appearance.menuStyleDescription')}>
                <Select
                  value={menuCollectionStyle}
                  onValueChange={(value) => setMenuCollectionStyle(value as 'style1' | 'style2')}
                >
                  <SelectTrigger id="setting-menu-style" className="w-[180px]" aria-describedby="setting-menu-style-description">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="style1">{t('settings.appearance.menuStyleTree')}</SelectItem>
                    <SelectItem value="style2">{t('settings.appearance.menuStyleDrill')}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </SettingsCard>
          </TabsContent>

          <TabsContent value="notifications" className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
            <SettingsCard
              icon={Bell}
              title={t('settings.notifications.cardTitle')}
              description={t('settings.notifications.description')}
              contentClassName="space-y-4"
            >
              <SettingRow id="setting-value-alerts" label={t('settings.notifications.valueAlerts')} description={t('settings.notifications.valueAlertsDescription')}>
                <Switch
                  id="setting-value-alerts"
                  aria-describedby="setting-value-alerts-description"
                  checked={notifications.valueChangeAlerts}
                  onCheckedChange={(value) => setNotifications({ valueChangeAlerts: value })}
                />
              </SettingRow>
              <Separator />
              <SettingRow id="setting-reminders" label={t('settings.notifications.reminders')} description={t('settings.notifications.remindersDescription')}>
                <Switch
                  id="setting-reminders"
                  aria-describedby="setting-reminders-description"
                  checked={notifications.newItemReminders}
                  onCheckedChange={(value) => setNotifications({ newItemReminders: value })}
                />
              </SettingRow>
              <Separator />
              <SettingRow id="setting-milestones" label={t('settings.notifications.milestones')} description={t('settings.notifications.milestonesDescription')}>
                <Switch
                  id="setting-milestones"
                  aria-describedby="setting-milestones-description"
                  checked={notifications.collectionMilestones}
                  onCheckedChange={(value) => setNotifications({ collectionMilestones: value })}
                />
              </SettingRow>
            </SettingsCard>

            <SettingsCard
              icon={ShieldCheck}
              title={t('settings.notifications.notesTitle')}
              description={t('settings.notifications.notesDescription')}
              contentClassName="space-y-4 text-sm text-muted-foreground"
            >
              <p>{t('settings.notifications.note1')}</p>
              <p>{t('settings.notifications.note2')}</p>
              <p>{t('settings.notifications.note3')}</p>
            </SettingsCard>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <IntegrationsSection />
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <SettingsCard
              icon={Database}
              title={t('settings.data.cardTitle')}
              description={t('settings.data.description')}
              contentClassName="space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">{t('settings.data.chipExport')}</Badge>
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">{t('settings.data.chipImport')}</Badge>
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">{t('settings.data.chipBackup')}</Badge>
                <Badge variant="secondary" className="h-6 px-2.5 text-[11px]">{t('settings.data.chipLocalSync')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t('settings.data.intro')}</p>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="space-y-1">
                  <p className="text-base font-medium text-destructive">{t('settings.data.dangerTitle')}</p>
                  <p className="text-sm text-muted-foreground">
                    {isAdmin ? t('settings.data.resetDescription') : t('settings.data.resetAdminOnly')}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  disabled={!isAdmin}
                  onClick={() => setResetDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('settings.data.resetButton')}
                </Button>
              </div>
            </SettingsCard>

            <ImportExportPanel
              activeTab={dataTab}
              onTabChange={(nextTab) => updateSearchParams({ section: 'data', dataTab: nextTab })}
            />
          </TabsContent>
        </Tabs>
      </div>
      <ConfirmDialog
        open={resetDialogOpen}
        onClose={() => {
          if (!isResetting) setResetDialogOpen(false);
        }}
        onConfirm={() => void handleResetAllData()}
        title={t('settings.data.resetConfirmTitle')}
        description={t('settings.data.resetConfirmDescription')}
        confirmLabel={t('settings.data.resetConfirm')}
        destructive
      />
    </PageTransition>
  );
}
