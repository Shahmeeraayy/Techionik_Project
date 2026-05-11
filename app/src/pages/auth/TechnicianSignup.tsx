import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from './AuthShell';

const authInputClass =
  'h-[52px] rounded-2xl border-slate-200 bg-slate-50/70 px-4 text-base text-slate-950 shadow-inner shadow-slate-200/40 placeholder:text-slate-400 focus-visible:border-[#14b8a6] focus-visible:bg-white focus-visible:ring-[#14b8a6]/15';

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
    <AuthShell
      eyebrow="Technician Signup"
      title="Join the"
      titleAccent="field network"
      description="Request a technician account for job assignments, route updates, service history, and field profile access."
      statusLabel="Approval flow"
      tags={['Onboarding', 'Readiness', 'Admin review']}
      footer={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm text-slate-500">Already approved?</p>
            <Link
              to="/tech/login"
              className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#0f9f8f] transition-colors hover:text-slate-950"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-sm text-slate-500">Need dispatch control?</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#4f7cff] transition-colors hover:text-slate-950"
              onClick={() => navigate('/admin/login')}
            >
              Admin login
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#14b8a6] shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-950">Approval-first onboarding</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Your request appears in the admin portal before account access becomes active.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="signup-name" className="text-sm font-bold text-slate-700">
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

          <div className="space-y-2">
            <Label htmlFor="signup-email" className="text-sm font-bold text-slate-700">
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
              className={authInputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-phone" className="text-sm font-bold text-slate-700">
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
            <Label htmlFor="signup-password" className="text-sm font-bold text-slate-700">
              Password
            </Label>
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-confirm-password" className="text-sm font-bold text-slate-700">
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-14 w-full rounded-2xl bg-slate-950 text-base font-bold text-white shadow-[0_18px_42px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#14b8a6] active:translate-y-0"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting request...' : 'Request Admin Approval'}
          {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
        </Button>
      </form>
    </AuthShell>
  );
}
