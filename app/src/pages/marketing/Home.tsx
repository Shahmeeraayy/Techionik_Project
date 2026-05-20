import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  Wrench,
  X,
} from 'lucide-react';

const features = [
  {
    icon: LayoutDashboard,
    title: 'Admin Dashboard',
    description:
      'Control bookings, jobs, technicians, invoices, dealerships, services, reports, and settings from one clean dashboard.',
  },
  {
    icon: Smartphone,
    title: 'Technician Portal',
    description:
      'Technicians can view assigned jobs, update status, manage profiles, and communicate from a mobile-first portal.',
  },
  {
    icon: CalendarCheck,
    title: 'Online Booking Portal',
    description:
      'Customers can submit service requests online without manual calls, messages, or repeated follow-ups.',
  },
  {
    icon: ClipboardList,
    title: 'Job Management',
    description:
      'Track each job from intake to assignment, active work, completion, invoice approval, and full history.',
  },
  {
    icon: FileCheck,
    title: 'Invoice Approvals',
    description:
      'Review invoices, approve charges, maintain invoice records, and keep the billing workflow organized.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Insights',
    description:
      'Monitor technician productivity, job completion time, booking trends, and business performance.',
  },
];

const workflow = [
  'Customer submits a booking request',
  'Admin reviews and assigns the job',
  'Technician receives the job in portal',
  'Technician updates job status live',
  'Admin reviews invoice and reports',
];

const pricing = [
  {
    name: 'Starter',
    price: '$49',
    description: 'For small service teams starting with digital operations.',
    features: ['Booking portal', 'Admin dashboard', 'Basic job tracking', 'Technician access'],
  },
  {
    name: 'Professional',
    price: '$149',
    description: 'For growing businesses that need full operational control.',
    features: ['Advanced job tracking', 'Invoice approvals', 'Reports', 'Team communication'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For larger teams, multi-location businesses, and custom workflows.',
    features: ['Custom workflows', 'Multi-location support', 'Priority support', 'Advanced reporting'],
  },
];

const planGuarantees = [
  'Secure admin access',
  'Mobile technician workspace',
  'Booking-to-invoice workflow',
  'Customer booking portal',
];

type ChatMessage = {
  role: 'assistant' | 'user';
  text: string;
};

const starterPrompts = [
  'What does NexusOps do?',
  'Show pricing',
  'Book a demo',
];

const getAssistantReply = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('price') || normalized.includes('pricing') || normalized.includes('plan')) {
    return 'NexusOps starts with Starter at $49/month, Professional at $149/month, and Enterprise for custom workflows. You can compare the plans in the pricing section.';
  }

  if (normalized.includes('demo') || normalized.includes('book') || normalized.includes('start')) {
    return 'You can book a demo from the top button or the contact section. The demo flow opens the admin signup path so your team can get started.';
  }

  if (normalized.includes('technician') || normalized.includes('mobile')) {
    return 'Technicians get a mobile-first portal for assigned jobs, status updates, history, profile management, and team communication.';
  }

  if (normalized.includes('invoice') || normalized.includes('billing')) {
    return 'NexusOps supports invoice approvals, invoice history, manual invoice creation, and billing workflow control from the admin portal.';
  }

  if (normalized.includes('booking') || normalized.includes('customer')) {
    return 'Customers can submit booking requests through the public booking portal, then admins can review, assign, track, and invoice the work.';
  }

  return 'NexusOps brings booking, dispatch, technician work, invoices, chat, and reporting into one SaaS platform. Ask me about pricing, demo booking, technician tools, or invoices.';
};

