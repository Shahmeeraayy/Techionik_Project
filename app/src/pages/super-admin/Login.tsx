import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Fingerprint, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { authInputClass, authInputStyle, authLabelClass } from '@/pages/auth/AuthSplitShell';

type NavigationState = {
  from?: string;
};

const platformSignals = [
  'Platform-wide organization visibility',
  'Subscription and feature controls',
  'Break-glass access and audit trails',
];

export default function SuperAdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('root@nexusops.com');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as NavigationState | null)?.from;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email, password, 'super_admin', { remember: rememberSession });
      const destination = from && from.startsWith('/super-admin') ? from : '/super-admin';
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#f4efe6] text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_16%,rgba(15,23,42,0.11),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(8,145,178,0.12),transparent_24%),linear-gradient(180deg,#f7f3eb_0%,#f0e7da_48%,#ecdfce_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:88px_88px]" />
      <div className="pointer-events-none absolute -left-16 top-16 h-64 w-64 rounded-full bg-slate-900/8 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <section className="relative mx-auto grid min-h-[100svh] w-full max-w-7xl items-center gap-12 px-5 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-slate-700 shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
            <Sparkles className="h-4 w-4 text-cyan-700" />
            NexusOps Platform Control
          </div>

          <h1 className="mt-8 text-[clamp(2.7rem,5vw,5rem)] font-semibold leading-[0.92] tracking-[-0.06em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
            Super Admin
            <br />
            command center
          </h1>

          <p className="mt-5 max-w-xl text-base leading-8 text-slate-700">
            Platform-wide visibility for organizations, access controls, subscriptions, and security posture across NexusOps.
          </p>

          <div className="mt-8 grid gap-3">
            {platformSignals.map((signal) => (
              <div key={signal} className="flex items-center gap-3 rounded-[22px] border border-slate-900/10 bg-white/75 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.07)] backdrop-blur-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-slate-900">{signal}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          <div className="rounded-[2.2rem] border border-slate-900/10 bg-white/88 p-5 shadow-[0_28px_120px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-lg font-bold tracking-[-0.03em] text-slate-950">NexusOps</span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Super Admin</span>
                </span>
              </Link>
              <span className="hidden rounded-full border border-slate-900/10 bg-slate-900/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-600 sm:inline-flex">
                Platform Access
              </span>
            </div>

            <div className="mt-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/10 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-900">
                <Fingerprint className="h-3.5 w-3.5" />
                Controlled entry
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-none tracking-[-0.045em] text-slate-950">
                Sign in
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Use your platform credentials to access organization controls and audit trails.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="super-admin-email" className={cn(authLabelClass, 'text-slate-700')}>
                  Platform email
                </Label>
                <Input
                  id="super-admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="root@nexusops.com"
                  className={cn(authInputClass, 'h-14 border-slate-300/80 bg-white/90 text-slate-950 placeholder:text-slate-500')}
                  style={authInputStyle}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="super-admin-password" className={cn(authLabelClass, 'text-slate-700')}>
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="super-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Enter password"
                    className={cn(authInputClass, 'h-14 border-slate-300/80 bg-white/90 pr-12 text-slate-950 placeholder:text-slate-500')}
                    style={authInputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[22px] border border-slate-900/10 bg-[#f8f4ec] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center">
                  <input
                    id="remember-platform-session"
                    name="remember-platform-session"
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-400 bg-transparent text-cyan-700 focus:ring-cyan-200"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-700">Remember this browser</span>
                </label>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-cyan-800" />
                  Audited platform access
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-[22px] border border-red-500/20 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-14 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#0f172a,#155e75)] text-base font-semibold text-white shadow-[0_18px_44px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:brightness-105"
                disabled={isSubmitting}
              >
                <span className="flex items-center justify-center">
                  {isSubmitting ? 'Signing in...' : 'Open command center'}
                  {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </span>
              </Button>
            </form>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                to="/admin/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.15rem] border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Organization admin login
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/tech/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[1.15rem] border border-slate-900/10 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Technician login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
