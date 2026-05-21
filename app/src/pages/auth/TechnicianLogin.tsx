import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  LockKeyhole,
  MessageSquare,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { requestTechnicianPasswordReset } from '@/lib/backend-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type NavigationState = {
  from?: string;
};

const technicianHighlights = [
  { label: 'Assigned jobs and route updates', icon: ClipboardList },
  { label: 'Technician schedule coordination', icon: Route },
  { label: 'Dispatch chat and field notes', icon: MessageSquare },
];

export default function TechnicianLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);

  const from = (location.state as NavigationState | null)?.from;

  const resetForgotPasswordState = (nextEmail?: string) => {
    setForgotEmail((nextEmail ?? email).trim());
    setForgotMessage(null);
    setForgotError(null);
    setIsForgotSubmitting(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email, password, 'technician', { remember: rememberSession });
      const destination = from && from.startsWith('/tech') ? from : '/tech/jobs';
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordRequest = async () => {
    setForgotError(null);
    setForgotMessage(null);

    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setForgotError('Enter your technician email address.');
      return;
    }

    setIsForgotSubmitting(true);
    try {
      const response = await requestTechnicianPasswordReset({ email: normalizedEmail });
      setForgotEmail(normalizedEmail);
      setForgotMessage(response.message);
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : 'Unable to send password reset request.');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const fieldInputClass = 'h-14 rounded-2xl border-white/10 !bg-[#0a1220] px-4 text-[15px] !text-white placeholder:!text-slate-500 focus-visible:border-cyan-300/45 focus-visible:ring-cyan-300/15';
  const fieldInputStyle = { backgroundColor: '#0a1220', color: '#f8fafc', WebkitTextFillColor: '#f8fafc' } as const;

  return (
    <main className="auth-shell relative min-h-[100svh] overflow-hidden bg-[#05070b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(79,124,255,0.2),transparent_27%),radial-gradient(circle_at_82%_12%,rgba(34,211,238,0.14),transparent_25%),linear-gradient(180deg,#0b1220_0%,#05070b_55%,#020617_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:104px_104px]" />

      <section className="relative mx-auto grid min-h-[100svh] w-full max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="mx-auto w-full max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
            <ShieldCheck className="h-4 w-4" />
            NexusOps Technician
          </div>

          <h1 className="mt-7 text-[clamp(2.45rem,5vw,4.35rem)] font-semibold leading-[0.95] tracking-[-0.055em]">
            Welcome to NexusOps
          </h1>

          <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">
            Sign in to view assigned jobs, coordinate with dispatch, and update field work from one secure workspace.
          </p>

          <div className="mt-8 grid max-w-lg gap-3">
            {technicianHighlights.map((item) => {
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
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Technician Portal</span>
                </span>
              </Link>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 sm:inline-flex">
                Field Access
              </span>
            </div>

            <div className="mt-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                <LockKeyhole className="h-3.5 w-3.5" />
                Secure technician login
              </div>
              <h2 className="mt-5 text-3xl font-semibold leading-none tracking-[-0.045em]">
                Sign in
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                Enter your technician credentials to continue to your field workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="tech-email" className="text-sm font-semibold text-slate-100">
                  Work email
                </Label>
                <Input
                  id="tech-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="tech@company.com"
                  className={fieldInputClass}
                  style={fieldInputStyle}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="tech-password" className="text-sm font-semibold text-slate-100">
                    Password
                  </Label>
                  <Dialog
                    open={isForgotPasswordOpen}
                    onOpenChange={(open) => {
                      setIsForgotPasswordOpen(open);
                      if (open) {
                        resetForgotPasswordState();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <button type="button" className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Forgot password?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:max-w-[520px]">
                      <div className="p-6 sm:p-7">
                        <DialogHeader>
                          <DialogTitle className="text-[1.7rem] font-semibold tracking-[-0.04em] text-white">
                            Need password help?
                          </DialogTitle>
                          <DialogDescription className="text-sm leading-6 text-white/78">
                            Send a reset request to the admin workspace connected to your technician account.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-tech-email" className="text-sm font-semibold text-slate-100">
                              Technician email
                            </Label>
                            <Input
                              id="forgot-tech-email"
                              type="email"
                              value={forgotEmail}
                              onChange={(event) => setForgotEmail(event.target.value)}
                              autoComplete="email"
                              placeholder="tech@company.com"
                              className={fieldInputClass}
                              style={fieldInputStyle}
                            />
                          </div>
                          <p className="mt-3 text-sm leading-6 text-white/70">
                            If the account exists, the admin team will see the request in their dashboard.
                          </p>
                        </div>

                        {forgotMessage ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/84">
                            {forgotMessage}
                          </div>
                        ) : null}
                        {forgotError ? (
                          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {forgotError}
                          </div>
                        ) : null}

                        <DialogFooter className="mt-6 gap-3 sm:justify-between">
                          <Button type="button" variant="outline" asChild className="rounded-2xl border-white/10 bg-white/[0.035] text-[#eaf1ff] hover:bg-white/[0.07]">
                            <Link to="/tech/signup">Invite help</Link>
                          </Button>
                          <Button
                            type="button"
                            onClick={handleForgotPasswordRequest}
                            disabled={isForgotSubmitting}
                            className="rounded-2xl bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-white hover:brightness-105"
                          >
                            {isForgotSubmitting ? 'Sending...' : 'Notify admin'}
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="relative">
                  <Input
                    id="tech-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Enter password"
                    className={`${fieldInputClass} pr-12`}
                    style={fieldInputStyle}
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
                    id="remember-tech-session"
                    name="remember-tech-session"
                    type="checkbox"
                    checked={rememberSession}
                    onChange={(event) => setRememberSession(event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 bg-transparent text-[#4f7cff] focus:ring-[#67e8f9]/20"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-200">Remember this browser</span>
                </label>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  Secure field access
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
                to="/tech/signup"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
              >
                Invite help
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/admin/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.07]"
              >
                Admin login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                <p className="text-sm leading-6 text-slate-400">
                  Protected access for technicians managing assigned work, status updates, attendance, and dispatch communication.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
