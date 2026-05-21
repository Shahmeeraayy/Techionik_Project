import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Send,
  Settings,
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

const demoScreens = [
  {
    module: 'overview',
    label: 'Overview',
    title: 'Daily operations command center',
    description:
      'The first screen gives leadership a live pulse of bookings, jobs, active technicians, approvals, and revenue without jumping between tools.',
    icon: LayoutDashboard,
    cards: [
      ['Open jobs', '48', '+12% today'],
      ['Active techs', '18', '6 currently on site'],
      ['Pending invoices', '12', '$8.4k queue value'],
    ],
    rows: ['Morning dispatch summary ready', 'Technician capacity updated', 'Approval queue needs review'],
    action: 'Provides managers with a single operational view of bookings, technician capacity, job progress, invoice health, and urgent actions before the workday begins.',
  },
  {
    module: 'jobs',
    label: 'Jobs',
    title: 'Jobs and dispatch board',
    description:
      'Jobs is where dispatch happens. Admins review requests, assign technicians, track priority, and move work through the live workflow.',
    icon: ClipboardList,
    cards: [
      ['Ready to assign', '14', '4 urgent'],
      ['In progress', '31', 'live status'],
      ['Completed today', '22', 'ready for billing'],
    ],
    rows: ['NXS-2048 windshield calibration assigned', 'NXS-2049 camera service in progress', 'NXS-2050 diagnostic intake ready'],
    action: 'Admin clicks a job, assigns a technician, and watches the status update live.',
  },
  {
    module: 'technicians',
    label: 'Technicians',
    title: 'Technician workforce control',
    description:
      'Technicians shows profiles, availability, skill coverage, assigned work, performance, and real-time field status.',
    icon: Users,
    cards: [
      ['Available', '9', 'ready for jobs'],
      ['On site', '6', 'live work'],
      ['Off duty', '3', 'scheduled'],
    ],
    rows: ['Alex Morgan available in North zone', 'Priya Shah on site for NXS-2048', 'Jordan Lee finished last job'],
    action: 'Admin filters by zone or skill, previews a technician, and assigns the best match.',
  },
  {
    module: 'chat',
    label: 'Platform Chat',
    title: 'Real-time team messaging',
    description:
      'Platform Chat gives admins and technicians a shared workspace for job questions, status context, unread messages, and fast decisions.',
    icon: MessageSquare,
    cards: [
      ['Unread', '6', '2 urgent'],
      ['Active threads', '14', 'today'],
      ['Avg response', '3m', 'team median'],
    ],
    rows: ['Priya sent job photos', 'Alex needs parts approval', 'Jordan confirmed arrival'],
    action: 'Admin opens a conversation, reviews job context, replies, and keeps the thread attached to operations.',
  },
  {
    module: 'accounts',
    label: 'Accounts',
    title: 'Account and access management',
    description:
      'Accounts lets admins create technician logins, send invite emails, reset passwords, and control access from one secure screen.',
    icon: ShieldCheck,
    cards: [
      ['Active accounts', '18', 'all verified'],
      ['Pending invites', '3', 'email ready'],
      ['Reset requests', '2', 'needs admin'],
    ],
    rows: ['Create technician account', 'Send temporary password email', 'Approve password reset request'],
    action: 'Admin creates or updates accounts without leaving the operations portal.',
  },
  {
    module: 'invoices',
    label: 'Invoices',
    title: 'Invoice approvals and billing',
    description:
      'Invoices gives finance a focused surface for approval queues, payment status, manual invoice creation, and customer billing actions.',
    icon: FileCheck,
    cards: [
      ['Pending approval', '12', '$8.4k value'],
      ['Sent invoices', '31', 'awaiting payment'],
      ['Paid this week', '$18.2k', 'collected'],
    ],
    rows: ['NXS-2048 ready for approval', 'Manual invoice draft created', 'Payment marked received'],
    action: 'Admin reviews invoice details, fixes blockers, creates invoices, and sends them to customers.',
  },
  {
    module: 'services',
    label: 'Services',
    title: 'Service catalog and pricing',
    description:
      'Services keeps the catalog, pricing, approval rules, and billable items organized so invoices stay consistent.',
    icon: Wrench,
    cards: [
      ['Catalog items', '96', 'active'],
      ['Approval rules', '8', 'controlled'],
      ['Avg service', '$320', 'tracked'],
    ],
    rows: ['Windshield calibration updated', 'Camera service price reviewed', 'PPF package marked active'],
    action: 'Admin edits service pricing once, then uses those values throughout jobs and invoices.',
  },
  {
    module: 'locations',
    label: 'Locations',
    title: 'Location coverage network',
    description:
      'Locations shows partner stores, addresses, service coverage, active jobs, and contact details for each operating area.',
    icon: Building2,
    cards: [
      ['Active locations', '24', 'partner stores'],
      ['Covered zones', '8', 'service regions'],
      ['Jobs on site', '17', 'today'],
    ],
    rows: ['North Ford has 4 active jobs', 'Downtown Honda coverage confirmed', 'Westside Auto contact updated'],
    action: 'Admin checks coverage, reviews location activity, and routes jobs to the correct store or zone.',
  },
  {
    module: 'attendance',
    label: 'Attendance',
    title: 'Attendance and field schedule',
    description:
      'Attendance gives managers a daily view of technician check-ins, availability, absences, and field coverage.',
    icon: CalendarCheck,
    cards: [
      ['Checked in', '15', 'today'],
      ['Late', '1', 'needs review'],
      ['Time off', '2', 'approved'],
    ],
    rows: ['Morning check-in complete', 'North zone coverage confirmed', 'Time-off request approved'],
    action: 'Admin confirms who is available before assigning jobs for the day.',
  },
  {
    module: 'reports',
    label: 'Reports',
    title: 'Reports and business insight',
    description:
      'Reports turn job volume, technician productivity, invoice performance, and blocker trends into clear business decisions.',
    icon: BarChart3,
    cards: [
      ['Completion rate', '94%', 'this week'],
      ['Invoice value', '$42k', 'month to date'],
      ['Avg turnaround', '2.1h', 'improving'],
    ],
    rows: ['Technician productivity report', 'Invoice performance report', 'Blocked reason analysis'],
    action: 'Leadership can see what is working, where jobs slow down, and which teams need support.',
  },
  {
    module: 'settings',
    label: 'Settings',
    title: 'Configuration and preferences',
    description:
      'Settings is where admins manage company profile, invoice branding, notifications, workflow preferences, and system controls.',
    icon: Settings,
    cards: [
      ['Branding', 'Ready', 'invoice profile'],
      ['Notifications', '7 rules', 'enabled'],
      ['Workflow', 'Auto', 'dispatch rules'],
    ],
    rows: ['Invoice branding saved', 'Notification preferences updated', 'Priority rules configured'],
    action: 'Admin changes preferences, saves settings, and keeps the platform aligned with business operations.',
  },
];

