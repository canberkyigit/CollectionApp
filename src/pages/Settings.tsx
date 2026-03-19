import { useCollectionStore } from '@/store/useCollectionStore';
import { PageHeader } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Sun, Moon, Database, Bell, Palette, Download, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { theme, toggleTheme, menuCollectionStyle, setMenuCollectionStyle, notifications, setNotifications } = useCollectionStore();

  return (
    <PageTransition>
      <div className="space-y-4 sm:space-y-6 md:space-y-8 max-w-4xl">
      <PageHeader
        title="Settings"
        description="Manage your application preferences"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Notifications
          </CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Management
          </CardTitle>
          <CardDescription>Import, export, and manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.info('Export feature coming soon')}>
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
            <Button variant="outline" onClick={() => toast.info('Import feature coming soon')}>
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-base text-destructive">Danger Zone</Label>
              <p className="text-sm text-muted-foreground">
                Permanently delete all data. This action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => toast.error('This action is disabled in demo mode')}>
              <Trash2 className="h-4 w-4 mr-2" />
              Reset All Data
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
    </PageTransition>
  );
}
