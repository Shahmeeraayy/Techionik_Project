import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

type AuthAccent = 'admin' | 'tech' | 'signup' | 'tech-signup';

type AuthSplitShellProps = {
  accent: AuthAccent;
  badge: string;
  eyebrow?: string;
  title: ReactNode;
  description: string;
  chips: string[];
  children: ReactNode;
  footer?: ReactNode;
};

const accentConfig: Record<
  AuthAccent,
  {
    badge: string;
    buttonRing: string;
  }
> = {
  admin: {
    badge: 'border-white/10 bg-[#0f172a] text-white',
    buttonRing: 'shadow-[0_24px_54px_rgba(79,124,255,0.16)]',
  },
  tech: {
    badge: 'border-white/10 bg-[#0f172a] text-white',
    buttonRing: 'shadow-[0_24px_54px_rgba(79,124,255,0.16)]',
  },
  signup: {
    badge: 'border-white/10 bg-[#0f172a] text-white',
    buttonRing: 'shadow-[0_24px_54px_rgba(79,124,255,0.16)]',
  },
  'tech-signup': {
    badge: 'border-white/10 bg-[#0f172a] text-white',
    buttonRing: 'shadow-[0_24px_54px_rgba(79,124,255,0.16)]',
  },
};

export const authInputClass =
  'h-12 rounded-2xl border border-[rgba(148,163,184,0.22)] bg-[rgba(10,18,32,0.96)] px-4 text-[15px] text-[#f4f8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-[#8ea3c5] focus-visible:border-[#67e8f9]/50 focus-visible:ring-[#67e8f9]/15';

export const authLabelClass = 'text-sm font-semibold text-white';

export const authPanelClass =
  'rounded-[22px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] px-4 py-4 text-white shadow-[0_18px_54px_rgba(2,6,23,0.24),inset_0_1px_0_rgba(255,255,255,0.045)]';

export const authPrimaryButtonClass =
  'h-14 w-full rounded-[20px] bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-base font-semibold text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] transition-all hover:brightness-105';

export function AuthSplitShell({
  accent,
  badge,
  eyebrow,
  title,
  description,
  chips,
  children,
  footer,
}: AuthSplitShellProps) {
  const theme = accentConfig[accent];

  return (
    <div className="relative min-h-[100svh] overflow-x-hidden bg-[#080c14] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(79,124,255,0.08),transparent_32%),linear-gradient(180deg,#0b1220_0%,#080c14_44%,#060913_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:112px_112px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,transparent_78%,rgba(255,255,255,0.02))]" />

      <main className="relative flex min-h-[100svh] items-center justify-center px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="w-full max-w-[560px] rounded-[32px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(14,23,40,0.98),rgba(8,12,20,0.98))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-col items-center text-center">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] ${theme.badge}`}>
              <Sparkles className="h-3.5 w-3.5" />
              {badge}
            </div>
            {eyebrow ? (
              <p className="mt-5 text-sm font-medium uppercase tracking-[0.22em] text-white/72">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-2 text-[clamp(2rem,6vw,3.5rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-md text-sm leading-7 text-white/82 sm:text-[15px]">
                {description}
              </p>
            ) : null}
          </div>

          {chips.length > 0 ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                className="rounded-full border border-[rgba(148,163,184,0.18)] bg-[rgba(12,20,34,0.9)] px-3 py-1.5 text-[11px] font-medium text-[#eaf1ff]"
              >
                {chip}
              </span>
            ))}
          </div>
          ) : null}

          <div className={`mt-5 rounded-[28px] border border-[rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(8,18,32,0.98),rgba(5,10,20,0.99))] p-4 ${theme.buttonRing} sm:p-5`}>
            {children}
          </div>

          {footer ? <div className="mt-4">{footer}</div> : null}
        </section>
      </main>
    </div>
  );
}
