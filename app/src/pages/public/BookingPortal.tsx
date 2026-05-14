import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, CheckSquare, ChevronDown, Clock3, Mail, Phone, Search, Wrench } from 'lucide-react';
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
  serviceIds: [],
  assetDetails: '',
  preferredDate: '',
  preferredTimeOfDay: 'no_preference',
  additionalNotes: '',
};

const portalInputClass = 'h-[52px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500';
const portalTextareaClass = 'rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))] text-white placeholder:text-slate-500';
const portalSelectContentClass = 'border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.94))] text-white';
const portalPrimaryButtonClass = 'h-[54px] w-full rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-base font-semibold text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105';
const portalSecondaryButtonClass = 'border-white/10 bg-[rgba(12,20,34,0.9)] text-slate-100 hover:bg-[rgba(23,37,64,0.94)] hover:text-white';

export default function BookingPortalPage() {
  const location = useLocation();
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reference = params.get('reference') ?? '';
    const email = params.get('email') ?? '';
    if (reference) {
      setLookupReference(reference.toUpperCase());
    }
    if (email) {
      setLookupEmail(email.toLowerCase());
    }
  }, [location.search]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const next = await fetchBookingPortalPublicConfig();
        if (!isMounted) {
          return;
        }
        setConfig(next);
        setForm((prev) => ({
          ...prev,
          serviceIds: prev.serviceIds.length > 0 ? prev.serviceIds : (next.services[0]?.id ? [next.services[0].id] : []),
        }));
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load booking portal.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const detailsLabel = config?.details_field_label ?? 'Details';
  const selectedServiceNames = useMemo(() => {
    if (!config) {
      return [];
    }
    const serviceMap = new Map(config.services.map((service) => [service.id, service.name]));
    return form.serviceIds.map((id) => serviceMap.get(id)).filter((value): value is string => Boolean(value));
  }, [config, form.serviceIds]);
  const statusLabel = lookupResult?.status ?? null;
  const estimatedCompletionLabel = useMemo(() => {
    if (!lookupResult?.estimated_completion_date) {
      return null;
    }
    const parsed = new Date(lookupResult.estimated_completion_date);
    if (Number.isNaN(parsed.getTime())) {
      return lookupResult.estimated_completion_date;
    }
    return parsed.toLocaleDateString();
  }, [lookupResult]);

  const validateBookingForm = () => {
    if (!form.customerName.trim()) return 'Customer full name is required.';
    if (form.phoneNumber.replace(/\D/g, '').length < 10) return 'Enter a valid phone number.';
    if (!/\S+@\S+\.\S+/.test(form.emailAddress.trim())) return 'Enter a valid email address.';
    if (form.serviceIds.length === 0) return 'Select at least one service type.';
    if (!form.assetDetails.trim()) return `${detailsLabel} is required.`;
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setErrorMessage(null);
    const validationError = validateBookingForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await submitBookingPortalRequest({
        customer_full_name: form.customerName.trim(),
        phone_number: form.phoneNumber.trim(),
        email_address: form.emailAddress.trim().toLowerCase(),
        service_catalog_ids: form.serviceIds,
        asset_details: form.assetDetails.trim(),
        preferred_date: form.preferredDate || null,
        preferred_time_of_day: form.preferredTimeOfDay,
        additional_notes: form.additionalNotes.trim() || undefined,
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
    if (!lookupReference.trim()) {
      setLookupError('Reference number is required.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(lookupEmail.trim())) {
      setLookupError('Enter the booking email address.');
      return;
    }
    setIsLookingUp(true);
    try {
      const response = await lookupBookingPortalStatus({
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#07111d_0%,#0a1626_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch lg:px-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(7,25,42,0.98),rgba(6,18,32,0.98))] p-6 shadow-[0_34px_120px_rgba(0,0,0,0.34)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-20" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <Wrench className="h-3.5 w-3.5" />
              NexusOps Booking Portal
            </div>
            <h1 className="mt-5 text-[2.35rem] font-semibold leading-none tracking-[-0.06em] text-white md:text-[2.9rem]">
              Book service
              <span className="block text-white">
                without the back-and-forth
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-[15px]">
              Share the job details once and let the dispatch team pick it up from intake to scheduling.
            </p>
            {config ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-slate-200">
                  {config.company_name}
                </Badge>
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-cyan-200" />
                  {config.admin_contact_email}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-cyan-200" />
                  {config.admin_contact_phone}
                </span>
              </div>
            ) : null}
            <div className="mt-8 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,27,43,0.92),rgba(7,23,37,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_rgba(3,12,24,0.34)] sm:p-6">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
                  <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
                  <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
                </div>
              ) : errorMessage ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : !config?.is_enabled ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    This booking portal is currently offline.
                  </div>
                  <p className="text-sm text-slate-400">Please contact the dispatch team directly for help.</p>
                </div>
              ) : successReference && !isStatusMode ? (
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Request received
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">You're all set.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Your booking request has been recorded. Keep this reference number handy for follow-up.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Reference number</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">{successReference}</p>
                    <p className="mt-3 text-sm text-slate-300">{config.estimated_response_time_message}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={() => setSuccessReference(null)} className="rounded-2xl border border-[#7db0ff]/40 bg-[linear-gradient(135deg,#4f7cff,#22d3ee)] text-white shadow-[0_16px_34px_rgba(79,124,255,0.22)] hover:brightness-105">
                      Submit another request
                    </Button>
                    {config.status_lookup_enabled ? (
                      <Button asChild variant="outline" className={portalSecondaryButtonClass}>
                        <Link to="/book/status">
                          Check booking status
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : !isStatusMode ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-200">Customer full name</Label>
                      <Input
                        value={form.customerName}
                        onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))}
                        className={portalInputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Phone number</Label>
                      <Input
                        value={form.phoneNumber}
                        onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: formatUsPhoneInput(event.target.value) }))}
                        placeholder="+1(586) 556-0113"
                        className={portalInputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Email address</Label>
                      <Input
                        type="email"
                        value={form.emailAddress}
                        onChange={(event) => setForm((prev) => ({ ...prev, emailAddress: event.target.value }))}
                        className={portalInputClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Service type</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={`${portalInputClass} w-full justify-between px-4 font-normal text-left hover:bg-[linear-gradient(180deg,rgba(10,18,32,0.96),rgba(8,14,26,0.96))]`}
                          >
                            <span className="truncate">
                              {selectedServiceNames.length > 0
                                ? selectedServiceNames.join(', ')
                                : 'Select one or more services'}
                            </span>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-[linear-gradient(180deg,rgba(11,25,42,0.98),rgba(10,20,35,0.94))] p-2 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                            {config.services.map((service) => {
                              const checked = form.serviceIds.includes(service.id);
                              return (
                                <label
                                  key={service.id}
                                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-2 text-sm text-slate-200 hover:border-white/8 hover:bg-white/[0.04]"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) => toggleService(service.id, value === true)}
                                    className="mt-0.5 border-white/18 bg-[rgba(10,18,32,0.96)] data-[state=checked]:border-[#4f7cff] data-[state=checked]:bg-[#4f7cff] data-[state=checked]:text-white"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-white">{service.name}</span>
                                    <span className="block text-xs text-slate-400">{service.category}</span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {selectedServiceNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {selectedServiceNames.map((serviceName) => (
                            <Badge key={serviceName} variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                              <CheckSquare className="mr-1 h-3 w-3" />
                              {serviceName}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">{detailsLabel}</Label>
                    <Textarea
                      value={form.assetDetails}
                      onChange={(event) => setForm((prev) => ({ ...prev, assetDetails: event.target.value }))}
                      className={`min-h-[132px] ${portalTextareaClass}`}
                      placeholder={`Describe the ${detailsLabel.toLowerCase()} and what needs attention.`}
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-slate-200">Preferred date</Label>
                      <Input
                        type="date"
                        value={form.preferredDate}
                        onChange={(event) => setForm((prev) => ({ ...prev, preferredDate: event.target.value }))}
                        className={portalInputClass}
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200">Preferred time of day</Label>
                      <Select value={form.preferredTimeOfDay} onValueChange={(value) => setForm((prev) => ({ ...prev, preferredTimeOfDay: value as BookingFormState['preferredTimeOfDay'] }))}>
                        <SelectTrigger className={portalInputClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={portalSelectContentClass}>
                          <SelectItem value="morning">Morning</SelectItem>
                          <SelectItem value="afternoon">Afternoon</SelectItem>
                          <SelectItem value="evening">Evening</SelectItem>
                          <SelectItem value="no_preference">No preference</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-200">Additional notes</Label>
                    <Textarea
                      value={form.additionalNotes}
                      onChange={(event) => setForm((prev) => ({ ...prev, additionalNotes: event.target.value }))}
                      className={`min-h-[110px] ${portalTextareaClass}`}
                      placeholder="Optional access notes, urgency details, or scheduling context."
                    />
                  </div>

                  {formError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {formError}
                    </div>
                  ) : null}

                  <Button type="submit" disabled={isSubmitting} className={portalPrimaryButtonClass}>
                    {isSubmitting ? 'Sending request...' : 'Request Service'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLookup} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-slate-200">Reference number</Label>
                    <Input
                      value={lookupReference}
                      onChange={(event) => setLookupReference(event.target.value.toUpperCase())}
                      className={portalInputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-200">Email address</Label>
                    <Input
                      type="email"
                      value={lookupEmail}
                      onChange={(event) => setLookupEmail(event.target.value)}
                      className={portalInputClass}
                    />
                  </div>
                  {lookupError ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {lookupError}
                    </div>
                  ) : null}
                  {lookupResult ? (
                    <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                          {lookupResult.reference_number}
                        </Badge>
                        <Badge variant="outline" className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                          {statusLabel}
                        </Badge>
                      </div>
                      {lookupResult.assigned_technician_first_name ? (
                        <p className="mt-4 text-sm text-slate-300">Assigned technician: {lookupResult.assigned_technician_first_name}</p>
                      ) : null}
                      {estimatedCompletionLabel ? (
                        <p className="mt-2 text-sm text-slate-300">Estimated completion: {estimatedCompletionLabel}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <Button type="submit" disabled={isLookingUp} className={portalPrimaryButtonClass}>
                    {isLookingUp ? 'Checking status...' : 'Check status'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
              <CalendarDays className="h-3.5 w-3.5 text-cyan-200" />
              What happens next
            </div>
            <div className="mt-5 space-y-4">
              {[
                'Your request lands in the admin intake queue immediately.',
                'Dispatch reviews the service details and scheduling preferences.',
                'You receive a confirmation reference and follow-up by email.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,24,39,0.96),rgba(6,17,29,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
              <Clock3 className="h-3.5 w-3.5 text-cyan-200" />
              Response window
            </div>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              {config?.estimated_response_time_message ?? 'We will contact you shortly after review.'}
            </p>
            {config?.status_lookup_enabled ? (
              <Button asChild variant="outline" className={`mt-5 ${portalSecondaryButtonClass}`}>
                <Link to={isStatusMode ? '/book' : '/book/status'}>
                  {isStatusMode ? 'Back to booking form' : 'Open status lookup'}
                  {isStatusMode ? <ArrowRight className="ml-2 h-4 w-4 rotate-180" /> : <Search className="ml-2 h-4 w-4" />}
                </Link>
              </Button>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
