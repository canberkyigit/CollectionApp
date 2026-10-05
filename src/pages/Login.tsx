import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Car,
  Coins,
  Eye,
  EyeOff,
  Frame,
  Layers,
  Lock,
  Mail,
  Sparkles,
  UserPlus,
  Watch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandMark } from '@/components/shared/BrandMark';
import { LANGUAGES, useLanguageStore, useT } from '@/i18n';
import { BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

type Mode = 'login' | 'register';

const floatingIcons = [
  { Icon: BookOpen, x: '12%', y: '18%', delay: '0s', size: 'size-5' },
  { Icon: Coins, x: '85%', y: '22%', delay: '1.5s', size: 'size-6' },
  { Icon: Frame, x: '8%', y: '72%', delay: '3s', size: 'size-4' },
  { Icon: Car, x: '78%', y: '78%', delay: '0.8s', size: 'size-5' },
  { Icon: Watch, x: '45%', y: '8%', delay: '2.2s', size: 'size-4' },
  { Icon: Layers, x: '92%', y: '50%', delay: '4s', size: 'size-5' },
];

const brandHighlightKeys = [
  'auth.hero.highlight.private',
  'auth.hero.highlight.curated',
  'auth.hero.highlight.sync',
];

const brandAssurances = [
  { value: 'auth.hero.assurance.discreet', label: 'auth.hero.assurance.discreetLabel' },
  { value: 'auth.hero.assurance.synced', label: 'auth.hero.assurance.syncedLabel' },
  { value: 'auth.hero.assurance.exportable', label: 'auth.hero.assurance.exportableLabel' },
];

const fieldClassName =
  'h-14 rounded-[1.1rem] border border-slate-200/90 bg-white pl-11 shadow-[0_8px_18px_rgba(15,23,42,0.04)] placeholder:text-slate-400';

const primaryButtonClassName = cn(
  'relative h-14 w-full gap-2 rounded-[1.2rem] text-sm font-semibold tracking-[0.01em]',
  'bg-[linear-gradient(135deg,oklch(0.52_0.20_265),oklch(0.58_0.16_252))] shadow-[0_18px_36px_rgba(79,70,229,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_44px_rgba(79,70,229,0.34)]',
);

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function LanguageSwitch({ className }: { className?: string }) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cn(
        'flex items-center gap-0.5 rounded-full border border-white/65 bg-white/55 p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md',
        className,
      )}
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          aria-label={option.label}
          aria-pressed={language === option.value}
          onClick={() => setLanguage(option.value)}
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            language === option.value
              ? 'bg-white text-primary shadow-[0_4px_12px_rgba(79,70,229,0.14)]'
              : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {option.value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function Login() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    loginOffline,
    sendPasswordReset,
    firebaseReady,
    error,
    clearError,
  } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const destination = from && from !== '/login' ? from : '/collections';
  const desktopVersion = typeof window !== 'undefined' ? window.collectVaultDesktop?.version : undefined;
  const year = new Date().getFullYear();

  if (user) {
    return <Navigate to={destination} replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    clearError();
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, displayName || undefined);
      } else {
        await loginWithEmail(email, password);
      }
      navigate(destination, { replace: true });
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    setIsLoading(true);
    try {
      await loginWithGoogle();
      navigate(destination, { replace: true });
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineLogin = () => {
    loginOffline();
    navigate(destination, { replace: true });
  };

  const handlePasswordReset = async () => {
    clearError();
    if (!email.trim()) {
      toast.error(t('auth.reset.enterEmail'));
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(email.trim());
      toast.success(t('auth.reset.sent'), { description: t('auth.reset.sentDescription') });
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const isRegister = firebaseReady && mode === 'register';
  const eyebrow = isRegister ? t('auth.form.eyebrowRegister') : t('auth.form.eyebrowLogin');
  const title = isRegister ? t('auth.form.titleRegister') : t('auth.form.titleLogin');
  const description = !firebaseReady
    ? t('auth.form.descriptionOffline')
    : isRegister ? t('auth.form.descriptionRegister') : t('auth.form.descriptionLogin');

  const spinner = (
    <div
      className="size-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
      aria-hidden="true"
    />
  );

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[linear-gradient(135deg,rgba(251,252,255,0.95)_0%,rgba(244,247,255,0.98)_50%,rgba(252,252,250,0.97)_100%)] text-foreground">
      <aside className="relative hidden w-1/2 overflow-hidden border-r border-white/45 bg-[linear-gradient(160deg,rgba(233,240,255,0.92)_0%,rgba(244,247,255,0.84)_42%,rgba(247,248,252,0.80)_100%)] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/15 to-transparent" />
        <div className="absolute -left-24 -top-20 size-[28rem] rounded-full bg-primary/16 blur-[130px]" />
        <div className="absolute -bottom-36 left-16 size-[22rem] rounded-full bg-white/70 blur-[90px]" />
        <div className="absolute right-0 top-16 size-[26rem] rounded-full bg-sky-100/50 blur-[120px]" />
        <div className="absolute bottom-0 right-8 size-[20rem] rounded-full bg-primary/8 blur-[110px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />

        {floatingIcons.map(({ Icon, x, y, delay, size }, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute animate-pulse text-primary/12 motion-reduce:animate-none"
            style={{ left: x, top: y, animationDelay: delay, animationDuration: '6s' }}
          >
            <Icon className={size} />
          </div>
        ))}

        <div className="relative z-10 max-w-xl space-y-10 px-14 text-center">
          <div className="flex justify-center">
            <BrandMark className="size-24 rounded-[1.4rem] shadow-[0_24px_60px_rgba(79,70,229,0.32)]" />
          </div>

          <div className="space-y-6 pt-3">
            <p lang="en" className="text-base font-medium uppercase tracking-[0.36em] text-primary/70 sm:text-[1.1rem]">
              {BRAND_NAME}
            </p>
            <h2
              className="mx-auto max-w-xl text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-900"
              style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif' }}
            >
              {t('auth.hero.headline')}
            </h2>
            <p className="mx-auto max-w-lg pt-1 text-lg leading-8 text-slate-600">
              {t('auth.hero.description')}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 pt-4">
            {brandHighlightKeys.map((key) => (
              <span
                key={key}
                className="rounded-full border border-white/65 bg-white/45 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-md"
              >
                {t(key)}
              </span>
            ))}
          </div>

          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4 pt-4 text-left">
            {brandAssurances.map((item) => (
              <div
                key={item.value}
                className="rounded-3xl border border-white/55 bg-white/34 px-5 py-4 shadow-[0_18px_38px_rgba(15,23,42,0.05)] backdrop-blur-md"
              >
                <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">{t(item.value)}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{t(item.label)}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(187,209,255,0.24),transparent_58%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent)]" />

        <LanguageSwitch className="absolute right-5 top-5 z-10" />

        <div className="relative w-full max-w-[480px] rounded-[2rem] border border-white/65 bg-white/72 px-6 py-8 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:px-8 sm:py-10">
          <div className="mb-8 space-y-3 text-center lg:hidden">
            <div className="flex justify-center">
              <BrandMark className="size-16 rounded-[0.94rem] shadow-[0_18px_40px_rgba(79,70,229,0.28)]" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/70">
              {t('auth.hero.eyebrowMobile')}
            </p>
            <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{BRAND_NAME}</p>
          </div>

          <div className="space-y-3 text-center lg:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">{eyebrow}</p>
            <h1 className="text-[2.15rem] font-semibold tracking-[-0.05em] text-slate-950">{title}</h1>
            <p className="text-[15px] leading-7 text-slate-600">{description}</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-8 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive shadow-[0_10px_25px_rgba(239,68,68,0.08)]"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-8 space-y-6">
            {firebaseReady ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-14 w-full gap-3 rounded-[1.35rem] border border-slate-200/85 bg-white text-sm font-semibold text-slate-700 shadow-[0_16px_34px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:bg-white"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <GoogleIcon />
                  {t('auth.google')}
                </Button>

                <div className="flex items-center gap-4" role="separator" aria-orientation="horizontal">
                  <div className="h-px flex-1 bg-slate-200/85" />
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t('auth.orEmail')}
                  </span>
                  <div className="h-px flex-1 bg-slate-200/85" />
                </div>

                <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.05)] sm:p-6">
                  <form onSubmit={handleEmailAuth} className="space-y-5">
                    {mode === 'register' && (
                      <div className="space-y-2.5">
                        <Label htmlFor="name" className="text-sm font-medium text-slate-800">
                          {t('auth.displayName')}
                        </Label>
                        <div className="relative">
                          <UserPlus className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                          <Input
                            id="name"
                            name="name"
                            type="text"
                            autoComplete="name"
                            placeholder={t('auth.displayNamePlaceholder')}
                            className={fieldClassName}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      <Label htmlFor="email" className="text-sm font-medium leading-none text-slate-800">
                        {t('auth.email')}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          required
                          placeholder={t('auth.emailPlaceholder')}
                          className={fieldClassName}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex min-h-6 items-center justify-between gap-2">
                        <Label htmlFor="password" className="text-sm font-medium leading-none text-slate-800">
                          {t('auth.password')}
                        </Label>
                        {mode === 'login' && (
                          <button
                            type="button"
                            className="rounded-sm text-xs font-semibold leading-none text-primary/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
                            disabled={isLoading}
                            onClick={() => void handlePasswordReset()}
                          >
                            {t('auth.forgotPassword')}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                          required
                          minLength={mode === 'register' ? 6 : undefined}
                          placeholder={mode === 'register' ? t('auth.passwordPlaceholderNew') : t('auth.passwordPlaceholder')}
                          className={cn(fieldClassName, 'pr-12')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                          aria-controls="password"
                          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[1.1rem] text-slate-400 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {showPassword
                            ? <EyeOff className="size-4" aria-hidden="true" />
                            : <Eye className="size-4" aria-hidden="true" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" size="lg" className={primaryButtonClassName} disabled={isLoading}>
                      {isLoading ? spinner : (
                        <>
                          {mode === 'login' ? t('auth.submit.signIn') : t('auth.submit.register')}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </form>
                </div>

                <p className="text-center text-sm text-slate-500">
                  {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                    className="rounded-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {mode === 'login' ? t('auth.createOne') : t('auth.signInLink')}
                  </button>
                </p>
              </>
            ) : (
              <div className="space-y-5 rounded-[1.6rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.05)] sm:p-6">
                <div className="flex items-center gap-3 rounded-2xl border border-primary/12 bg-primary/[0.04] px-4 py-3.5 shadow-[0_12px_28px_rgba(79,70,229,0.05)]">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Sparkles className="size-4 text-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                      {t('auth.offline.eyebrow')}
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-500">{t('auth.offline.description')}</p>
                  </div>
                </div>
                <Button type="button" size="lg" className={primaryButtonClassName} onClick={handleOfflineLogin}>
                  {t('auth.offline.continue')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}

            <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              {t('auth.tagline')}
            </p>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-muted-foreground/50">
          {t('auth.footer', { year, brand: BRAND_NAME })}
          {desktopVersion && <span className="tabular-nums"> · v{desktopVersion}</span>}
        </p>
      </main>
    </div>
  );
}
