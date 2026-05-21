import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AuthSplitShell,
  authPrimaryButtonClass,
} from './AuthSplitShell';

export default function TechnicianSignupPage() {
  const steps = [
    'Admin creates your account',
    'You receive your sign-in details',
    'Access becomes available after activation',
  ];

  return (
    <AuthSplitShell
      accent="tech-signup"
      badge="NexusOps Technician"
      title={<>Invite-only access</>}
      description="Technician accounts are created and managed by admins. If you already received your login details, continue to sign in."
      chips={[]}
      contentFrame={false}
    >
      <div className="space-y-6">
        <div className="mx-auto max-w-sm space-y-3 text-left">
          {steps.map((step) => (
            <div key={step} className="flex items-center gap-3 text-sm font-medium text-white/82">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>

        <div className="mx-auto w-full max-w-sm">
          <Button type="button" asChild className={authPrimaryButtonClass}>
            <Link to="/tech/login">
              Go to sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="text-center text-sm text-white/62">
          Need admin access?{' '}
          <Link to="/admin/login" className="font-semibold text-cyan-100 hover:text-white">
            Admin login
          </Link>
        </div>
      </div>
    </AuthSplitShell>
  );
}
