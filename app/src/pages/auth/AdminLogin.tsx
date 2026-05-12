import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthSplitShell, authInputClass, authLabelClass, authPanelClass } from './AuthSplitShell';

type NavigationState = {
  from?: string;
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
    <AuthSplitShell
      accent="admin"
      badge="DispatchIQ Admin"
      eyebrow="Welcome"
      title={<>Sign in</>}
      description=""
      chips={[]}
      footer={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">New company</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Need a fresh dispatch workspace before signing in?
            </p>
            <Link to="/admin/signup" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Create admin account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Field access</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Need technician access instead of dispatch controls?
            </p>
            <Link to="/tech/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Go to technician login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="admin-email" className={authLabelClass}>
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="admin@company.com"
            className={authInputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="admin-password" className={authLabelClass}>
              Password
            </Label>
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Protected session
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
              placeholder="Enter password"
              className={`${authInputClass} pr-12`}
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

        <div className={`${authPanelClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <label className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-white/20 bg-transparent text-black focus:ring-white/30"
            />
            <span className="ml-3 text-sm font-medium text-slate-200">Remember this browser</span>
          </label>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 text-white" />
            Secure admin access
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-14 w-full rounded-[20px] bg-white text-base font-semibold text-black transition-all hover:bg-white/90"
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
