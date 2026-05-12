import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Wrench } from 'lucide-react';
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
import {
  technicianBodyFontStyle,
  technicianDisplayFontStyle,
  technicianGridOverlayStyle,
  technicianOrbitalGlowStyle,
  technicianPageBackgroundStyle,
} from './technicianAuthTheme';

type NavigationState = {
  from?: string;
};

const accessTags = ['Jobs', 'Assignments', 'Profile'] as const;

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

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden bg-[#04131f] text-white antialiased"
      style={technicianPageBackgroundStyle}
    >
      <div
        className="admin-login-grid pointer-events-none absolute inset-0 opacity-35"
        style={technicianGridOverlayStyle}
      />
      <div className="pointer-events-none absolute left-[-6rem] top-[-7rem] h-72 w-72 rounded-full bg-emerald-400/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-teal-300/14 blur-3xl" />

      <main className="relative flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="admin-login-card relative w-full max-w-[560px]" style={technicianBodyFontStyle}>
          <div className="pointer-events-none absolute inset-x-5 top-4 h-full rounded-[40px] border border-white/8 bg-white/[0.03] blur-sm" />
          <div
            className="admin-login-halo pointer-events-none absolute -left-3 -right-3 -top-3 h-40 rounded-[38px] opacity-80 blur-2xl"
            style={technicianOrbitalGlowStyle}
          />

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,31,48,0.96),rgba(6,23,38,0.96))] p-6 shadow-[0_34px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0)_52%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
            <div className="pointer-events-none absolute left-8 top-[7.1rem] h-px w-28 bg-gradient-to-r from-transparent via-emerald-200/80 to-transparent admin-login-scan" />

            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    style={technicianDisplayFontStyle}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    SM2 Electronics
                  </div>

                  <h1
                    className="mt-5 text-[clamp(2.2rem,4vw,3.85rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white"
                    style={technicianDisplayFontStyle}
                  >
                    Technician
                    <span className="block bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
                      portal
                    </span>
                  </h1>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-[15px]">
                    Sign in to access assigned jobs, active dispatch updates, and your field profile from one
                    cleaner technician workspace.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Field access
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {accessTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,27,43,0.92),rgba(7,23,37,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_rgba(3,12,24,0.34)] sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="tech-email" className="block text-sm font-semibold text-slate-200">
                      Email Address
                    </Label>
                    <Input
                      id="tech-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                      placeholder="tech@sm2dispatch.com"
                      className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <Label htmlFor="tech-password" className="block text-sm font-semibold text-slate-200">
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
                          <button
                            type="button"
                            className="text-sm font-semibold text-emerald-200 transition-colors hover:text-white"
                          >
                            Forgot password?
                          </button>
                        </DialogTrigger>
                        <DialogContent className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,31,48,0.98),rgba(6,23,38,0.98))] p-0 text-white shadow-[0_34px_120px_rgba(0,0,0,0.55)] sm:max-w-[540px]">
                          <div className="relative">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0)_54%)]" />
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />
                            <div className="p-6 sm:p-7">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <div
                                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100"
                                    style={technicianDisplayFontStyle}
                                  >
                                    Technician recovery
                                  </div>
                                  <DialogTitle
                                    className="mt-4 text-[1.7rem] font-semibold tracking-[-0.05em] text-white"
                                    style={technicianDisplayFontStyle}
                                  >
                                    Need password help?
                                  </DialogTitle>
                                  <DialogDescription className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                                    Send a password reset request to the admin portal. If your technician account
                                    exists, the admin team will see it immediately.
                                  </DialogDescription>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100">
                                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                  Admin queue
                                </div>
                              </div>

                              <div className="mt-6 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,27,43,0.92),rgba(7,23,37,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                                <div className="space-y-2">
                                  <Label htmlFor="forgot-tech-email" className="text-slate-200">
                                    Technician Email
                                  </Label>
                                  <Input
                                    id="forgot-tech-email"
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(event) => setForgotEmail(event.target.value)}
                                    autoComplete="email"
                                    placeholder="tech@sm2dispatch.com"
                                    className="h-[52px] rounded-2xl border-white/14 bg-white/[0.04] text-white placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                                  />
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-400">
                                  Use the email tied to your technician account. The request will appear in the admin
                                  technician account portal.
                                </p>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/60">
                                    Verified Flow
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-300">
                                    Requests stay tied to the technician email already registered in the system.
                                  </p>
                                </div>
                                <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/60">
                                    Admin Review
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-slate-300">
                                    The admin team sees the request in the technician account portal and can reset it.
                                  </p>
                                </div>
                              </div>

                              {forgotMessage && (
                                <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                                  {forgotMessage}
                                </div>
                              )}
                              {forgotError && (
                                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                                  {forgotError}
                                </div>
                              )}

                              <DialogFooter className="mt-6 gap-3 sm:justify-between">
                                <Button
                                  type="button"
                                  variant="outline"
                                  asChild
                                  className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] hover:text-white"
                                >
                                  <Link to="/tech/signup">Create account</Link>
                                </Button>
                                <Button
                                  type="button"
                                  onClick={handleForgotPasswordRequest}
                                  disabled={isForgotSubmitting}
                                  className="bg-gradient-to-r from-[#139c69] to-[#1bb2a5] text-white hover:from-[#18ab74] hover:to-[#20c2b5]"
                                >
                                  {isForgotSubmitting ? 'Sending...' : 'Notify admin'}
                                </Button>
                              </DialogFooter>
                            </div>
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
                        placeholder="********"
                        className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 pr-12 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
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

                  <div className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center">
                      <input
                        id="remember-tech-session"
                        name="remember-tech-session"
                        type="checkbox"
                        checked={rememberSession}
                        onChange={(event) => setRememberSession(event.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-500 bg-transparent text-[#18b77f] focus:ring-[#18b77f]"
                      />
                      <span className="ml-3 block cursor-pointer text-sm font-medium text-slate-300">
                        Remember this browser
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-[#18b77f]" />
                      Protected technician session
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="group relative h-14 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#159e6f] to-[#1bb6a6] text-base font-semibold text-white shadow-[0_18px_44px_rgba(21,158,111,0.24)] transition-all hover:from-[#19ae7a] hover:to-[#1fc5b5] hover:shadow-[0_24px_50px_rgba(27,182,166,0.28)] active:scale-[0.99]"
                    disabled={isSubmitting}
                  >
                    <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/30 blur-2xl transition-transform duration-700 group-hover:translate-x-[430%]" />
                    <span className="relative flex items-center justify-center">
                      <span>{isSubmitting ? 'Signing in...' : 'Enter Technician Portal'}</span>
                      {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                    </span>
                  </Button>
                </form>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/75 px-5 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/60">
                    New Technician
                  </p>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Need an account before taking assignments?
                  </p>
                  <Link
                    to="/tech/signup"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition-colors hover:text-white"
                  >
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/75 px-5 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                    Alternate Access
                  </p>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Need dispatch control instead of field access?
                  </p>
                  <Link
                    to="/admin/login"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-white"
                  >
                    Go to admin login
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
