import { type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, CheckCircle2, ClipboardList, Gauge, RadioTower, ShieldCheck, Sparkles } from 'lucide-react';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  statusLabel: string;
  tags: readonly string[];
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'admin' | 'technician';
};

const shellFontStyle: CSSProperties = {
  fontFamily: '"Manrope", "Inter", system-ui, sans-serif',
};

const displayFontStyle: CSSProperties = {
  fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif',
};

const shellBackgroundStyle: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 11% 16%, rgba(79, 124, 255, 0.18), transparent 25%), radial-gradient(circle at 89% 8%, rgba(20, 184, 166, 0.14), transparent 24%), linear-gradient(135deg, #eef4ff 0%, #f8fbff 45%, #e8fff9 100%)',
};

const visualMetrics = [
  ['92%', 'On-time routes'],
  ['18m', 'Avg. response'],
  ['4.9', 'Service score'],
] as const;

const dashboardRows = [
  ['J-2048', 'Route planned', 'bg-emerald-500'],
  ['J-2051', 'Invoice ready', 'bg-blue-500'],
  ['J-2053', 'Needs review', 'bg-amber-500'],
] as const;

export function AuthShell({
  eyebrow,
  title,
  titleAccent,
  description,
  statusLabel,
  tags,
  children,
  footer,
  variant = 'technician',
}: AuthShellProps) {
  const accent = variant === 'admin' ? '#4f7cff' : '#14b8a6';
  const accentSoft = variant === 'admin' ? 'bg-blue-50 text-blue-700 ring-blue-100' : 'bg-teal-50 text-teal-700 ring-teal-100';
  const visualGradient =
    variant === 'admin'
      ? 'from-[#edf2ff] via-white to-[#e9fbff]'
      : 'from-[#ebfff9] via-white to-[#eef4ff]';

  return (
    <div className="min-h-[100svh] overflow-hidden px-4 py-6 text-slate-950 sm:px-6 lg:px-8" style={shellBackgroundStyle}>
      <main
        className="mx-auto grid min-h-[calc(100svh-3rem)] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/80 bg-white/78 shadow-[0_34px_100px_rgba(15,23,42,0.16)] backdrop-blur-2xl lg:grid-cols-[0.92fr_1.08fr]"
        style={shellFontStyle}
      >
        <section className="relative flex min-h-[100%] flex-col justify-center bg-white/82 px-6 py-8 sm:px-10 lg:px-12">
          <div className="pointer-events-none absolute inset-y-8 right-0 hidden w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent lg:block" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)]">
              <Sparkles className="h-3.5 w-3.5" />
              SM2 SaaS
            </div>

            <div className="mt-8">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
              <h1
                className="mt-3 text-[clamp(2.25rem,5vw,4.6rem)] font-bold leading-[0.92] text-slate-950"
                style={displayFontStyle}
              >
                {title}
                <span className="block bg-gradient-to-r from-[#4f7cff] via-[#111827] to-[#14b8a6] bg-clip-text text-transparent">
                  {titleAccent}
                </span>
              </h1>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-500">{description}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${accentSoft}`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-5">
              {children}
            </div>

            {footer ? <div className="mt-5">{footer}</div> : null}
          </div>
        </section>

        <section className={`relative hidden min-h-[720px] overflow-hidden bg-gradient-to-br ${visualGradient} p-10 lg:block`}>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:88px_88px]" />
          <div
            className="absolute right-[-7rem] top-[-8rem] h-80 w-80 rounded-full blur-3xl"
            style={{ backgroundColor: `${accent}2b` }}
          />
          <div className="absolute bottom-[-7rem] left-[-5rem] h-72 w-72 rounded-full bg-teal-200/50 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="rounded-2xl border border-white/80 bg-white/78 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Workspace</p>
                <p className="mt-1 text-sm font-bold text-slate-900">Dispatch Cloud</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                {statusLabel}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -left-8 top-16 z-10 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ backgroundColor: accent }}>
                    <RadioTower className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Live queue</p>
                    <p className="text-lg font-bold text-slate-950">24 active</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-5 bottom-20 z-10 rounded-3xl border border-white/80 bg-slate-950 p-4 text-white shadow-[0_26px_70px_rgba(15,23,42,0.28)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Secure</p>
                    <p className="text-lg font-bold">Role based</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[34px] border border-white/80 bg-white/82 p-5 shadow-[0_34px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                <div className="rounded-[26px] bg-slate-950 p-4 text-white shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">SaaS overview</p>
                      <p className="mt-1 text-xl font-bold">Operations board</p>
                    </div>
                    <button className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-950" type="button">
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {visualMetrics.map(([value, label]) => (
                      <div key={label} className="rounded-2xl bg-white/[0.08] p-3">
                        <p className="text-xl font-bold">{value}</p>
                        <p className="mt-1 text-[11px] font-semibold text-white/45">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-3xl bg-white p-4 text-slate-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-5 w-5" style={{ color: accent }} />
                        <p className="font-bold">Today&apos;s flow</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Auto sync</span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {dashboardRows.map(([id, label, color]) => (
                        <div key={id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900">{id}</p>
                            <p className="text-xs font-semibold text-slate-400">{label}</p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-slate-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {['Smart intake', 'Team routing', 'Clean billing'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)] backdrop-blur">
                  <ClipboardList className="h-5 w-5" style={{ color: accent }} />
                  <p className="mt-3 text-sm font-bold text-slate-900">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
