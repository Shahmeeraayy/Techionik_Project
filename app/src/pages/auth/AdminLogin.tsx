import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from './AuthShell';

type NavigationState = {
  from?: string;
};

const authInputClass =
  'h-[52px] rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-base text-slate-950 shadow-inner shadow-slate-200/40 placeholder:text-slate-400 focus-visible:border-[#4f7cff] focus-visible:bg-white focus-visible:ring-[#4f7cff]/15';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('admin@sm2dispatch.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
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
    <AuthShell
      variant="admin"
      eyebrow="Admin Login"
      title="Command your"
      titleAccent="service ops"
      description="A premium SaaS workspace for dispatch, technician approvals, invoices, and every job moving through the business."
      statusLabel="Admin access"
      tags={['Dispatch', 'Approvals', 'Invoices']}
      footer={
        <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm text-slate-500">Need field access instead?</p>
          <Link
            to="/tech/login"
            className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#4f7cff] transition-colors hover:text-slate-950"
          >
            Open technician login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-sm font-bold text-slate-700">
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
            className={authInputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="admin-password" className="text-sm font-bold text-slate-700">
              Password
            </Label>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Private session</span>
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
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#4f7cff] focus:ring-[#4f7cff]"
            />
            <span className="ml-3 block cursor-pointer text-sm font-semibold text-slate-600">
              Remember this browser
            </span>
          </label>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#4f7cff]" />
            Protected admin session
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-14 w-full rounded-2xl bg-slate-950 text-base font-bold text-white shadow-[0_18px_42px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#4f7cff] active:translate-y-0"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Enter Admin Portal'}
          {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
        </Button>
      </form>
    </AuthShell>
  );
}
