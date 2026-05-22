import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronDown,
  Clock3, Mail, Phone, Search, Settings, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  fetchBookingPortalPublicConfig,
  lookupBookingPortalStatus,
  submitBookingPortalRequest,
  type BackendBookingPortalPublicConfig,
  type BackendBookingPortalStatusLookupResponse,
} from '@/lib/backend-api';
import { formatUsPhoneInput } from '@/lib/phone';

type BookingFormState = {
  customerName: string;
  phoneNumber: string;
  emailAddress: string;
  serviceLocationAddress: string;
  serviceLocationCity: string;
  serviceLocationState: string;
  serviceLocationZipCode: string;
  serviceIds: string[];
  assetDetails: string;
  preferredDate: string;
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'no_preference';
  additionalNotes: string;
};

const initialFormState: BookingFormState = {
  customerName: '',
  phoneNumber: '',
  emailAddress: '',
  serviceLocationAddress: '',
  serviceLocationCity: '',
  serviceLocationState: '',
  serviceLocationZipCode: '',
  serviceIds: [],
  assetDetails: '',
  preferredDate: '',
  preferredTimeOfDay: 'afternoon',
  additionalNotes: '',
};

const inputCls = 'h-[52px] rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.97),rgba(8,14,26,0.97))] text-white placeholder:text-slate-500 focus-visible:ring-[1px] focus-visible:ring-cyan-400/40 focus-visible:bg-[linear-gradient(180deg,rgba(10,18,32,0.99),rgba(8,14,26,0.99))] focus-visible:border-cyan-400/30';
const textareaCls = 'rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.97),rgba(8,14,26,0.97))] text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-cyan-400/40';
const selectContentCls = 'border-white/10 bg-[rgba(11,25,42,0.98)] text-white';
const primaryBtnCls = 'h-[52px] w-full rounded-xl bg-gradient-to-r from-[#4f7cff] to-[#22d3ee] text-base font-semibold text-white shadow-[0_8px_24px_rgba(79,124,255,0.28)] hover:brightness-110 transition-all';
const secondaryBtnCls = 'border-white/10 bg-[linear-gradient(180deg,rgba(12,20,34,0.95),rgba(8,14,26,0.95))] text-slate-200 hover:bg-[linear-gradient(180deg,rgba(23,37,64,0.98),rgba(15,24,44,0.98))] hover:text-white rounded-xl';

function inferTenantSlugFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname.toLowerCase();
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length < 3) return null;
  const [subdomain] = parts;
  if (['www', 'app', 'admin', 'api', 'book'].includes(subdomain)) return null;
  if (hostname.endsWith('.nexusops.app')) return subdomain;
  return null;
}

