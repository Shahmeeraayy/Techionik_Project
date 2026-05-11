import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  completeTechnicianPasswordReset,
  fetchTechnicianPasswordResetLink,
} from '@/lib/backend-api';
import {
  technicianBodyFontStyle,
  technicianDisplayFontStyle,
  technicianGridOverlayStyle,
  technicianOrbitalGlowStyle,
  technicianPageBackgroundStyle,
} from './technicianAuthTheme';

export default function TechnicianPasswordResetPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [technicianName, setTechnicianName] = useState('Technician');
  const [technicianEmail, setTechnicianEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!requestId) {
      setErrorMessage('Password reset link is incomplete.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchTechnicianPasswordResetLink(requestId);
        if (!isMounted) {
          return;
        }
        setTechnicianName(response.technician_name?.trim() || 'Technician');
        setTechnicianEmail(response.technician_email);
        setExpiresAt(response.expires_at);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Unable to open this password reset link.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  const expiresLabel = useMemo(() => {
    if (!expiresAt) {
      return null;
    }
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return expiresAt;
    }
    return parsed.toLocaleString();
  }, [expiresAt]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedPassword = newPassword.trim();
    if (normalizedPassword.length < 6) {
      setErrorMessage('Use at least 6 characters for the new password.');
      return;
    }
    if (normalizedPassword !== confirmPassword.trim()) {
      setErrorMessage('The password confirmation does not match.');
      return;
    }
    if (!requestId) {
      setErrorMessage('Password reset link is incomplete.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await completeTechnicianPasswordReset(requestId, {
        new_password: normalizedPassword,
      });
      setSuccessMessage(response.message);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden bg-[#04131f] text-white antialiased"
      style={technicianPageBackgroundStyle}
    >
      <div className="pointer-events-none absolute inset-0 opacity-35" style={technicianGridOverlayStyle} />
      <div className="pointer-events-none absolute left-[-6rem] top-[-7rem] h-72 w-72 rounded-full bg-emerald-400/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-6rem] h-80 w-80 rounded-full bg-teal-300/14 blur-3xl" />

      <main className="relative flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative w-full max-w-[560px]" style={technicianBodyFontStyle}>
          <div className="pointer-events-none absolute inset-x-5 top-4 h-full rounded-[40px] border border-white/8 bg-white/[0.03] blur-sm" />
          <div
            className="pointer-events-none absolute -left-3 -right-3 -top-3 h-40 rounded-[38px] opacity-80 blur-2xl"
            style={technicianOrbitalGlowStyle}
          />

          <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,31,48,0.96),rgba(6,23,38,0.96))] p-6 shadow-[0_34px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0)_52%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/70 to-transparent" />

            <div className="relative">
              <div
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100"
                style={technicianDisplayFontStyle}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure reset
              </div>

              <h1
                className="mt-5 text-[clamp(2.1rem,4vw,3.55rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-white"
                style={technicianDisplayFontStyle}
              >
                Reset your
                <span className="block bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
                  technician password
                </span>
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300 sm:text-[15px]">
                Create a fresh password for your field account and head back into the technician portal.
              </p>

              <div className="mt-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,27,43,0.92),rgba(7,23,37,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_rgba(3,12,24,0.34)] sm:p-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
                    <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
                    <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
                  </div>
                ) : errorMessage && !successMessage ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {errorMessage}
                    </div>
                    <Button asChild className="bg-gradient-to-r from-[#139c69] to-[#1bb2a5] text-white hover:from-[#18ab74] hover:to-[#20c2b5]">
                      <Link to="/tech/login">Back to technician login</Link>
                    </Button>
                  </div>
                ) : successMessage ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                      {successMessage}
                    </div>
                    <Button asChild className="bg-gradient-to-r from-[#139c69] to-[#1bb2a5] text-white hover:from-[#18ab74] hover:to-[#20c2b5]">
                      <Link to="/tech/login">
                        Continue to sign in
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100/60">
                        Account
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">{technicianName}</p>
                      <p className="mt-1 text-sm text-slate-300">{technicianEmail}</p>
                      {expiresLabel ? (
                        <p className="mt-3 text-xs text-slate-400">This link expires on {expiresLabel}.</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="block text-sm font-semibold text-slate-200">
                        New Password
                      </Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        placeholder="Enter a new password"
                        className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 text-base text-white placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-200">
                        Confirm Password
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                        placeholder="Re-enter the new password"
                        className="h-[54px] rounded-2xl border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-4 text-base text-white placeholder:text-slate-500 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-300/15"
                      />
                    </div>

                    {errorMessage ? (
                      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {errorMessage}
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-[54px] w-full rounded-2xl bg-gradient-to-r from-[#139c69] to-[#1bb2a5] text-base font-semibold text-white hover:from-[#18ab74] hover:to-[#20c2b5]"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      {isSubmitting ? 'Resetting password...' : 'Reset password'}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
