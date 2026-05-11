import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  technicianBodyFontStyle,
  technicianDisplayFontStyle,
  technicianGridOverlayStyle,
  technicianOrbitalGlowStyle,
  technicianPageBackgroundStyle,
} from './technicianAuthTheme';

const accessTags = ['Approval', 'Readiness', 'Onboarding'] as const;

export default function TechnicianSignupPage() {
  const { requestTechnicianSignup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestTechnicianSignup({ name, email, phone, password });
      setSuccessMessage('Signup request submitted. Wait for admin approval before signing in.');
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit signup request.');
    } finally {
      setIsSubmitting(false);
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
        <div className="admin-login-card relative w-full max-w-[620px]" style={technicianBodyFontStyle}>
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
                    <UserPlus className="h-3.5 w-3.5" />
                    Technician onboarding
                  </div>

                  <h1
                    className="mt-5 text-[clamp(2.2rem,4vw,3.7rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white"
                    style={technicianDisplayFontStyle}
                  >
                    Request field
                    <span className="block bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
                      access
                    </span>
                  </h1>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-[15px]">
                    Submit your details and the request lands in the admin approval queue. Your account becomes active
                    only after review.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Admin approval
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
                <div className="mb-5 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 p-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-200" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Approval-first technician onboarding</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Requests are reviewed in the admin portal before credentials become active for sign-in.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="signup-name" className="block text-sm font-semibold text-slate-200">
                        Full Name
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        required
                        placeholder="John Smith"
                        className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="block text-sm font-semibold text-slate-200">
                        Email
                      </Label>
                      <Input
                        id="signup-email"
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
                      <Label htmlFor="signup-phone" className="block text-sm font-semibold text-slate-200">
                        Phone
                      </Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        autoComplete="tel"
                        placeholder="Optional"
                        className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signup-password" className="block text-sm font-semibold text-slate-200">
                          Password
                        </Label>
                        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-100/55">
                          Secure setup
                        </span>
                      </div>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          placeholder="Create password"
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

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password" className="block text-sm font-semibold text-slate-200">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          autoComplete="new-password"
                          required
                          placeholder="Repeat password"
                          className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 pr-12 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-200"
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {errorMessage}
                    </div>
                  )}
                  {successMessage && (
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                      {successMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="group relative h-14 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#159e6f] to-[#1bb6a6] text-base font-semibold text-white shadow-[0_18px_44px_rgba(21,158,111,0.24)] transition-all hover:from-[#19ae7a] hover:to-[#1fc5b5] hover:shadow-[0_24px_50px_rgba(27,182,166,0.28)] active:scale-[0.99]"
                    disabled={isSubmitting}
                  >
                    <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/30 blur-2xl transition-transform duration-700 group-hover:translate-x-[430%]" />
                    <span className="relative flex items-center justify-center">
                      <span>{isSubmitting ? 'Submitting request...' : 'Request Admin Approval'}</span>
                      {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                    </span>
                  </Button>
                </form>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/75 px-5 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/60">
                    Already Approved
                  </p>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Received approval and ready to start taking assignments?
                  </p>
                  <Link
                    to="/tech/login"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition-colors hover:text-white"
                  >
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/75 px-5 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                    Alternate Access
                  </p>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Need dispatch-side access instead of technician onboarding?
                  </p>
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-white"
                    onClick={() => navigate('/admin/login')}
                  >
                    Admin login
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
