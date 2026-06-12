import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/settings/SectionCard';
import { FormField } from '@/components/settings/FormField';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import {
  COMPANY_PROFILE_SETTINGS_STORAGE_KEY,
  DEFAULT_COMPANY_PROFILE_EXTRAS,
  saveSettingsObject,
  type CompanyProfileExtras,
} from '@/components/settings/storage';
import { loadInvoiceCompanyProfile, saveInvoiceCompanyProfile, type InvoiceCompanyProfile } from '@/lib/invoice-company';
import { getStoredAdminToken, updateAdminInvoiceBrandingSettings, type BackendInvoiceBrandingSettings } from '@/lib/backend-api';

type CompanyProfileFormState = {
  companyName: string;
  email: string;
  industryType: string;
  phone: string;
  primaryColor: string;
  pdfFooter: string;
  logoUrl: string;
};

const INDUSTRY_OPTIONS = [
  'Automotive',
  'Fleet',
  'Property',
  'Retail',
  'Industrial',
  'General',
];

const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_COMPANY_PROFILE_EXTRAS.primaryColor;
};

export default function SettingsProfilePage() {
  const workspace = useSettingsWorkspace();
  const [form, setForm] = useState<CompanyProfileFormState>({
    companyName: '',
    email: '',
    industryType: DEFAULT_COMPANY_PROFILE_EXTRAS.industryType,
    phone: '',
    primaryColor: DEFAULT_COMPANY_PROFILE_EXTRAS.primaryColor,
    pdfFooter: DEFAULT_COMPANY_PROFILE_EXTRAS.customFooterText,
    logoUrl: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyProfileFormState, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace.loading) {
      return;
    }

    setForm({
      companyName: workspace.invoiceBranding.name,
      email: workspace.invoiceBranding.email,
      industryType: workspace.companyExtras.industryType || DEFAULT_COMPANY_PROFILE_EXTRAS.industryType,
      phone: workspace.invoiceBranding.phone,
      primaryColor: workspace.companyExtras.primaryColor || DEFAULT_COMPANY_PROFILE_EXTRAS.primaryColor,
      pdfFooter: workspace.companyExtras.customFooterText || DEFAULT_COMPANY_PROFILE_EXTRAS.customFooterText,
      logoUrl: workspace.invoiceBranding.logo_url ?? '',
    });
    setErrors({});
  }, [workspace.companyExtras, workspace.invoiceBranding, workspace.loading, workspace.lastRefreshedAt]);

  const previewBranding = useMemo<InvoiceCompanyProfile>(() => ({
    ...loadInvoiceCompanyProfile(),
    logo_url: form.logoUrl.trim() || undefined,
    name: form.companyName.trim() || workspace.invoiceBranding.name,
    email: form.email.trim() || workspace.invoiceBranding.email,
    phone: form.phone.trim() || workspace.invoiceBranding.phone,
  }), [form.companyName, form.email, form.logoUrl, form.phone, workspace.invoiceBranding]);

  const handleLogoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        logoUrl: typeof reader.result === 'string' ? reader.result : '',
      }));
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = '';
  };

  const handleSave = async () => {
    const nextErrors: Partial<Record<keyof CompanyProfileFormState, string>> = {};

    if (!form.companyName.trim()) {
      nextErrors.companyName = 'Company name is required.';
    }
    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.';
    }
    if (!form.phone.trim()) {
      nextErrors.phone = 'Phone is required.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please complete the required profile fields.');
      return;
    }

    const nextCompanyExtras: CompanyProfileExtras = {
      ...workspace.companyExtras,
      industryType: form.industryType.trim() || DEFAULT_COMPANY_PROFILE_EXTRAS.industryType,
      timezone: workspace.companyExtras.timezone || DEFAULT_COMPANY_PROFILE_EXTRAS.timezone,
      primaryColor: normalizeHex(form.primaryColor),
      customFooterText: form.pdfFooter.trim(),
    };

    const nextBranding: InvoiceCompanyProfile = {
      ...workspace.invoiceBranding,
      logo_url: form.logoUrl.trim() || undefined,
      name: form.companyName.trim(),
      street_address: workspace.invoiceBranding.street_address || loadInvoiceCompanyProfile().street_address,
      city: workspace.invoiceBranding.city || loadInvoiceCompanyProfile().city,
      state: workspace.invoiceBranding.state || loadInvoiceCompanyProfile().state,
      zip_code: workspace.invoiceBranding.zip_code || loadInvoiceCompanyProfile().zip_code,
      phone: form.phone.trim(),
      email: form.email.trim(),
      website: workspace.invoiceBranding.website || loadInvoiceCompanyProfile().website,
    };

    setSaving(true);
    try {
      saveSettingsObject(COMPANY_PROFILE_SETTINGS_STORAGE_KEY, nextCompanyExtras);
      saveInvoiceCompanyProfile(nextBranding);

      const token = getStoredAdminToken();
      if (workspace.canUseBackend && token) {
        const backendPayload: BackendInvoiceBrandingSettings = {
          logo_url: nextBranding.logo_url ?? null,
          name: nextBranding.name,
          street_address: nextBranding.street_address,
          city: nextBranding.city,
          state: nextBranding.state,
          zip_code: nextBranding.zip_code,
          phone: nextBranding.phone,
          email: nextBranding.email,
          website: nextBranding.website,
        };
        await updateAdminInvoiceBrandingSettings(token, backendPayload);
        await workspace.refresh();
        toast.success('Company profile saved.');
        return;
      }

      await workspace.refresh();
      toast.success('Company profile saved locally.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save company profile.');
    } finally {
      setSaving(false);
    }
  };

  if (workspace.loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard title="Business identity" description="Loading company profile...">
          <div className="space-y-4">
            <div className="h-14 animate-pulse rounded-2xl bg-muted" />
            <div className="h-14 animate-pulse rounded-2xl bg-muted" />
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          </div>
        </SectionCard>
        <SectionCard title="Preview" description="Loading preview...">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <SectionCard
        title="Business identity"
        description="Company name, contact details, branding color, and PDF footer."
        action={
          <Badge variant="outline" className="rounded-full">
            <Palette className="mr-1.5 h-3.5 w-3.5" />
            Brand profile
          </Badge>
        }
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setForm({
                  companyName: workspace.invoiceBranding.name,
                  email: workspace.invoiceBranding.email,
                  industryType: workspace.companyExtras.industryType,
                  phone: workspace.invoiceBranding.phone,
                  primaryColor: workspace.companyExtras.primaryColor,
                  pdfFooter: workspace.companyExtras.customFooterText,
                  logoUrl: workspace.invoiceBranding.logo_url ?? '',
                });
                setErrors({});
              }}
              disabled={saving}
            >
              Reset
            </Button>
            <Button type="button" className="rounded-full" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Company Name" error={errors.companyName}>
            <Input value={form.companyName} onChange={(e) => setForm((current) => ({ ...current, companyName: e.target.value }))} />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <Input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
          </FormField>
          <FormField label="Industry">
            <Select value={form.industryType} onValueChange={(value) => setForm((current) => ({ ...current, industryType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select an industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
          </FormField>
          <FormField
            label="Primary Color"
            description="Used for key actions and brand accents."
            className="md:col-span-2"
            error={errors.primaryColor}
          >
            <div className="grid gap-3 sm:grid-cols-[88px_1fr]">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((current) => ({ ...current, primaryColor: e.target.value }))}
                className="h-12 w-full cursor-pointer rounded-2xl border border-border/70 bg-background p-2"
                aria-label="Primary color"
              />
              <Input
                value={form.primaryColor}
                onChange={(e) => setForm((current) => ({ ...current, primaryColor: e.target.value }))}
              />
            </div>
          </FormField>
          <FormField
            label="PDF Footer"
            description="Shown on generated invoices and exported PDFs."
            className="md:col-span-2"
          >
            <Textarea
              value={form.pdfFooter}
              onChange={(e) => setForm((current) => ({ ...current, pdfFooter: e.target.value }))}
              className="min-h-32 rounded-[20px]"
            />
          </FormField>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard
          title="Logo upload"
          description="Upload a transparent or full-color logo for invoices and portal branding."
        >
          <div className="space-y-4">
            <div className="flex min-h-48 items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-5">
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="Company logo preview"
                  className="max-h-40 max-w-full object-contain"
                />
              ) : (
                <div className="space-y-2 text-center text-muted-foreground">
                  <ImageIcon className="mx-auto h-10 w-10" />
                  <p className="text-sm font-medium">No logo uploaded</p>
                </div>
              )}
            </div>
            <FormField label="Logo file">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" className="rounded-full" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Choose file
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setForm((current) => ({ ...current, logoUrl: '' }))}
                >
                  Remove
                </Button>
              </div>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Preview" description="How this profile will appear across the workspace.">
          <div className="space-y-4 rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(9,17,31,0.98))] p-5 text-white">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10"
                style={{ backgroundColor: form.primaryColor }}
              >
                {previewBranding.logo_url ? (
                  <img src={previewBranding.logo_url} alt="Preview logo" className="max-h-10 max-w-10 object-contain" />
                ) : (
                  <span className="text-sm font-semibold">NO</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                  Active profile
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold">{previewBranding.name}</h3>
                <p className="mt-1 text-sm text-white/70">{previewBranding.email}</p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Industry</span>
                <span className="font-medium">{form.industryType || 'General'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Phone</span>
                <span className="font-medium">{previewBranding.phone}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/60">Footer</span>
                <span className="max-w-[55%] truncate text-right font-medium">{form.pdfFooter || 'No footer set'}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Primary color</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl border border-white/10" style={{ backgroundColor: form.primaryColor }} />
                <span className="text-sm font-medium">{form.primaryColor}</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