export default function BookingPortalPage() {
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const isStatusMode = location.pathname.endsWith('/status');
  const [config, setConfig] = useState<BackendBookingPortalPublicConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [form, setForm] = useState<BookingFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [successReference, setSuccessReference] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupReference, setLookupReference] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<BackendBookingPortalStatusLookupResponse | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const normalizedTenantSlug = tenantSlug?.trim().toLowerCase() || inferTenantSlugFromHost();
  const bookingPath = normalizedTenantSlug ? `/book/${normalizedTenantSlug}` : '/book';
  const statusPath = normalizedTenantSlug ? `/book/${normalizedTenantSlug}/status` : '/book/status';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get('reference') ?? '';
    const email = params.get('email') ?? '';
    if (reference) setLookupReference(reference.toUpperCase());
    if (email) setLookupEmail(email.toLowerCase());
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const next = await fetchBookingPortalPublicConfig(normalizedTenantSlug);
        if (!isMounted) return;
        setConfig(next);
        setForm((prev) => ({
          ...prev,
          serviceIds: prev.serviceIds.length > 0 ? prev.serviceIds : (next.services[0]?.id ? [next.services[0].id] : []),
        }));
      } catch (error) {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Unable to load booking portal.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [normalizedTenantSlug]);

  const detailsLabel = config?.details_field_label ?? 'Vehicle details';
  const selectedServiceNames = useMemo(() => {
    if (!config) return [];
    const serviceMap = new Map(config.services.map((s) => [s.id, s.name]));
    return form.serviceIds.map((id) => serviceMap.get(id)).filter((v): v is string => Boolean(v));
  }, [config, form.serviceIds]);

  const selectedServiceSummary = useMemo(() => {
    if (selectedServiceNames.length === 0) return 'Select one or more services';
    if (selectedServiceNames.length === 1) return selectedServiceNames[0];
    if (selectedServiceNames.length === 2) return `${selectedServiceNames[0]}, ${selectedServiceNames[1]}`;
    return `${selectedServiceNames[0]}, ${selectedServiceNames[1]} +${selectedServiceNames.length - 2} more`;
  }, [selectedServiceNames]);

  const statusLabel = lookupResult?.status ?? null;
  const estimatedCompletionLabel = useMemo(() => {
    if (!lookupResult?.estimated_completion_date) return null;
    const parsed = new Date(lookupResult.estimated_completion_date);
    return Number.isNaN(parsed.getTime()) ? lookupResult.estimated_completion_date : parsed.toLocaleDateString();
  }, [lookupResult]);

  const validateBookingForm = () => {
    if (!form.customerName.trim()) return 'Customer full name is required.';
    if (form.phoneNumber.replace(/\D/g, '').length < 10) return 'Enter a valid phone number.';
    if (!/\S+@\S+\.\S+/.test(form.emailAddress.trim())) return 'Enter a valid email address.';
    if (!form.serviceLocationAddress.trim()) return 'Service location is required.';
    if (form.serviceIds.length === 0) return 'Select at least one service type.';
    if (!form.assetDetails.trim()) return `${detailsLabel} is required.`;
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setErrorMessage(null);
    const validationError = validateBookingForm();
    if (validationError) { setFormError(validationError); return; }
    setIsSubmitting(true);
    try {
      const response = await submitBookingPortalRequest({
        tenant_slug: normalizedTenantSlug,
        customer_full_name: form.customerName.trim(),
        phone_number: form.phoneNumber.trim(),
        email_address: form.emailAddress.trim().toLowerCase(),
        service_location_address: form.serviceLocationAddress.trim(),
        service_location_city: form.serviceLocationCity.trim() || null,
        service_location_state: form.serviceLocationState.trim() || null,
        service_location_zip_code: form.serviceLocationZipCode.trim() || null,
        service_catalog_ids: form.serviceIds,
        asset_details: form.assetDetails.trim(),
        preferred_date: form.preferredDate || null,
        preferred_time_of_day: form.preferredTimeOfDay,
        additional_notes: form.additionalNotes.trim() || undefined,
        website: null,
      });
      setSuccessReference(response.reference_number);
      setForm(initialFormState);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to send booking request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleService = (serviceId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      serviceIds: checked
        ? Array.from(new Set([...prev.serviceIds, serviceId]))
        : prev.serviceIds.filter((id) => id !== serviceId),
    }));
  };

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    if (!lookupReference.trim()) { setLookupError('Reference number is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(lookupEmail.trim())) { setLookupError('Enter the booking email address.'); return; }
    setIsLookingUp(true);
    try {
      const response = await lookupBookingPortalStatus({
        tenant_slug: normalizedTenantSlug,
        reference_number: lookupReference.trim().toUpperCase(),
        email_address: lookupEmail.trim().toLowerCase(),
      });
      setLookupResult(response);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Unable to look up booking status.');
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="booking-portal-shell min-h-screen bg-[#07101d] text-white">

      {/* ── Top Navigation ── */}
      <header className="border-b border-white/[0.06] bg-[rgba(7,16,29,0.95)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
            NexusOps
          </span>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 px-6 lg:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {config?.is_enabled ? 'Booking portal online' : 'Portal status loading'}
            </span>
            <span className="inline-flex max-w-[360px] items-center gap-2 truncate rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300">
              <Clock3 className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
              <span className="truncate">{config?.estimated_response_time_message || 'Submit a request and the team will follow up soon.'}</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white" aria-label="Booking updates">
                  <Bell className="h-4.5 w-4.5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-300" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 border-white/10 bg-[rgba(11,25,42,0.98)] p-0 text-white shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Booking updates</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Helpful information before you submit a request.</p>
                </div>
                <div className="space-y-2 p-3">
                  {[
                    ['Confirmation email', 'You will receive a reference number after submission.'],
                    ['Response window', config?.estimated_response_time_message || 'The service team will follow up soon.'],
                    ['Status tracking', config?.status_lookup_enabled ? 'Status lookup is available.' : 'We will contact you directly.'],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="text-xs font-semibold text-slate-100">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{body}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white" aria-label="Portal options">
                  <Settings className="h-4.5 w-4.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 border-white/10 bg-[rgba(11,25,42,0.98)] p-0 text-white shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Portal options</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Quick actions for customers using this booking page.</p>
                </div>
                <div className="space-y-2 p-3">
                  <Button asChild variant="outline" className={`w-full justify-start ${secondaryBtnCls}`} style={{ height: '42px' }}>
                    <Link to={bookingPath}>New service request</Link>
                  </Button>
                  {config?.status_lookup_enabled ? (
                    <Button asChild variant="outline" className={`w-full justify-start ${secondaryBtnCls}`} style={{ height: '42px' }}>
                      <Link to={statusPath}>Check request status</Link>
                    </Button>
                  ) : null}
                  <a href={`mailto:${config?.admin_contact_email || 'support@nexusops.app'}`} className="block rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-xs leading-5 text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white">
                    Need help? Contact {config?.company_name || 'the service team'} directly.
                  </a>
                </div>
              </PopoverContent>
            </Popover>
            <Button asChild className="h-9 rounded-lg bg-gradient-to-r from-[#4f7cff] to-[#22d3ee] px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,124,255,0.35)] hover:brightness-110 transition-all">
              <a href={`mailto:${config?.admin_contact_email || 'support@nexusops.app'}`}>Contact Us</a>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-6 lg:py-10">

        {/* ── Left: Booking Form ── */}
        <section className="rounded-2xl border border-white/[0.08] bg-[rgba(10,18,32,0.7)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-sm sm:p-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
            <Wrench className="h-3 w-3" />
            NexusOps Booking Portal
          </div>

          {/* Heading */}
          <h1 className="mt-5 text-[2.1rem] font-bold leading-[1.08] tracking-[-0.04em] text-white md:text-[2.6rem]">
            Book service without the<br />back-and-forth
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Share the job details once and let the dispatch team pick it up from intake to scheduling.
            Efficient, automated, and secure management for your infrastructure needs.
          </p>

          {/* Company info chips */}
          {config ? (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="rounded-md border-white/10 bg-white/[0.04] px-3 py-1 text-slate-200">
                {config.company_name}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Mail className="h-3.5 w-3.5 text-cyan-300" />
                {config.admin_contact_email}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Phone className="h-3.5 w-3.5 text-cyan-300" />
                {config.admin_contact_phone}
              </span>
            </div>
          ) : null}

          {/* Form area */}
          <div className="mt-7">
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-12 animate-pulse rounded-xl bg-white/5" />
                <div className="h-12 animate-pulse rounded-xl bg-white/5" />
                <div className="h-32 animate-pulse rounded-xl bg-white/5" />
              </div>
            ) : errorMessage ? (
              <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            ) : !config?.is_enabled ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Booking portal offline.
                </div>
                <p className="text-sm text-slate-500">Please contact the dispatch team directly for help.</p>
              </div>
            ) : successReference && !isStatusMode ? (
              /* ── Success State ── */
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Request received
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">You're all set.</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Your booking request has been recorded. Keep this reference number handy for follow-up.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Reference number</p>
                  <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-white">{successReference}</p>
                  <p className="mt-3 text-sm text-slate-400">{config.estimated_response_time_message}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setSuccessReference(null)} className={primaryBtnCls} style={{ width: 'auto', height: '44px', padding: '0 20px' }}>
                    Submit another request
                  </Button>
                  {config.status_lookup_enabled ? (
                    <Button asChild variant="outline" className={secondaryBtnCls} style={{ height: '44px', padding: '0 16px' }}>
                      <Link to={statusPath}>
                        Check booking status
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : !isStatusMode ? (
              /* ── Booking Form ── */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">Customer full name</Label>
                    <Input
                      value={form.customerName}
                      onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                      placeholder="John Doe"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">Phone number</Label>
                    <Input
                      value={form.phoneNumber}
                      onChange={(e) => setForm((p) => ({ ...p, phoneNumber: formatUsPhoneInput(e.target.value) }))}
                      placeholder="+1 (555) 000-0000"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">Email address</Label>
                    <Input
                      type="email"
                      value={form.emailAddress}
                      onChange={(e) => setForm((p) => ({ ...p, emailAddress: e.target.value }))}
                      placeholder="jdoe@example.com"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">Service type</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={`${inputCls} w-full justify-between px-4 font-normal hover:bg-[rgba(10,18,32,0.96)]`}
                        >
                          <span className="truncate text-left">{selectedServiceSummary}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-[rgba(11,25,42,0.98)] p-2 text-white shadow-[0_16px_60px_rgba(0,0,0,0.4)]">
                        <div className="max-h-64 space-y-0.5 overflow-y-auto pr-1">
                          {config?.services.map((service) => {
                            const checked = form.serviceIds.includes(service.id);
                            return (
                              <label
                                key={service.id}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.04]"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleService(service.id, v === true)}
                                  className="mt-0.5 border-white/20 data-[state=checked]:border-[#4f7cff] data-[state=checked]:bg-[#4f7cff]"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium text-white">{service.name}</span>
                                  <span className="block text-xs text-slate-500">{service.category}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {selectedServiceNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedServiceNames.slice(0, 2).map((name) => (
                          <span key={name} className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-0.5 text-xs text-cyan-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            {name}
                          </span>
                        ))}
                        {selectedServiceNames.length > 2 && (
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">
                            +{selectedServiceNames.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-300">Service location</Label>
                  <Input
                    value={form.serviceLocationAddress}
                    onChange={(e) => setForm((p) => ({ ...p, serviceLocationAddress: e.target.value }))}
                    placeholder="Street address, dealership, or site location"
                    className={inputCls}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_0.65fr_0.65fr]">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">City</Label>
                    <Input
                      value={form.serviceLocationCity}
                      onChange={(e) => setForm((p) => ({ ...p, serviceLocationCity: e.target.value }))}
                      placeholder="City"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">State / Province</Label>
                    <Input
                      value={form.serviceLocationState}
                      onChange={(e) => setForm((p) => ({ ...p, serviceLocationState: e.target.value }))}
                      placeholder="State"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">ZIP / Postal</Label>
                    <Input
                      value={form.serviceLocationZipCode}
                      onChange={(e) => setForm((p) => ({ ...p, serviceLocationZipCode: e.target.value }))}
                      placeholder="ZIP"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-300">{detailsLabel}</Label>
                  <Textarea
                    value={form.assetDetails}
                    onChange={(e) => setForm((p) => ({ ...p, assetDetails: e.target.value }))}
                    className={`min-h-[120px] ${textareaCls}`}
                    placeholder={`Describe the ${detailsLabel.toLowerCase()} and what needs attention.`}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">Preferred date</Label>
                    <Input
                      type="date"
                      value={form.preferredDate}
                      onChange={(e) => setForm((p) => ({ ...p, preferredDate: e.target.value }))}
                      className={inputCls}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm text-slate-300">Preferred time of day</Label>
                    <Select value={form.preferredTimeOfDay} onValueChange={(v) => setForm((p) => ({ ...p, preferredTimeOfDay: v as BookingFormState['preferredTimeOfDay'] }))}>
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentCls}>
                        <SelectItem value="morning">Morning (8AM – 12PM)</SelectItem>
                        <SelectItem value="afternoon">Afternoon (12PM – 4PM)</SelectItem>
                        <SelectItem value="evening">Evening (4PM – 8PM)</SelectItem>
                        <SelectItem value="no_preference">No preference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-300">Additional notes</Label>
                  <Textarea
                    value={form.additionalNotes}
                    onChange={(e) => setForm((p) => ({ ...p, additionalNotes: e.target.value }))}
                    className={`min-h-[96px] ${textareaCls}`}
                    placeholder="Optional access notes, urgency details, or scheduling context."
                  />
                </div>

                {formError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {formError}
                  </div>
                ) : null}

                <Button type="submit" disabled={isSubmitting} className={primaryBtnCls}>
                  {isSubmitting ? 'Sending request...' : 'Request Service'}
                </Button>
              </form>
            ) : (
              /* ── Status Lookup Form ── */
              <form onSubmit={handleLookup} className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-300">Reference number</Label>
                  <Input
                    value={lookupReference}
                    onChange={(e) => setLookupReference(e.target.value.toUpperCase())}
                    placeholder="e.g. REF-ABC123"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-slate-300">Email address</Label>
                  <Input
                    type="email"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="jdoe@example.com"
                    className={inputCls}
                  />
                </div>
                {lookupError ? (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {lookupError}
                  </div>
                ) : null}
                {lookupResult ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                        {lookupResult.reference_number}
                      </Badge>
                      <Badge variant="outline" className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                        {statusLabel}
                      </Badge>
                    </div>
                    {lookupResult.assigned_technician_first_name ? (
                      <p className="mt-4 text-sm text-slate-400">Assigned technician: {lookupResult.assigned_technician_first_name}</p>
                    ) : null}
                    {estimatedCompletionLabel ? (
                      <p className="mt-2 text-sm text-slate-400">Estimated completion: {estimatedCompletionLabel}</p>
                    ) : null}
                  </div>
                ) : null}
                <Button type="submit" disabled={isLookingUp} className={primaryBtnCls}>
                  {isLookingUp ? 'Checking status...' : 'Check status'}
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* ── Right: Sidebar ── */}
        <aside className="mt-6 flex flex-col gap-4 lg:mt-0">

          {/* What Happens Next */}
          <Card className="rounded-2xl border border-white/[0.08] bg-[rgba(10,18,32,0.7)] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              <CalendarDays className="h-3 w-3 text-cyan-300" />
              What happens next
            </div>
            <div className="mt-4 space-y-3">
              {[
                'Your request lands in the admin intake queue immediately.',
                'Dispatch reviews the service details and scheduling preferences.',
                'You receive a confirmation reference and follow-up by email.',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-sm leading-6 text-slate-400">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-slate-400">
                    {i + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </Card>

          {/* Response Window */}
          <Card className="rounded-2xl border border-white/[0.08] bg-[rgba(10,18,32,0.7)] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.35)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              <Clock3 className="h-3 w-3 text-cyan-300" />
              Response window
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              {config?.estimated_response_time_message
                ? <>{config.estimated_response_time_message}</>
                : <>We will contact you within <span className="font-semibold text-cyan-300">2 business hours</span>.</>
              }
            </p>
            {config?.status_lookup_enabled ? (
              <Button asChild variant="outline" className={`mt-4 w-full justify-center ${secondaryBtnCls}`} style={{ height: '44px' }}>
                <Link to={isStatusMode ? bookingPath : statusPath}>
                  {isStatusMode ? 'Back to booking form' : 'Open status lookup'}
                  {isStatusMode
                    ? <ArrowRight className="ml-2 h-4 w-4 rotate-180" />
                    : <Search className="ml-2 h-4 w-4" />
                  }
                </Link>
              </Button>
            ) : null}
          </Card>
        </aside>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              NexusOps
            </span>
            <p className="mt-1 text-xs text-slate-600">© 2024 NexusOps Infrastructure. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-slate-600">
            {['Privacy Policy', 'Terms of Service', 'API Documentation', 'System Status'].map((item) => (
              <span key={item} className="cursor-pointer hover:text-slate-400 transition-colors">{item}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