const demoModuleDetails: Record<string, { benefits: string[]; workflow: string }> = {
  overview: {
    benefits: ['Executive visibility across the operation', 'Faster prioritization of urgent work', 'One place to monitor jobs, teams, and billing health'],
    workflow: 'A manager starts the day on Overview, reviews operational health, identifies bottlenecks, then opens the module that needs action.',
  },
  jobs: {
    benefits: ['Centralized dispatch queue', 'Clear ownership for every job', 'Priority and status control from intake to completion'],
    workflow: 'A dispatcher reviews a new job, assigns the right technician, tracks live progress, and moves completed work toward billing.',
  },
  technicians: {
    benefits: ['Real-time field availability', 'Skill-based technician matching', 'Performance and activity visibility'],
    workflow: 'An admin filters technicians by zone, confirms availability and skills, then assigns the best person for the job.',
  },
  chat: {
    benefits: ['Faster field decisions', 'Job conversations kept in context', 'Unread states for urgent technician updates'],
    workflow: 'A technician sends a question with job context, the admin replies, and the decision stays attached to the operational workflow.',
  },
  accounts: {
    benefits: ['Controlled technician access', 'Simplified invites and password resets', 'Cleaner onboarding for field teams'],
    workflow: 'An admin creates a technician account, sends credentials, and handles access changes without IT handoffs.',
  },
  invoices: {
    benefits: ['Faster invoice approval', 'Clear payment and sending status', 'Manual invoice creation when needed'],
    workflow: 'Finance reviews completed work, approves or edits invoice lines, creates the invoice, and sends it to the right recipient.',
  },
  services: {
    benefits: ['Consistent service pricing', 'Organized catalog management', 'Cleaner billing and approval rules'],
    workflow: 'Operations updates service rates and categories once, then the catalog feeds job estimates and invoice line items.',
  },
  locations: {
    benefits: ['Service coverage by store or zone', 'Location-specific job visibility', 'Accurate contact and address context'],
    workflow: 'Admin checks active jobs by location, confirms coverage, and routes new requests to the right service area.',
  },
  attendance: {
    benefits: ['Daily workforce readiness', 'Clear time-off and late status', 'Better dispatch planning before assignments'],
    workflow: 'A manager confirms who is checked in, reviews exceptions, and assigns work based on real availability.',
  },
  reports: {
    benefits: ['Operational performance trends', 'Invoice and revenue visibility', 'Exportable reports for leadership'],
    workflow: 'Leadership reviews completion rates, revenue trends, and blocker patterns, then exports reports for planning.',
  },
  settings: {
    benefits: ['Configurable workflow preferences', 'Consistent invoice branding', 'Notification and rule control'],
    workflow: 'An owner updates business preferences, saves notification rules, and keeps the platform aligned with company standards.',
  },
};

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
    return 'Click Book Demo or View Live Demo to open a guided NexusOps walkthrough. It shows the full flow from booking to invoice and reporting.';
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

