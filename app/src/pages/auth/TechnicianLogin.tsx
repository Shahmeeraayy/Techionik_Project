import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { requestTechnicianPasswordReset } from '@/lib/backend-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from './AuthShell';

type NavigationState = {
  from?: string;
};

const authInputClass =
  'h-[52px] rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-base text-slate-950 shadow-inner shadow-slate-200/40 placeholder:text-slate-400 focus-visible:border-[#14b8a6] focus-visible:bg-white focus-visible:ring-[#14b8a6]/15';

export default function TechnicianLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
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
    <AuthShell
      eyebrow="Technician Login"
      title="Start your"
      titleAccent="field day"
      description="A clean technician workspace for assigned jobs, live dispatch updates, schedules, and profile tools."
      statusLabel="Field access"
      tags={['Jobs', 'Assignments', 'Profile']}
      footer={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm text-slate-500">New technician?</p>
            <Link
              to="/tech/signup"
              className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#0f9f8f] transition-colors hover:text-slate-950"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm text-slate-500">Need dispatch control?</p>
            <Link
              to="/admin/login"
              className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#4f7cff] transition-colors hover:text-slate-950"
            >
              Admin login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="tech-email" className="text-sm font-bold text-slate-700">
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
            className={authInputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tech-password" className="text-sm font-bold text-slate-700">
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
                  className="text-sm font-bold text-[#0f9f8f] transition-colors hover:text-slate-950"
                >
                  Forgot password?
                </button>
              </DialogTrigger>
              <DialogContent className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_34px_100px_rgba(15,23,42,0.22)] sm:max-w-[520px]">
                <div className="p-6 sm:p-7">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-[#14b8a6]">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <DialogTitle className="mt-4 text-2xl font-bold tracking-[-0.03em] text-slate-950">
                    Request password help
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm leading-6 text-slate-500">
                    Send a reset request to the admin portal. If your technician account exists, the admin team can
                    review it from their account console.
                  </DialogDescription>

                  <div className="mt-6 space-y-2">
                    <Label htmlFor="forgot-tech-email" className="text-sm font-bold text-slate-700">
                      Technician Email
                    </Label>
                    <Input
                      id="forgot-tech-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                      autoComplete="email"
                      placeholder="tech@sm2dispatch.com"
                      className={authInputClass}
                    />
                  </div>

                  {forgotMessage ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      {forgotMessage}
                    </div>
                  ) : null}
                  {forgotError ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {forgotError}
                    </div>
                  ) : null}

                  <DialogFooter className="mt-6 gap-3 sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      asChild
                      className="rounded-2xl border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                    >
                      <Link to="/tech/signup">Create account</Link>
                    </Button>
                    <Button
                      type="button"
                      onClick={handleForgotPasswordRequest}
                      disabled={isForgotSubmitting}
                      className="rounded-2xl bg-slate-950 text-white hover:bg-[#14b8a6]"
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
              className={`${authInputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center">
            <input
              id="remember-tech-session"
              name="remember-tech-session"
              type="checkbox"
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#14b8a6] focus:ring-[#14b8a6]"
            />
            <span className="ml-3 block cursor-pointer text-sm font-semibold text-slate-600">
              Remember this browser
            </span>
          </label>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#14b8a6]" />
            Protected technician session
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-14 w-full rounded-2xl bg-slate-950 text-base font-bold text-white shadow-[0_18px_42px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#14b8a6] active:translate-y-0"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Enter Technician Portal'}
          {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
        </Button>
      </form>
    </AuthShell>
  );
}
