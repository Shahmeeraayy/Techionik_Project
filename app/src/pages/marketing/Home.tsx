import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Gauge,
  MapPin,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';

const proofMetrics = [
  { label: 'Live job routing', value: '24/7' },
  { label: 'Invoice approvals', value: '2x' },
  { label: 'Field visibility', value: '100%' },
  { label: 'Admin control', value: '1 hub' },
];

const workflowCards = [
  {
    title: 'Dispatch intelligence',
    description: 'Create, rank, assign, and monitor work orders from a single operational command center.',
    icon: ClipboardList,
  },
  {
    title: 'Technician execution',
    description: 'Give field teams a focused mobile workspace for assignments, current jobs, history, and chat.',
    icon: Wrench,
  },
  {
    title: 'Invoice governance',
    description: 'Keep approvals, invoice history, pricing, and job evidence inside one auditable workflow.',
    icon: FileCheck2,
  },
];

const features = [
  'Live technician capacity',
  'Dealership coverage control',
  'Priority and urgency signals',
  'Admin approval queues',
  'Field-ready mobile experience',
  'Operational reporting',
];

export default function MarketingHome() {
  return (
    <main className="marketing-site min-h-screen overflow-hidden bg-[#05070b] text-white">
      <section className="marketing-hero relative min-h-[100svh]">
        <div className="marketing-aurora" />
        <div className="marketing-grid" />
        <nav className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
          <Link to="/" className="group inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
              <ShieldCheck className="h-5 w-5 text-cyan-100" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.02em] text-white">NexusOps</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Dispatch OS</span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] p-1 text-sm text-slate-300 backdrop-blur-xl md:flex">
            <a href="#platform" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.08] hover:text-white">Platform</a>
            <a href="#workflow" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.08] hover:text-white">Workflow</a>
            <a href="#proof" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.08] hover:text-white">Results</a>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/tech/login"
              className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white sm:inline-flex"
            >
              Tech Login
            </Link>
            <Link
              to="/admin/login"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_18px_44px_rgba(255,255,255,0.13)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(34,211,238,0.18)]"
            >
              Admin Portal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
          <div className="premium-reveal max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Sparkles className="h-3.5 w-3.5" />
              Premium field dispatch platform
            </div>
            <h1 className="mt-6 max-w-5xl text-[clamp(3rem,8vw,7.45rem)] font-semibold leading-[0.88] tracking-[-0.055em] text-white">
              Field service
              <span className="block bg-gradient-to-r from-white via-cyan-100 to-[#8fb1ff] bg-clip-text text-transparent">
                without the drift.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              SM2 brings jobs, technicians, dealership coverage, invoice approvals, and live operational decisions into one cinematic control workspace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/admin/login"
                className="premium-button group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4f7cff] to-[#22d3ee] px-6 text-base font-semibold text-white shadow-[0_22px_58px_rgba(79,124,255,0.28)]"
              >
                Enter Admin Portal
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/tech/login"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-6 text-base font-semibold text-white backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.09]"
              >
                Technician Access
              </Link>
            </div>

            <div id="proof" className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {proofMetrics.map((metric) => (
                <div key={metric.label} className="rounded-[22px] border border-white/10 bg-white/[0.045] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                  <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{metric.value}</div>
                  <div className="mt-1 text-xs font-medium leading-5 text-slate-400">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-reveal relative mx-auto w-full max-w-[640px] lg:ml-auto">
            <div className="absolute -inset-8 rounded-[48px] bg-cyan-400/10 blur-3xl" />
            <div className="dashboard-preview relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,23,40,0.96),rgba(6,10,18,0.98))] p-4 shadow-[0_44px_140px_rgba(0,0,0,0.48)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">Operations Pulse</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">Live dispatch board</h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
                    Live
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    ['Jobs', '48', ClipboardList],
                    ['Techs', '12', Users],
                    ['Approvals', '09', FileCheck2],
                  ].map(([label, value, Icon]) => (
                    <div key={label as string} className="rounded-[20px] border border-white/10 bg-slate-950/55 p-4">
                      <Icon className="h-4 w-4 text-cyan-100" />
                      <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">{value as string}</div>
                      <div className="mt-1 text-xs text-slate-500">{label as string}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    ['SM2-2048', 'Windshield calibration', 'High', 'text-amber-100 border-amber-300/20 bg-amber-300/10'],
                    ['SM2-2049', 'Camera service', 'Ready', 'text-emerald-100 border-emerald-300/20 bg-emerald-300/10'],
                    ['SM2-2050', 'Diagnostic intake', 'Review', 'text-cyan-100 border-cyan-300/20 bg-cyan-300/10'],
                  ].map(([code, name, status, tone]) => (
                    <div key={code} className="flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-white/[0.035] px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{code}</p>
                        <p className="truncate text-sm text-slate-400">{name}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="relative border-y border-white/10 bg-[#080c14] px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/70">Designed for operational confidence</p>
            <h2 className="mt-4 text-[clamp(2.2rem,5vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-white">
              Every screen earns its place.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {workflowCards.map((card) => (
              <article key={card.title} className="premium-card group">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  <card.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-[-0.04em] text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative bg-[#05070b] px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/70">Command workflow</p>
            <h2 className="mt-4 text-[clamp(2.1rem,4.5vw,4rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
              From intake to invoice, the motion is controlled.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-400">
              The interface is built around what high-performing service teams need to decide quickly: status, urgency, owner, evidence, and next action.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature, index) => (
              <div key={feature} className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-950">
                  {index % 3 === 0 ? <Zap className="h-4 w-4" /> : index % 3 === 1 ? <Gauge className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </div>
                <span className="text-sm font-semibold text-slate-100">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#080c14] px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">NexusOps</p>
            <p className="mt-1 text-sm text-slate-500">Premium dispatch operations for modern field service teams.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/login" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] hover:text-white">
              Admin Login <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/tech/login" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] hover:text-white">
              Field Portal <MapPin className="h-4 w-4" />
            </Link>
            <Link to="/admin" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.06] hover:text-white">
              Dashboard <BarChart3 className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

