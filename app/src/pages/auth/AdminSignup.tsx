import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthSplitShell, authInputClass, authLabelClass, authPanelClass } from './AuthSplitShell';

function slugifyWorkspace(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 96);
}

export default function AdminSignupPage() {
  const { signupAdmin } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const workspacePreview = useMemo(
    () => (workspaceSlug ? `book.${workspaceSlug}.dispatchiq.com` : 'book.your-company.dispatchiq.com'),
    [workspaceSlug],
  );

  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    setWorkspaceSlug((current) => (current.trim().length > 0 ? current : slugifyWorkspace(value)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await signupAdmin({
        companyName,
        workspaceSlug,
        fullName,
        email,
        password,
        remember: rememberSession,
      });
      navigate('/admin', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Workspace signup failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitShell
      accent="signup"
      badge="DispatchIQ Signup"
      eyebrow="Welcome"
      title={<>Create account</>}
      description=""
      chips={[]}
      footer={
        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white sm:flex sm:min-h-[112px] sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Already have a workspace?</p>
            <p className="mt-2 text-sm leading-6 text-white/84">
              Sign back in to continue running dispatch.
            </p>
          </div>
          <Link to="/admin/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80 sm:mt-0">
            Go to admin login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-name" className={authLabelClass}>
              Company Name
            </Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(event) => handleCompanyNameChange(event.target.value)}
              required
              placeholder="SM2 electronics"
              className={authInputClass}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="workspace-slug" className={authLabelClass}>
              Workspace URL
            </Label>
            <Input
              id="workspace-slug"
              value={workspaceSlug}
              onChange={(event) => setWorkspaceSlug(slugifyWorkspace(event.target.value))}
              required
              placeholder="sm2-electronics"
              className={authInputClass}
            />
            <div className={`${authPanelClass} flex items-center gap-2 py-3 text-xs text-white/88`}>
              <Building2 className="h-3.5 w-3.5 text-white" />
              <span>{workspacePreview}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-name" className={authLabelClass}>
              Your Full Name
            </Label>
            <Input
              id="owner-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              placeholder="Alex Morgan"
              className={authInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-email" className={authLabelClass}>
              Work Email
            </Label>
            <Input
              id="owner-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              placeholder="owner@company.com"
              className={authInputClass}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="owner-password" className={authLabelClass}>
                Password
              </Label>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                6+ characters
              </span>
            </div>
            <div className="relative">
              <Input
                id="owner-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
                placeholder="Create a secure password"
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
        </div>

        <div className={`${authPanelClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-white/20 bg-transparent text-black focus:ring-white/30"
            />
            <span className="ml-3 text-sm font-medium text-slate-200">Keep me signed in</span>
          </label>
          <div className="flex items-center gap-2 text-sm text-white/78">
            <ShieldCheck className="h-4 w-4 text-white" />
            Secure owner access
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
            {isSubmitting ? 'Creating account...' : 'Create account'}
            {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </span>
        </Button>
      </form>
    </AuthSplitShell>
  );
}
