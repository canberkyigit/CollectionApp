import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

export default function Login() {
  const navigate = useNavigate();
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loginOffline, firebaseReady, error, clearError } = useAuthStore();
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

  return (
    <div className="relative flex min-h-screen">
      {/* Left Panel -- Branding */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-background lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute -bottom-48 -right-24 size-80 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 size-64 -translate-x-1/2 rounded-full bg-primary/8 blur-[80px]" />

        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {floatingIcons.map(({ Icon, x, y, delay, size }, i) => (
          <div
            key={i}
            className="absolute animate-pulse text-primary/15"
            style={{ left: x, top: y, animationDelay: delay, animationDuration: '4s' }}
          >
            <Icon className={size} />
          </div>
        ))}

        <div className="relative z-10 max-w-md space-y-8 px-12 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-xl shadow-primary/5 backdrop-blur-sm">
            <Layers className="size-10 text-primary" />
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">CollectVault</h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Your premium collection management platform. Catalog, track, and grow your valuable collections.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {['Smart Analytics', 'Multi-Currency', 'Value Tracking', 'Export Ready'].map((f) => (
              <span
                key={f}
                className="rounded-full border border-primary/15 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary backdrop-blur-sm"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-center gap-8 pt-4">
            {[
              { value: '10K+', label: 'Collectors' },
              { value: '1M+', label: 'Items Tracked' },
              { value: '50+', label: 'Categories' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel -- Login Form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.25_0.06_265),transparent_60%)] lg:bg-none" />

        <div className="relative w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="space-y-2 text-center lg:hidden">
            <div className="mx-auto flex size-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Layers className="size-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">CollectVault</h1>
          </div>

          {/* Header */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-muted-foreground">
              {mode === 'login'
                ? 'Sign in to your account to continue'
                : 'Register to start managing your collections'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Google button */}
          {firebaseReady && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="h-12 w-full gap-2.5 text-sm"
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

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs font-medium text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={firebaseReady ? handleEmailAuth : (e) => { e.preventDefault(); handleOfflineLogin(); }} className="space-y-5" autoComplete="off">
            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Display name
                </Label>
                <div className="relative">
                  <UserPlus className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    className="h-12 pl-10"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="h-12 pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                  className="h-12 pl-10 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className={cn(
                'relative h-12 w-full gap-2 text-sm font-semibold',
                'bg-primary shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30',
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

          {/* Demo/offline banner */}
          {!firebaseReady && mode === 'login' && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">Offline Mode</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Firebase not configured. Data is stored locally.
                </p>
              </div>
            </div>
          )}

          {/* Toggle login / register */}
          <p className="text-center text-sm text-muted-foreground">
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
        </div>

        <p className="absolute bottom-6 text-xs text-muted-foreground/50">
          &copy; {new Date().getFullYear()} CollectVault. All rights reserved.
        </p>
      </div>
    </div>
  );
}
