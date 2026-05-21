import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileCheck,
  LockKeyhole,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type NavigationState = {
  from?: string;
};

const platformHighlights = [
  { label: 'Dispatch and job management', icon: ClipboardList },
  { label: 'Technician coordination', icon: Users },
  { label: 'Invoices and reporting', icon: FileCheck },
];

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@nexusops.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as NavigationState | null)?.from;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email, password, 'admin', { remember: rememberSession });
      const destination = from && from.startsWith('/admin') ? from : '/admin';
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-[#05070b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(79,124,255,0.24),transparent_27%),radial-gradient(circle_at_82%_12%,rgba(34,211,238,0.16),transparent_25%),linear-gradient(180deg,#0b1220_0%,#05070b_55%,#020617_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:104px_104px]" />

      <section className="relative mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="mx-auto w-full max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
            <ShieldCheck className="h-4 w-4" />
            NexusOps Admin
          </div>

          <h1 className="mt-7 text-[clamp(2.45rem,5vw,4.35rem)] font-semibold leading-[0.95] tracking-[-0.055em]">
            Welcome to NexusOps
          </h1>

          <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">
            Sign in to manage jobs, technicians, invoices, and daily service operations from one workspace.
          </p>

          <div className="mt-8 grid max-w-lg gap-3">
            {platformHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-cyan-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold text-slate-100">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[520px]">
          <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(5,10,20,0.99))] p-5 shadow-2xl shadow-blue-950/40 backdrop-blur-xl sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#4f7cff] to-[#22d3ee] shadow-lg shadow-blue-500/20">
                  <ShieldCheck className="h-5 w-5 text-white" />
                </span>
                <span>
                  <span className="block text-lg font-bold tracking-[-0.03em]">NexusOps</span>
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">NexusOps Admin</span>
                </span>
              </Link>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 sm:inline-flex">
                Admin Access
              </span>
            </div>

            <div className="mt-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                <LockKeyhole className="h-3.5 w-3.5" />
                Secure workspace login
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-none tracking-[-0.045em]">
                Sign in
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Enter your admin credentials to continue to the NexusOps workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-sm font-semibold text-slate-100">
                  Work email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="admin@company.com"
                  className="h-14 rounded-2xl border-white/10 !bg-[#0a1220] px-4 text-[15px] !text-white placeholder:!text-slate-500 focus-visible:border-cyan-300/45 focus-visible:ring-cyan-300/15"
                  style={{ backgroundColor: '#0a1220', color: '#f8fafc', WebkitTextFillColor: '#f8fafc' }}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password" className="text-sm font-semibold text-slate-100">
                    Password
                  </Label>
                  <a href="mailto:support@nexusops.com?subject=Admin%20password%20support" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Enter password"
                    className="h-14 rounded-2xl border-white/10 !bg-[#0a1220] px-4 pr-12 text-[15px] !text-white placeholder:!text-slate-500 focus-visible:border-cyan-300/45 focus-visible:ring-cyan-300/15"
                    style={{ backgroundColor: '#0a1220', color: '#f8fafc', WebkitTextFillColor: '#f8fafc' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 bg-transparent text-[#4f7cff] focus:ring-[#67e8f9]/20"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-200">Remember this browser</span>
                </label>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  Secure admin access
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-base font-semibold text-white shadow-[0_18px_42px_rgba(79,124,255,0.28)] transition-all hover:-translate-y-0.5 hover:brightness-105"
                disabled={isSubmitting}
              >
                <span className="flex items-center justify-center">
                  {isSubmitting ? 'Signing in...' : 'Enter workspace'}
                  {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </span>
              </Button>
            </form>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                to="/admin/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/tech/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
              >
                Technician login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <p className="text-sm leading-6 text-slate-400">
                  Protected access for dispatch leaders, billing teams, and administrators managing daily service operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
