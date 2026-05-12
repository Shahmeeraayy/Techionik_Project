import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AuthSplitShell,
  authInputClass,
  authLabelClass,
  authPanelClass,
} from './AuthSplitShell';

export default function TechnicianSignupPage() {
  const { requestTechnicianSignup } = useAuth();
  const location = useLocation();
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tenantParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      tenantId: params.get('tenant_id')?.trim() || undefined,
      tenantSlug: params.get('tenant')?.trim().toLowerCase() || undefined,
    };
  }, [location.search]);

  const submittedAdminEmail = successMessage ?? adminEmail;

  const resetForm = () => {
    setName('');
    setAdminEmail('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
  };

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
      const normalizedAdminEmail = adminEmail.trim().toLowerCase();
      await requestTechnicianSignup({
        name: name.trim(),
        adminEmail: normalizedAdminEmail,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        tenantId: tenantParams.tenantId,
        tenantSlug: tenantParams.tenantSlug,
      });
      setSuccessMessage(normalizedAdminEmail);
      resetForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit signup request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitShell
      accent="tech-signup"
      badge="DispatchIQ Technician"
      eyebrow="Welcome"
      title={<>Create account</>}
      description=""
      chips={[]}
      footer={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Already approved</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Received approval and ready to start taking assignments?
            </p>
            <Link to="/tech/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Dispatch access</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Need admin-side access instead of technician onboarding?
            </p>
            <Link to="/admin/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Admin login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      }
    >
      <div className="mb-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.05] p-2">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Approval required</p>
            <p className="mt-1 text-sm leading-6 text-white/78">
              Your account will be active after admin approval.
            </p>
          </div>
        </div>
      </div>

      {successMessage ? (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-white/12 bg-white/[0.03] px-4 py-4 text-white">
            <p className="text-sm font-semibold">Request sent successfully</p>
            <p className="mt-2 text-sm leading-6 text-white/84">
              Your technician request has been routed to <span className="font-semibold">{submittedAdminEmail}</span>.
            </p>
          </div>

          <div className={`${authPanelClass} space-y-2`}>
            <p className="text-sm font-semibold text-white">Next step</p>
            <p className="text-sm leading-6 text-white/78">
              Wait for approval, then sign in to the technician portal.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              asChild
              className="h-14 rounded-[20px] bg-white text-base font-semibold text-black transition-all hover:bg-white/90"
            >
              <Link to="/tech/login">
                Go to sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className="h-14 rounded-[20px] border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06] hover:text-white"
            >
              Create another request
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="signup-name" className={authLabelClass}>
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
                className={authInputClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="signup-admin-email" className={authLabelClass}>
                Admin Email
              </Label>
              <Input
                id="signup-admin-email"
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="owner@yourdispatch.com"
                className={authInputClass}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-email" className={authLabelClass}>
                Email
              </Label>
              <Input
                id="signup-email"
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
              <Label htmlFor="signup-phone" className={authLabelClass}>
                Phone
              </Label>
              <Input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                placeholder="Optional"
                className={authInputClass}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="signup-password" className={authLabelClass}>
                  Password
                </Label>
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
                  className={`${authInputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup-confirm-password" className={authLabelClass}>
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
                  className={`${authInputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-800"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              {isSubmitting ? 'Submitting request...' : 'Create account'}
              {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
            </span>
          </Button>
        </form>
      )}
    </AuthSplitShell>
  );
}
