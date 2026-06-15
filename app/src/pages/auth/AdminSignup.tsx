import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthSplitShell, authInputClass, authInputStyle, authLabelClass, authPrimaryButtonClass } from './AuthSplitShell';

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
    () => (workspaceSlug ? `book.${workspaceSlug}.nexusops.app` : 'book.your-company.nexusops.app'),
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
      badge="NexusOps Signup"
      title={<>Create your workspace</>}
      description="Create your company workspace."
      chips={[]}
      contentFrame={false}
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4 text-left">
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
              placeholder="NexusOps"
              className={authInputClass}
              style={authInputStyle}
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
              placeholder="nexusops"
              className={authInputClass}
              style={authInputStyle}
            />
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-medium text-white/72">
              <Building2 className="h-3.5 w-3.5 text-cyan-100" />
              <span className="break-all">{workspacePreview}</span>
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
              style={authInputStyle}
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
              style={authInputStyle}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="owner-password" className={authLabelClass}>
                Password
              </Label>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9fb1cf]">
                12+ characters
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
                minLength={12}
                placeholder="Create a secure password"
                className={`${authInputClass} pr-12`}
                style={authInputStyle}
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
            <p className="text-xs leading-5 text-[#9fb1cf]">
              Use at least 12 characters with uppercase, lowercase, a number, and a symbol.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={rememberSession}
              onChange={(event) => setRememberSession(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-white/20 bg-transparent text-[#4f7cff] focus:ring-[#67e8f9]/20"
            />
            <span className="ml-3 text-sm font-medium text-slate-200">Keep me signed in</span>
          </label>
          <div className="flex items-center gap-2 text-sm text-[#9fb1cf]">
            <ShieldCheck className="h-4 w-4 text-[#d9f8ff]" />
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
          className={authPrimaryButtonClass}
          disabled={isSubmitting}
        >
          <span className="flex items-center justify-center">
            {isSubmitting ? 'Creating account...' : 'Create account'}
            {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </span>
        </Button>

        <div className="text-center text-sm text-white/62">
          Already have an account?{' '}
          <Link to="/admin/login" className="font-semibold text-cyan-100 hover:text-white">
            Sign in
          </Link>
        </div>
      </form>
    </AuthSplitShell>
  );
}