function LandingChatbot() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Hi, I can help you explore NexusOps, pricing, demos, technician tools, and invoice workflows.',
    },
  ]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: getAssistantReply(trimmed) },
    ]);
    setDraft('');
    setOpen(true);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex max-w-[calc(100vw-2.5rem)] flex-col items-end gap-3">
      {open ? (
        <div className="w-[min(380px,calc(100vw-2.5rem))] overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-blue-950/40">
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-white">NexusOps Assistant</p>
                <p className="text-xs text-blue-50">Online for product questions</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/15"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[360px] space-y-3 overflow-y-auto bg-slate-950 px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-white text-slate-950'
                      : 'border border-white/10 bg-white/5 text-slate-200'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 bg-slate-900/90 px-4 py-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage(draft);
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
                placeholder="Ask about NexusOps..."
              />
              <button
                type="submit"
                aria-label="Send chat message"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Open NexusOps chat"
        className="group flex items-center gap-3 rounded-full border border-white/10 bg-white px-4 py-3 text-slate-950 shadow-2xl shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100"
        onClick={() => setOpen(true)}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white">
          <MessageSquare className="h-5 w-5" />
        </span>
        <span className="hidden pr-1 text-sm font-semibold sm:block">Chat with us</span>
      </button>
    </div>
  );
}

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/20">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">NexusOps</p>
              <p className="text-xs text-slate-400">Smart Service Management</p>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#workflow" className="hover:text-white">How It Works</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#contact" className="hover:text-white">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/login"
              className="hidden rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white md:block"
            >
              Login
            </Link>
            <Link
              to="/admin/signup"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Book Demo
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 py-20 md:py-28">
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                All-in-one SaaS for service operations
              </div>

              <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-white md:text-7xl">
                Manage bookings, technicians, jobs, and invoices in one platform.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                A modern SaaS platform for service-based businesses to handle customer bookings, technician assignments, job tracking, communication, approvals, and reports from one powerful dashboard.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/admin/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-6 py-4 font-semibold text-white shadow-xl shadow-blue-500/20 transition hover:-translate-y-0.5 hover:opacity-95"
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/book"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                >
                  View Live Demo
                </Link>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 text-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold">24/7</p>
                  <p className="mt-1 text-xs text-slate-400">Booking Access</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold">Live</p>
                  <p className="mt-1 text-xs text-slate-400">Job Tracking</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-bold">Smart</p>
                  <p className="mt-1 text-xs text-slate-400">Reports</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-slate-900 p-5">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">Today Overview</p>
                      <h3 className="text-2xl font-bold">Operations Dashboard</h3>
                    </div>
                    <div className="rounded-xl bg-green-400/10 px-3 py-2 text-sm font-semibold text-green-300">
                      Active
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-blue-500/15 p-5">
                      <CalendarCheck className="mb-4 h-6 w-6 text-blue-300" />
                      <p className="text-3xl font-bold">42</p>
                      <p className="text-sm text-slate-300">Bookings Today</p>
                    </div>
                    <div className="rounded-2xl bg-cyan-500/15 p-5">
                      <Users className="mb-4 h-6 w-6 text-cyan-300" />
                      <p className="text-3xl font-bold">18</p>
                      <p className="text-sm text-slate-300">Active Technicians</p>
                    </div>
                    <div className="rounded-2xl bg-purple-500/15 p-5">
                      <ClipboardList className="mb-4 h-6 w-6 text-purple-300" />
                      <p className="text-3xl font-bold">31</p>
                      <p className="text-sm text-slate-300">Jobs In Progress</p>
                    </div>
                    <div className="rounded-2xl bg-amber-500/15 p-5">
                      <FileCheck className="mb-4 h-6 w-6 text-amber-300" />
                      <p className="text-3xl font-bold">12</p>
                      <p className="text-sm text-slate-300">Pending Invoices</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="font-semibold">Live Technician Status</p>
                      <MapPin className="h-5 w-5 text-cyan-300" />
                    </div>
                    {['Available', 'Driving', 'On Site'].map((item, index) => (
                      <div key={item} className="mb-3 flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 last:mb-0">
                        <span className="text-sm text-slate-300">Technician {index + 1}</span>
                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">The Problem</p>
              <h2 className="mt-4 text-3xl font-bold md:text-5xl">Manual service operations slow your business down.</h2>
              <p className="mt-5 text-slate-300">
                Most businesses still manage requests, technician updates, job status, invoices, and customer communication manually. This creates missed bookings, delays, and poor visibility.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-4">
              {['Missed appointments', 'No live technician visibility', 'Manual job assignment', 'Scattered communication'].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-xl">
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
                    !
                  </div>
                  <h3 className="font-semibold">{item}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-white px-6 py-24 text-slate-950">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Product Features</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Everything your service team needs in one SaaS platform.</h2>
              <p className="mt-5 text-lg text-slate-600">
                Built for admins, technicians, and customers so the full service workflow stays connected from request to completion.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">How It Works</p>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">Simple workflow from booking to completion.</h2>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-5">
              {workflow.map((step, index) => (
                <div key={step} className="relative rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-bold">
                    {index + 1}
                  </div>
                  <p className="font-semibold leading-7">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-6 py-24 text-slate-950">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
            <div className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
              <LayoutDashboard className="mb-6 h-10 w-10 text-cyan-300" />
              <h3 className="text-2xl font-bold">Admin Portal</h3>
              <p className="mt-4 leading-7 text-slate-300">
                Manage operations, jobs, users, technicians, invoices, services, reports, and system settings from one central place.
              </p>
            </div>
            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <Smartphone className="mb-6 h-10 w-10 text-blue-600" />
              <h3 className="text-2xl font-bold">Technician Portal</h3>
              <p className="mt-4 leading-7 text-slate-600">
                Give technicians a mobile-first portal to view jobs, update progress, manage profiles, and stay connected.
              </p>
            </div>
            <div className="rounded-3xl bg-white p-8 shadow-xl">
              <CalendarCheck className="mb-6 h-10 w-10 text-blue-600" />
              <h3 className="text-2xl font-bold">Customer Booking</h3>
              <p className="mt-4 leading-7 text-slate-600">
                Let customers request services through a simple public booking form connected directly to your admin workflow.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white px-6 py-24 text-slate-950">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Pricing</p>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">Flexible plans for every service business.</h2>
              <p className="mt-5 text-slate-600">Start small, then scale your platform as your operations grow.</p>
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {pricing.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-3xl border p-8 shadow-sm ${
                    plan.highlighted
                      ? 'border-blue-500 bg-slate-950 text-white shadow-2xl shadow-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-950'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="mb-5 inline-flex rounded-full bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-200">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <div className="mt-5 flex items-end gap-2">
                    <p className="text-5xl font-bold">{plan.price}</p>
                    {plan.price !== 'Custom' && <span className="mb-2 text-slate-400">/month</span>}
                  </div>
                  <p className={`mt-4 leading-7 ${plan.highlighted ? 'text-slate-300' : 'text-slate-600'}`}>{plan.description}</p>
                  <div className="mt-8 space-y-4">
                    {plan.features.map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <CheckCircle2 className={`h-5 w-5 ${plan.highlighted ? 'text-cyan-300' : 'text-blue-600'}`} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/admin/signup"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 font-semibold transition hover:-translate-y-0.5 ${plan.highlighted ? 'bg-white text-slate-950' : 'bg-slate-950 text-white'}`}
                  >
                    Contact Sales
                  </Link>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="grid gap-4 md:grid-cols-4">
                {planGuarantees.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="px-6 py-24">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-600 to-cyan-500 p-10 text-center shadow-2xl md:p-16">
            <MessageSquare className="mx-auto mb-6 h-12 w-12" />
            <h2 className="text-4xl font-bold md:text-5xl">Ready to manage your service operations smarter?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-blue-50">
              Launch a professional platform for bookings, technicians, jobs, invoices, communication, and reporting.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                to="/admin/signup"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Book a Demo
              </Link>
              <a
                href="mailto:sales@nexusops.com"
                className="inline-flex items-center justify-center rounded-2xl border border-white/30 px-7 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Contact Us
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 text-sm text-slate-400 md:flex-row">
          <p>&copy; 2026 NexusOps. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <a href="#contact" className="hover:text-white">Contact</a>
            <Link to="/admin/login" className="hover:text-white">Login</Link>
          </div>
        </div>
      </footer>

      <LandingChatbot />
    </div>
  );
}
