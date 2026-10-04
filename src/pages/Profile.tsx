import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Camera, Eye, EyeOff, Lock, Mail, Save, Shield, User } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useT } from '@/i18n';
import { isOfflineUser, useAuthStore } from '@/store/useAuthStore';
import { storageService } from '@/services/storageService';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function isRecentLoginError(error: unknown) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'auth/requires-recent-login';
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-controls={id}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const t = useT();
  const { user, firebaseReady, updateUserProfile, changePassword } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [nameLoading, setNameLoading] = useState(false);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const initials = (user?.displayName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase();

  const isOffline = !firebaseReady || isOfflineUser(user);

  const handleNameSave = async () => {
    if (!displayName.trim()) {
      toast.error(t('profile.toast.nameEmpty'));
      return;
    }
    setNameLoading(true);
    try {
      await updateUserProfile(displayName.trim());
      toast.success(t('profile.toast.nameUpdated'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('profile.toast.nameFailed')));
    } finally {
      setNameLoading(false);
    }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.toast.notImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.toast.imageTooLarge'));
      return;
    }

    setAvatarLoading(true);
    try {
      const url = await storageService.uploadImage(user.uid, file, 'avatars');
      await updateUserProfile(undefined, url);
      toast.success(t('profile.toast.avatarUpdated'));
    } catch (error) {
      toast.error(getErrorMessage(error, t('profile.toast.avatarFailed')));
    } finally {
      setAvatarLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error(t('auth.error.weakPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.toast.passwordMismatch'));
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(newPassword);
      toast.success(t('profile.toast.passwordChanged'));
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const msg = isRecentLoginError(error)
        ? t('profile.toast.recentLogin')
        : getErrorMessage(error, t('profile.toast.passwordFailed'));
      toast.error(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const uidLabel = isOfflineUser(user)
    ? t('profile.uidOffline')
    : user?.uid
      ? `${user.uid.slice(0, 12)}…`
      : '';

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader title={t('profile.title')} description={t('profile.description')} />

        {isOffline && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{t('profile.offlineNotice')}</span>
          </div>
        )}

        {/* Avatar & Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="size-5" aria-hidden="true" />
              {t('profile.info.title')}
            </CardTitle>
            <CardDescription>{t('profile.info.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="size-20 border-2 border-border">
                  <AvatarImage src={user?.photoURL ?? ''} alt={user?.displayName ?? ''} />
                  <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  disabled={isOffline || avatarLoading}
                  onClick={() => fileRef.current?.click()}
                  aria-label={t('profile.changePhoto')}
                  className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                >
                  {avatarLoading ? (
                    <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" aria-hidden="true" />
                  ) : (
                    <Camera className="size-3.5" aria-hidden="true" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  aria-label={t('profile.changePhoto')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{user?.displayName || t('profile.noName')}</p>
                <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{user?.email || t('profile.noEmail')}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="size-3 shrink-0" aria-hidden="true" />
                  <span>{t('profile.uid')}: <span className="font-mono">{uidLabel}</span></span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Display Name */}
            <div className="space-y-3">
              <Label htmlFor="displayName" className="text-sm font-medium">
                {t('profile.displayName')}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="displayName"
                  name="displayName"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('profile.displayNamePlaceholder')}
                  disabled={isOffline || nameLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleNameSave}
                  disabled={isOffline || nameLoading || displayName.trim() === (user?.displayName ?? '')}
                  size="sm"
                  className="gap-1.5"
                >
                  {nameLoading ? (
                    <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" aria-hidden="true" />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="size-5" aria-hidden="true" />
              {t('profile.password.title')}
            </CardTitle>
            <CardDescription>{t('profile.password.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <PasswordField
                id="newPassword"
                label={t('profile.password.new')}
                value={newPassword}
                onChange={setNewPassword}
                placeholder={t('auth.passwordPlaceholderNew')}
                disabled={isOffline || pwLoading}
              />
              <PasswordField
                id="confirmPassword"
                label={t('profile.password.confirm')}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder={t('profile.password.confirmPlaceholder')}
                disabled={isOffline || pwLoading}
              />
              <Button
                type="submit"
                disabled={isOffline || pwLoading || !newPassword || !confirmPassword}
                className="gap-1.5"
              >
                {pwLoading ? (
                  <div className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" aria-hidden="true" />
                ) : (
                  <Lock className="size-3.5" aria-hidden="true" />
                )}
                {t('profile.password.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
