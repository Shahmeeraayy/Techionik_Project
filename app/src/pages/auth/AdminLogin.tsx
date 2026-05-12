import { useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type NavigationState = {
  from?: string;
};

const pageBackgroundStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 18% 18%, rgba(45, 212, 191, 0.18), transparent 22%), radial-gradient(circle at 82% 14%, rgba(34, 211, 238, 0.16), transparent 24%), linear-gradient(145deg, #03101a 0%, #072236 52%, #08263a 100%)',
};

const gridOverlayStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '120px 120px',
  backgroundPosition: '-1px -1px',
};

const orbitalGlowStyle: CSSProperties = {
  background:
    'radial-gradient(circle at 50% 0%, rgba(56,189,248,0.32), rgba(56,189,248,0) 52%), radial-gradient(circle at 80% 20%, rgba(45,212,191,0.22), rgba(45,212,191,0) 38%)',
};

const accessTags = ['Dispatch', 'Approvals', 'Technicians'] as const;
const displayFontStyle: CSSProperties = {
  fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};
const bodyFontStyle: CSSProperties = {
  fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@sm2dispatch.com');
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
    <div
      className="relative min-h-[100svh] overflow-hidden bg-[#04131f] text-white antialiased"
      style={pageBackgroundStyle}
    >
      <div className="admin-login-grid pointer-events-none absolute inset-0 opacity-35" style={gridOverlayStyle} />
      <div className="pointer-events-none absolute left-[-5rem] top-[-6rem] h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-teal-300/14 blur-3xl" />

      <main className="relative flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="admin-login-card relative w-full max-w-[560px]" style={bodyFontStyle}>
          <div className="pointer-events-none absolute inset-x-5 top-4 h-full rounded-[40px] border border-white/8 bg-white/[0.03] blur-sm" />
          <div
            className="admin-login-halo pointer-events-none absolute -left-3 -right-3 -top-3 h-40 rounded-[38px] opacity-80 blur-2xl"
            style={orbitalGlowStyle}
          />

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,31,48,0.96),rgba(6,23,38,0.96))] p-6 shadow-[0_34px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0)_52%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
            <div className="pointer-events-none absolute left-8 top-[7.1rem] h-px w-28 bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent admin-login-scan" />

            <div className="relative">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    style={displayFontStyle}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    SM2 Electronics
                  </div>

                  <h1
                    className="mt-5 text-[clamp(2.2rem,4vw,3.85rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white"
                    style={displayFontStyle}
                  >
                    Admin
                    <span className="block bg-gradient-to-r from-white via-cyan-100 to-cyan-200 bg-clip-text text-transparent">
                      portal
                    </span>
                  </h1>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-[15px]">
                    Sign in to your dispatch control workspace with a cleaner, more premium operator experience.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm font-medium text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Protected access
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
                    <Label htmlFor="admin-email" className="block text-sm font-semibold text-slate-200">
                      Email Address
                    </Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                      placeholder="admin@sm2dispatch.com"
                      className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-cyan-300/45 focus-visible:ring-cyan-300/15"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="admin-password" className="block text-sm font-semibold text-slate-200">
                        Password
                      </Label>
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-100/55">
                        Private session
                      </span>
                    </div>

                    <div className="relative">
                      <Input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                        placeholder="********"
                        className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 pr-12 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-slate-500 focus-visible:border-cyan-300/45 focus-visible:ring-cyan-300/15"
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
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberSession}
                        onChange={(event) => setRememberSession(event.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-500 bg-transparent text-[#18b7ad] focus:ring-[#18b7ad]"
                      />
                      <span className="ml-3 block cursor-pointer text-sm font-medium text-slate-300">
                        Remember this browser
                      </span>
                    </label>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-[#18b7ad]" />
                      Protected admin session
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="group relative h-14 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#0ca6a6] to-[#149fcb] text-base font-semibold text-white shadow-[0_18px_44px_rgba(12,166,166,0.24)] transition-all hover:from-[#11b5b5] hover:to-[#1aaedf] hover:shadow-[0_24px_50px_rgba(20,159,203,0.28)] active:scale-[0.99]"
                    disabled={isSubmitting}
                  >
                    <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/30 blur-2xl transition-transform duration-700 group-hover:translate-x-[430%]" />
                    <span className="relative flex items-center justify-center">
                      <span>{isSubmitting ? 'Signing in...' : 'Enter Admin Portal'}</span>
                      {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                    </span>
                  </Button>
                </form>
              </div>

              <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/75 px-5 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                    New company
                  </p>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Need a new admin workspace before logging in?
                  </p>
                  <Link
                    to="/admin/signup"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-white"
                  >
                    Create admin account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="sm:border-l sm:border-white/8 sm:pl-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                    Alternate access
                  </p>
                  <p className="mt-2 text-sm text-slate-300/80">
                    Need field access instead of admin control?
                  </p>
                  <Link
                    to="/tech/login"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-white"
                  >
                    Go to technician login
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
