import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
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
import { AuthSplitShell, authInputClass, authLabelClass, authPanelClass, authPrimaryButtonClass } from './AuthSplitShell';

type NavigationState = {
  from?: string;
};

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
    <AuthSplitShell
      accent="tech"
      badge="DispatchIQ Technician"
      eyebrow="Welcome"
      title={<>Sign in</>}
      description=""
      chips={[]}
      footer={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-4 text-white shadow-[0_18px_54px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.045)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">New technician</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Need an account before taking assignments?
            </p>
            <Link to="/tech/signup" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-4 text-white shadow-[0_18px_54px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.045)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Dispatch access</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Need admin-side controls instead of field access?
            </p>
            <Link to="/admin/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Go to admin login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="tech-email" className={authLabelClass}>
            Email
          </Label>
          <Input
            id="tech-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="tech@company.com"
            className={authInputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tech-password" className={authLabelClass}>
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
                <button type="button" className="text-sm font-semibold text-white hover:text-white/80">
                  Forgot password?
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:max-w-[520px]">
                <div className="p-6 sm:p-7">
                  <DialogHeader>
                    <DialogTitle className="text-[1.7rem] font-semibold tracking-[-0.04em] text-white">
                      Need password help?
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-white/78">
                      Send a reset request to the admin workspace connected to your technician account.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-tech-email" className={authLabelClass}>
                        Technician Email
                      </Label>
                      <Input
                        id="forgot-tech-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                        autoComplete="email"
                        placeholder="tech@company.com"
                        className={authInputClass}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      If the account exists, the admin team will see the request in their dashboard.
                    </p>
                  </div>

                  {forgotMessage ? (
                    <div className="mt-4 rounded-[18px] border border-white/12 bg-white/[0.03] px-4 py-3 text-sm text-white/84">
                      {forgotMessage}
                    </div>
                  ) : null}
                  {forgotError ? (
                    <div className="mt-4 rounded-[18px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {forgotError}
                    </div>
                  ) : null}

                  <DialogFooter className="mt-6 gap-3 sm:justify-between">
                    <Button type="button" variant="outline" asChild className="rounded-[18px] border-[rgba(148,163,184,0.18)] bg-[rgba(12,20,34,0.9)] text-[#eaf1ff] hover:bg-[rgba(23,37,64,0.94)]">
                      <Link to="/tech/signup">Create account</Link>
                    </Button>
                    <Button
                      type="button"
                      onClick={handleForgotPasswordRequest}
                      disabled={isForgotSubmitting}
                      className="rounded-[18px] bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-white hover:brightness-105"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8ea3c5] transition-colors hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className={`${authPanelClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <label className="flex items-center">
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
          <div className="flex items-center gap-2 text-sm text-[#9fb1cf]">
            <ShieldCheck className="h-4 w-4 text-[#d9f8ff]" />
            Secure technician access
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          className={authPrimaryButtonClass}
          disabled={isSubmitting}
        >
          <span className="flex items-center justify-center">
            {isSubmitting ? 'Signing in...' : 'Log In'}
            {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </span>
        </Button>
      </form>
    </AuthSplitShell>
  );
}
