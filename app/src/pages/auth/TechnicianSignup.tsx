import { Link } from 'react-router-dom';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AuthSplitShell,
  authPanelClass,
  authPrimaryButtonClass,
} from './AuthSplitShell';

export default function TechnicianSignupPage() {
  return (
    <AuthSplitShell
      accent="tech-signup"
      badge="NexusOps Technician"
      eyebrow="Welcome"
      title={<>Invite only</>}
      description=""
      chips={[]}
      footer={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-4 text-white shadow-[0_18px_54px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.045)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Already invited</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Already received your account details from admin?
            </p>
            <Link to="/tech/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Technician sign in
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex h-full flex-col rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-4 text-white shadow-[0_18px_54px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.045)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Dispatch access</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-white/84">
              Need admin-side controls instead of field access?
            </p>
            <Link to="/admin/login" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80">
              Admin login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-4 shadow-[0_18px_54px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.045)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.05] p-2">
              <ShieldCheck className="h-4 w-4 text-[#d9f8ff]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Technician accounts are admin-managed</p>
              <p className="mt-1 text-sm leading-6 text-white/78">
                Only admin users can create technician accounts, send invite emails, reset passwords, and activate or suspend access.
              </p>
            </div>
          </div>
        </div>

        <div className={`${authPanelClass} space-y-3`}>
          <p className="text-sm font-semibold text-white">What to do next</p>
          <ul className="space-y-2 text-sm leading-6 text-white/78">
            <li>Ask your dispatch admin to create your technician account.</li>
            <li>Watch for an invite email with your sign-in details.</li>
            <li>Come back here to sign in once your access has been activated.</li>
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            asChild
            className={authPrimaryButtonClass}
          >
            <Link to="/tech/login">
              Go to sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            type="button"
            asChild
            variant="outline"
            className="h-14 rounded-[20px] !border-[rgba(148,163,184,0.18)] !bg-[rgba(12,20,34,0.9)] !text-[#eaf1ff] hover:!bg-[rgba(23,37,64,0.94)] hover:!text-white"
          >
            <Link to="/admin/login">
              <Mail className="mr-2 h-4 w-4" />
              Contact admin
            </Link>
          </Button>
        </div>
      </div>
    </AuthSplitShell>
  );
}