function DemoModulePreview({ screen }: { screen: typeof demoScreens[number] }) {
  const metricCards = (
    <div className="grid gap-4 sm:grid-cols-3">
      {screen.cards.map(([label, value, note]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-500">{label}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
            <p className="text-2xl font-bold">{value}</p>
            <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{note}</span>
          </div>
        </div>
      ))}
    </div>
  );

  if (screen.module === 'reports') {
    return (
      <div className="space-y-5">
        {metricCards}
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Revenue and job trend</p>
              <button className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-950">Export PDF</button>
            </div>
            <div className="mt-6 flex h-52 items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              {[72, 104, 88, 132, 118, 154, 168].map((height, index) => (
                <div key={`${height}-${index}`} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <div className="relative flex flex-1 items-end">
                    <div
                      className="w-full rounded-t-2xl bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.22)]"
                      style={{ height: `${height}px` }}
                    />
                  </div>
                  <span className="text-center text-[10px] text-slate-500">D{index + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="font-semibold">Report summary</p>
            {['Completion rate up 12%', 'Invoices collected faster', 'North zone has most demand'].map((item) => (
              <div key={item} className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen.module === 'overview') {
    return (
      <div className="space-y-5">
        {metricCards}
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Today at a glance</p>
                <p className="mt-1 text-xs text-slate-500">Bookings, dispatch load, and invoice readiness</p>
              </div>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">92% on track</span>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-[1fr_0.8fr]">
              <div className="flex h-40 items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                {[42, 58, 50, 76, 66, 92, 108].map((height, index) => (
                  <div key={`${height}-${index}`} className="flex h-full flex-1 flex-col justify-end gap-2">
                    <div className="relative flex flex-1 items-end">
                      <div
                        className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.2)]"
                        style={{ height: `${height}px` }}
                      />
                    </div>
                    <span className="text-center text-[10px] text-slate-500">{['7a', '9a', '11a', '1p', '3p', '5p', '7p'][index]}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  ['Technician capacity', '78%'],
                  ['Job completion', '92%'],
                  ['Invoice readiness', '64%'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-semibold text-cyan-100">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10">
                      <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" style={{ width: value }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="font-semibold">Priority signals</p>
            <div className="mt-5 space-y-3">
              {[
                ['3 urgent items', 'Dispatch review needed'],
                ['2 invoice blockers', 'Missing billing details'],
                ['6 techs on site', 'Field coverage healthy'],
              ].map(([label, note]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-xs text-slate-400">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen.module === 'chat') {
    return (
      <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          {[
            ['Priya Shah', 'Sent photos from NXS-2048', '2'],
            ['Alex Morgan', 'Need approval for parts', '1'],
            ['Jordan Lee', 'Arrived at Downtown Honda', ''],
          ].map(([name, preview, unread]) => (
            <div key={name} className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-slate-400">{preview}</p>
              </div>
              {unread ? <span className="rounded-full bg-cyan-400 px-2 py-1 text-xs font-bold text-slate-950">{unread}</span> : null}
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="border-b border-white/10 pb-3">
            <p className="font-semibold">Priya Shah</p>
            <p className="text-xs text-emerald-300">Online - Job NXS-2048</p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="max-w-[78%] rounded-2xl bg-white/10 p-3 text-sm text-slate-200">Calibration photos uploaded. Can you approve the added labor line?</div>
            <div className="ml-auto max-w-[78%] rounded-2xl bg-white p-3 text-sm text-slate-950">Approved. Please complete the job and attach final notes.</div>
            <div className="max-w-[78%] rounded-2xl bg-white/10 p-3 text-sm text-slate-200">Done, status changed to completed.</div>
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 p-2">
            <span className="flex-1 px-3 text-sm text-slate-500">Type a message...</span>
            <button className="rounded-xl bg-cyan-300 px-3 py-2 text-xs font-bold text-slate-950">Send</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen.module === 'jobs') {
    return (
      <div className="space-y-5">
        {metricCards}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {[
            ['NXS-2048', 'Windshield calibration', 'Priya Shah', 'High', 'In progress'],
            ['NXS-2049', 'Camera service', 'Alex Morgan', 'Medium', 'Assigned'],
            ['NXS-2050', 'Diagnostic intake', 'Unassigned', 'Critical', 'Review'],
          ].map(([id, job, tech, priority, status]) => (
            <div key={id} className="grid gap-3 border-b border-white/10 p-4 text-sm last:border-b-0 md:grid-cols-[0.8fr_1.4fr_1fr_0.8fr_0.9fr]">
              <span className="font-bold text-white">{id}</span>
              <span className="text-slate-300">{job}</span>
              <span className="text-slate-400">{tech}</span>
              <span className="rounded-full bg-amber-300/10 px-3 py-1 text-center text-xs font-semibold text-amber-200">{priority}</span>
              <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-center text-xs font-semibold text-cyan-100">{status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (screen.module === 'settings') {
    return (
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          {['Company profile', 'Invoice branding', 'Notifications', 'Workflow rules'].map((tab, index) => (
            <div key={tab} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${index === 1 ? 'bg-white text-slate-950' : 'text-slate-300'}`}>{tab}</div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="font-semibold">Invoice branding</p>
          <div className="mt-4 grid gap-3">
            {['Company name', 'Billing email', 'Default payment terms'].map((label) => (
              <div key={label}>
                <p className="mb-1 text-xs text-slate-500">{label}</p>
                <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-slate-300">{label === 'Company name' ? 'NexusOps Dispatch' : label === 'Billing email' ? 'billing@nexusops.com' : 'Net 15'}</div>
              </div>
            ))}
            {['Send invoice notifications', 'Auto-rank urgent jobs'].map((label) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-3 text-sm">
                {label}
                <span className="h-6 w-11 rounded-full bg-cyan-300 p-1"><span className="block h-4 w-4 translate-x-5 rounded-full bg-slate-950" /></span>
              </div>
            ))}
          </div>
          <button className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950">Save changes</button>
        </div>
      </div>
    );
  }

  if (screen.module === 'technicians') {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ['Priya Shah', 'On site', 'ADAS, Diagnostics', '4.9', 'NXS-2048'],
          ['Alex Morgan', 'Available', 'Calibration, Glass', '4.8', 'Ready'],
          ['Jordan Lee', 'Driving', 'PPF, Camera Service', '4.7', 'NXS-2051'],
        ].map(([name, status, skills, score, job]) => (
          <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950 font-bold">{name.split(' ').map((part) => part[0]).join('')}</div>
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-xs text-cyan-200">{status}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400">{skills}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-500">Rating</p><p className="font-bold">{score}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-500">Job</p><p className="font-bold">{job}</p></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (screen.module === 'invoices') {
    return (
      <div className="space-y-5">
        {metricCards}
        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            {['Pending approval', 'Sent', 'Paid'].map((status, index) => (
              <div key={status} className="mb-3 flex items-center justify-between rounded-2xl bg-white/5 p-3 last:mb-0">
                <div><p className="font-semibold">INV-10{index + 31}</p><p className="text-xs text-slate-400">Downtown Honda - ${[840, 1260, 520][index]}.00</p></div>
                <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">{status}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="font-semibold">Billing actions</p>
            {['Create manual invoice', 'Send email', 'Mark paid', 'Download PDF'].map((item) => <button key={item} className="mt-3 w-full rounded-xl bg-white/5 px-3 py-3 text-left text-sm text-slate-200">{item}</button>)}
          </div>
        </div>
      </div>
    );
  }

  if (screen.module === 'services') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['Calibration', 'Windshield calibration', '$240', '90 min', 'Active'],
          ['Diagnostics', 'Camera diagnostic', '$180', '60 min', 'Active'],
          ['PPF', 'Front bumper package', '$325', '2 hr', 'Inactive'],
          ['Glass', 'Sensor inspection', '$95', '30 min', 'Active'],
        ].map(([cat, name, rate, duration, status]) => (
          <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">{cat}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === 'Active' ? 'bg-emerald-400/10 text-emerald-200' : 'bg-slate-400/10 text-slate-300'}`}>{status}</span>
            </div>
            <p className="mt-4 font-semibold">{name}</p>
            <div className="mt-4 flex gap-3 text-sm text-slate-400"><span>{rate}</span><span>{duration}</span></div>
          </div>
        ))}
      </div>
    );
  }

  if (screen.module === 'locations') {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ['North Ford', '1420 Ridge Ave', '4 active jobs', 'North zone'],
          ['Downtown Honda', '88 Market St', '7 active jobs', 'Central zone'],
          ['Westside Auto', '501 Lake Road', '2 active jobs', 'West zone'],
        ].map(([name, address, jobs, zone]) => (
          <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <Building2 className="h-6 w-6 text-cyan-200" />
            <p className="mt-4 font-semibold">{name}</p>
            <p className="mt-1 text-sm text-slate-400">{address}</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-xl bg-white/5 p-3">{jobs}</div>
              <div className="rounded-xl bg-white/5 p-3">{zone}</div>
              <div className="rounded-xl bg-white/5 p-3">Service coverage confirmed</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (screen.module === 'attendance') {
    return (
      <div className="space-y-5">
        {metricCards}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          {['Priya Shah checked in 8:05 AM', 'Alex Morgan available 8:12 AM', 'Jordan Lee driving to first job', 'Mia Chen time off approved'].map((item) => (
            <div key={item} className="mb-3 flex items-center justify-between rounded-2xl bg-white/5 p-3 last:mb-0">
              <span className="text-sm text-slate-200">{item}</span>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">Logged</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <div className="space-y-5">{metricCards}</div>;
}

function DemoWalkthrough({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!open) return null;

  const activeScreen = demoScreens[activeIndex];
  const Icon = activeScreen.icon;
  const isLastScreen = activeIndex === demoScreens.length - 1;
  const moduleDetails = demoModuleDetails[activeScreen.module];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/85 px-4 py-6 backdrop-blur-xl">
      <div className="mx-auto flex min-h-full max-w-7xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl shadow-blue-950/50">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Interactive SaaS demo</p>
              <h2 className="text-2xl font-bold tracking-tight">Explore how NexusOps manages daily service operations</h2>
            </div>
            <button
              type="button"
              aria-label="Close demo walkthrough"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid min-h-[680px] lg:grid-cols-[260px_1fr_320px]">
            <aside className="border-b border-white/10 bg-black/40 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-5 flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-950">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold">NexusOps</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Demo Center</p>
                </div>
              </div>

              <div className="grid gap-2">
                {demoScreens.map((screen, index) => {
                  const ScreenIcon = screen.icon;
                  const active = index === activeIndex;
                  return (
                  <button
                    key={screen.label}
                    type="button"
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      active
                        ? 'bg-white text-slate-950 shadow-xl shadow-white/10'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => setActiveIndex(index)}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-slate-950 text-white' : 'bg-white/5 text-cyan-200'}`}>
                      <ScreenIcon className="h-4 w-4" />
                    </span>
                    {screen.label}
                  </button>
                  );
                })}
              </div>
            </aside>

            <section className="bg-slate-900 p-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950 p-5 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin workspace</p>
                    <h3 className="mt-2 text-2xl font-bold">{activeScreen.label}</h3>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-right">
                    <Icon className="ml-auto h-5 w-5 text-cyan-100" />
                    <p className="mt-1 text-xs text-cyan-200">Interactive Workspace</p>
                  </div>
                </div>

                <div className="mt-5">
                  <DemoModulePreview screen={activeScreen} />
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-r from-blue-600/20 to-cyan-400/15 p-5">
                  <p className="text-sm font-semibold text-white">Module Purpose</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{activeScreen.action}</p>
                </div>
              </div>
            </section>

            <aside className="border-t border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_30%),#020617] p-5 lg:border-l lg:border-t-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                <Icon className="h-4 w-4" />
                Module overview
              </div>
              <h3 className="mt-5 text-3xl font-bold tracking-tight">{activeScreen.label}</h3>
              <p className="mt-2 text-sm font-semibold text-cyan-100">{activeScreen.title}</p>
              <p className="mt-4 text-sm leading-7 text-slate-300">{activeScreen.description}</p>

              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Key Benefits</p>
                  <div className="mt-4 space-y-3">
                    {moduleDetails.benefits.map((benefit) => (
                      <div key={benefit} className="flex gap-3 text-sm leading-6 text-slate-200">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">Example Workflow</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{moduleDetails.workflow}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {isLastScreen ? (
                  <Link
                    to="/admin/signup"
                    className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
                  >
                    Start setup
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-5 font-semibold text-white shadow-xl shadow-blue-500/20 transition hover:-translate-y-0.5"
                  onClick={() => {
                    if (isLastScreen) {
                      onClose();
                      return;
                    }
                    setActiveIndex((current) => Math.min(demoScreens.length - 1, current + 1));
                  }}
                >
                  {isLastScreen ? 'Finish demo' : 'Next screen'}
                  {!isLastScreen ? <ChevronRight className="h-4 w-4" /> : null}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketingHome() {
  const [demoOpen, setDemoOpen] = useState(false);

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
            <button
              type="button"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
              onClick={() => setDemoOpen(true)}
            >
              Book Demo
            </button>
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
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  onClick={() => setDemoOpen(true)}
                >
                  View Live Demo
                </button>
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
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-slate-100"
                onClick={() => setDemoOpen(true)}
              >
                Book a Demo
              </button>
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
      <DemoWalkthrough open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
}
