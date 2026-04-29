import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Sparkles,
  BookOpen,
  Coins,
  Frame,
  Car,
  Watch,
  UserPlus,
  AlertCircle,
} from 'lucide-react';
import brandLogo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const floatingIcons = [
  { Icon: BookOpen, x: '12%', y: '18%', delay: '0s', size: 'size-5' },
  { Icon: Coins, x: '85%', y: '22%', delay: '1.5s', size: 'size-6' },
  { Icon: Frame, x: '8%', y: '72%', delay: '3s', size: 'size-4' },
  { Icon: Car, x: '78%', y: '78%', delay: '0.8s', size: 'size-5' },
  { Icon: Watch, x: '45%', y: '8%', delay: '2.2s', size: 'size-4' },
  { Icon: Layers, x: '92%', y: '50%', delay: '4s', size: 'size-5' },
];

const brandHighlights = [
  'Private Archive',
  'Curated Collections',
  'Cross-Device Sync',
];

const brandAssurances = [
  { value: 'Discreet', label: 'private and personal by design' },
  { value: 'Synced', label: 'available wherever you manage it' },
  { value: 'Exportable', label: 'ready for backup and archival records' },
];

export default function Login() {
  const navigate = useNavigate();
  const {
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
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsLoading(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, displayName || undefined);
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/collections');
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
      navigate('/collections');
    } catch {
      // error is set in the store
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineLogin = () => {
    loginOffline();
    navigate('/collections');
  };

  const handlePasswordReset = async () => {
    clearError();
    if (!email.trim()) {
      toast.error('Enter your email address first');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordReset(email.trim());
      toast.success('Password reset email sent');
    } catch {
      // error is set in the store
      return;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[linear-gradient(135deg,rgba(251,252,255,0.95)_0%,rgba(244,247,255,0.98)_50%,rgba(252,252,250,0.97)_100%)] text-foreground">
      <div className="relative hidden w-1/2 overflow-hidden border-r border-white/45 bg-[linear-gradient(160deg,rgba(233,240,255,0.92)_0%,rgba(244,247,255,0.84)_42%,rgba(247,248,252,0.80)_100%)] lg:flex lg:flex-col lg:items-center lg:justify-center">
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
            className="absolute animate-pulse text-primary/12"
            style={{ left: x, top: y, animationDelay: delay, animationDuration: '6s' }}
          >
            <Icon className={size} />
          </div>
        ))}

        <div className="relative z-10 max-w-xl space-y-10 px-14 text-center">
          <div className="space-y-8">
            <div className="mx-auto flex h-44 w-64 items-center justify-center">
              <img
                src={brandLogo}
                alt="Eyüp Sabri Çarmıklı logo"
                className="h-full w-full object-contain drop-shadow-[0_18px_38px_rgba(15,23,42,0.12)]"
              />
            </div>
          </div>

          <div className="space-y-6 pt-3">
            <p className="text-base font-medium uppercase tracking-[0.36em] text-primary/70 sm:text-[1.1rem]">
              Eyüp Sabri Çarmıklı
            </p>
            <h2
              className="mx-auto max-w-xl text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.035em] text-slate-900"
              style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif' }}
            >
              A refined home for your most valuable collections.
            </h2>
            <p className="mx-auto max-w-lg pt-1 text-lg leading-8 text-slate-600">
              Premium collection management for a private archive, with elegant organization,
              secure access, and export-ready records.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2.5 pt-4">
            {brandHighlights.map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-white/65 bg-white/45 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-md"
              >
                {feature}
              </span>
            ))}
          </div>

          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4 pt-4 text-left">
            {brandAssurances.map((item) => (
              <div
                key={item.value}
                className="rounded-3xl border border-white/55 bg-white/34 px-5 py-4 shadow-[0_18px_38px_rgba(15,23,42,0.05)] backdrop-blur-md"
              >
                <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">{item.value}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(187,209,255,0.24),transparent_58%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent)]" />

        <div className="relative w-full max-w-[480px] rounded-[2rem] border border-white/65 bg-white/72 px-6 py-8 shadow-[0_28px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:px-8 sm:py-10">
          <div className="space-y-3 text-center lg:hidden">
            <div className="mx-auto flex h-28 w-36 items-center justify-center">
              <img
                src={brandLogo}
                alt="Eyüp Sabri Çarmıklı logo"
                className="h-full w-full object-contain drop-shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
              />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/70">
              Private Collection Archive
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Eyüp Sabri Çarmıklı
            </h1>
          </div>

          <div className="space-y-3 text-center lg:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70">
              {mode === 'login' ? 'Private archive access' : 'Create your archive'}
            </p>
            <h2 className="text-[2.15rem] font-semibold tracking-[-0.05em] text-slate-950">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-[15px] leading-7 text-slate-600">
              {mode === 'login'
                ? 'Sign in to access your private collection space with secure, synced records.'
                : 'Register to organize, protect, and grow your collection with confidence.'}
            </p>
          </div>

          {error && (
            <div className="mt-8 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive shadow-[0_10px_25px_rgba(239,68,68,0.08)]">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="mt-8 space-y-6">
            {firebaseReady && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 w-full gap-3 rounded-[1.35rem] border border-slate-200/85 bg-white text-sm font-semibold text-slate-700 shadow-[0_16px_34px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:bg-white"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </Button>

                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-slate-200/85" />
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    or continue with email
                  </span>
                  <div className="h-px flex-1 bg-slate-200/85" />
                </div>
              </>
            )}

            <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_38px_rgba(15,23,42,0.05)] sm:p-6">
              <form
                onSubmit={firebaseReady ? handleEmailAuth : (e) => { e.preventDefault(); handleOfflineLogin(); }}
                className="space-y-5"
                autoComplete="off"
              >
                {mode === 'register' && (
                  <div className="space-y-2.5">
                    <Label htmlFor="name" className="text-sm font-medium text-slate-800">
                      Display name
                    </Label>
                    <div className="relative">
                      <UserPlus className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        className="h-14 rounded-[1.1rem] border border-slate-200/90 bg-white pl-11 shadow-[0_8px_18px_rgba(15,23,42,0.04)] placeholder:text-slate-400"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div className="flex min-h-6 items-center justify-between">
                    <Label htmlFor="email" className="text-sm font-medium leading-none text-slate-800">
                      Email address
                    </Label>
                    <span
                      aria-hidden="true"
                      className="text-xs font-semibold leading-none opacity-0 select-none"
                    >
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="h-14 rounded-[1.1rem] border border-slate-200/90 bg-white pl-11 shadow-[0_8px_18px_rgba(15,23,42,0.04)] placeholder:text-slate-400"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex min-h-6 items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium leading-none text-slate-800">
                      Password
                    </Label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        className="text-xs font-semibold leading-none text-primary/90 transition-colors hover:text-primary"
                        tabIndex={-1}
                        disabled={isLoading || !firebaseReady}
                        onClick={async () => {
                          await handlePasswordReset();
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                    {mode !== 'login' && (
                      <span
                        aria-hidden="true"
                        className="text-xs font-semibold leading-none opacity-0 select-none"
                      >
                        Forgot password?
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                      className="h-14 rounded-[1.1rem] border border-slate-200/90 bg-white pl-11 pr-12 shadow-[0_8px_18px_rgba(15,23,42,0.04)] placeholder:text-slate-400"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className={cn(
                    'relative h-14 w-full gap-2 rounded-[1.2rem] text-sm font-semibold tracking-[0.01em]',
                    'bg-[linear-gradient(135deg,oklch(0.52_0.20_265),oklch(0.58_0.16_252))] shadow-[0_18px_36px_rgba(79,70,229,0.28)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_44px_rgba(79,70,229,0.34)]',
                  )}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="size-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    <>
                      {mode === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            {!firebaseReady && mode === 'login' && (
              <div className="flex items-center gap-3 rounded-2xl border border-primary/12 bg-primary/[0.04] px-4 py-3.5 shadow-[0_12px_28px_rgba(79,70,229,0.05)]">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Offline Mode</p>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Firebase not configured. Your archive stays available locally on this device.
                  </p>
                </div>
              </div>
            )}

            <p className="text-center text-sm text-slate-500">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); clearError(); }}
                    className="font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); clearError(); }}
                    className="font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>

            <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Private, synced, and export-ready.
            </p>
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} ESC. All rights reserved.
        </p>
      </div>
    </div>
  );
}
