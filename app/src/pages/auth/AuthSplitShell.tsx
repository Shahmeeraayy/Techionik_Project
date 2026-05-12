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
    badge: 'border-white/14 bg-white/[0.04] text-white',
    buttonRing: 'shadow-[0_20px_48px_rgba(255,255,255,0.04)]',
  },
  tech: {
    badge: 'border-white/14 bg-white/[0.04] text-white',
    buttonRing: 'shadow-[0_20px_48px_rgba(255,255,255,0.04)]',
  },
  signup: {
    badge: 'border-white/14 bg-white/[0.04] text-white',
    buttonRing: 'shadow-[0_20px_48px_rgba(255,255,255,0.04)]',
  },
  'tech-signup': {
    badge: 'border-white/14 bg-white/[0.04] text-white',
    buttonRing: 'shadow-[0_20px_48px_rgba(255,255,255,0.04)]',
  },
};

export const authInputClass =
  'h-12 rounded-2xl border border-white/14 bg-white px-4 text-[15px] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus-visible:border-white/40 focus-visible:ring-white/10';

export const authLabelClass = 'text-sm font-semibold text-white';

export const authPanelClass =
  'rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

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
    <div className="relative min-h-[100svh] overflow-x-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_20%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_22%),linear-gradient(180deg,#050505_0%,#030303_48%,#000000_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:52px_52px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,transparent_78%,rgba(255,255,255,0.02))]" />

      <main className="relative flex min-h-[100svh] items-center justify-center px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="w-full max-w-[560px] rounded-[32px] border border-white/10 bg-[#080808]/96 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-6">
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
                  className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/92"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}

          <div className={`mt-5 rounded-[28px] border border-white/10 bg-[#0a0a0a] p-4 ${theme.buttonRing} sm:p-5`}>
            {children}
          </div>

          {footer ? <div className="mt-4">{footer}</div> : null}
        </section>
      </main>
    </div>
  );
}
