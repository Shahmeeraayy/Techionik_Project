import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  fetchSuperAdminAccessPolicies,
  getStoredSuperAdminToken,
  runSuperAdminAccessCheck,
  type BackendSuperAdminAccessCheck,
  type BackendSuperAdminAccessPolicies,
} from '@/lib/backend-api';
import { toInternalTenantTerminology, toOrganizationTerminology } from '@/lib/super-admin-terminology';

function prettyLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function SuperAdminPoliciesPage() {
  const [policies, setPolicies] = useState<BackendSuperAdminAccessPolicies | null>(null);
  const [checkResult, setCheckResult] = useState<BackendSuperAdminAccessCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningCheck, setRunningCheck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tenantId: '',
    tenantRole: 'admin',
    permission: 'users.view.tenant',
    featureKey: 'technicians',
    requestedTenantId: '',
    resourceTenantId: '',
    requestedUserId: '',
    resourceOwnerUserId: '',
  });

  const featureOptions = useMemo(() => policies?.feature_catalog ?? [], [policies]);

  const loadPolicies = async () => {
    const token = getStoredSuperAdminToken();
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await fetchSuperAdminAccessPolicies(token);
      setPolicies(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load access policies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicies();
  }, []);

  const handleRunCheck = async () => {
    const token = getStoredSuperAdminToken();
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      return;
    }
    if (!form.tenantId.trim()) {
      setError('Organization ID is required to run an access check.');
      return;
    }

    setRunningCheck(true);
    setError(null);
    try {
      const next = await runSuperAdminAccessCheck(token, form.tenantId.trim(), {
        tenant_role: form.tenantRole,
        permission: form.permission,
        feature_key: form.featureKey || undefined,
        requested_tenant_id: form.requestedTenantId || undefined,
        resource_tenant_id: form.resourceTenantId || undefined,
        requested_user_id: form.requestedUserId || undefined,
        resource_owner_user_id: form.resourceOwnerUserId || undefined,
      });
      setCheckResult(next);
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : 'Failed to run access validation.');
    } finally {
      setRunningCheck(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                Access Policies
              </CardTitle>
              <CardDescription>Platform roles, organization role permissions, plan entitlements, and deny-by-default rules.</CardDescription>
            </div>
            <Button onClick={() => void loadPolicies()} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(23rem,1.05fr)]">
            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#faf6ef] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Validation flow</p>
                <div className="mt-4 space-y-3">
                  {(policies?.validation_flow ?? []).map((step) => (
                    <div key={step} className="flex items-start gap-3 rounded-[1rem] border border-slate-900/10 bg-white px-4 py-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-slate-700">{toOrganizationTerminology(step)}</span>
                    </div>
                  ))}
                </div>
                <Badge className="mt-4 rounded-full bg-rose-100 text-rose-800">{policies?.default_access ?? 'denied'}</Badge>
              </div>

              <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#faf6ef] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Plan matrix</p>
                <div className="mt-4 space-y-4">
                  {Object.entries(policies?.plan_matrix ?? {}).map(([plan, features]) => (
                    <div key={plan} className="rounded-[1rem] border border-slate-900/10 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">{prettyLabel(plan)}</p>
                        <Badge className="rounded-full bg-slate-900 text-white">{features.length} features</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {features.map((feature) => (
                          <Badge key={feature} variant="outline" className="rounded-full border-slate-300 bg-[#faf6ef] text-slate-700">
                            {prettyLabel(feature)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#faf6ef] p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-800" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Access check playground</p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="playground-tenant-id">Organization ID</Label>
                    <Input id="playground-tenant-id" value={form.tenantId} onChange={(event) => setForm((prev) => ({ ...prev, tenantId: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-role">Organization Role</Label>
                    <select id="playground-role" value={form.tenantRole} onChange={(event) => setForm((prev) => ({ ...prev, tenantRole: event.target.value }))} className="h-12 w-full rounded-[1rem] border border-slate-900/10 bg-white px-4 text-sm text-slate-900">
                      {(policies?.tenant_roles ?? []).map((roleRow) => (
                        <option key={roleRow.role} value={roleRow.role}>{prettyLabel(roleRow.role)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-permission">Permission</Label>
                    <Input
                      id="playground-permission"
                      value={toOrganizationTerminology(form.permission)}
                      onChange={(event) => setForm((prev) => ({ ...prev, permission: toInternalTenantTerminology(event.target.value) }))}
                      className="h-12 rounded-[1rem] border-slate-900/10 bg-white"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="playground-feature">Feature Key</Label>
                    <select id="playground-feature" value={form.featureKey} onChange={(event) => setForm((prev) => ({ ...prev, featureKey: event.target.value }))} className="h-12 w-full rounded-[1rem] border border-slate-900/10 bg-white px-4 text-sm text-slate-900">
                      {featureOptions.map((feature) => (
                        <option key={feature.key} value={feature.key}>{feature.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-requested-tenant">Requested Organization ID</Label>
                    <Input id="playground-requested-tenant" value={form.requestedTenantId} onChange={(event) => setForm((prev) => ({ ...prev, requestedTenantId: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-resource-tenant">Resource Organization ID</Label>
                    <Input id="playground-resource-tenant" value={form.resourceTenantId} onChange={(event) => setForm((prev) => ({ ...prev, resourceTenantId: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-requested-user">Requested User ID</Label>
                    <Input id="playground-requested-user" value={form.requestedUserId} onChange={(event) => setForm((prev) => ({ ...prev, requestedUserId: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playground-resource-owner">Resource Owner User ID</Label>
                    <Input id="playground-resource-owner" value={form.resourceOwnerUserId} onChange={(event) => setForm((prev) => ({ ...prev, resourceOwnerUserId: event.target.value }))} className="h-12 rounded-[1rem] border-slate-900/10 bg-white" />
                  </div>
                </div>

                <Button onClick={handleRunCheck} disabled={runningCheck} className="mt-5 rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
                  {runningCheck ? 'Running validation...' : 'Run access check'}
                </Button>

                {checkResult ? (
                  <div className="mt-5 space-y-3">
                    <Badge className={`rounded-full ${checkResult.allowed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {checkResult.allowed ? 'Allowed' : 'Denied'}
                    </Badge>
                    {checkResult.steps.map((step) => (
                      <div key={step.label} className="flex items-center justify-between rounded-[1rem] border border-slate-900/10 bg-white px-4 py-3">
                        <span className="text-sm text-slate-700">{toOrganizationTerminology(step.label)}</span>
                        <Badge className={`rounded-full ${step.allowed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {step.allowed ? 'Pass' : 'Fail'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#faf6ef] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Platform roles</p>
              <div className="mt-4 space-y-4">
                {(policies?.platform_roles ?? []).map((roleRow) => (
                  <div key={roleRow.role} className="rounded-[1rem] border border-slate-900/10 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-950">{prettyLabel(roleRow.role)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {roleRow.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="rounded-full border-slate-300 bg-[#faf6ef] text-slate-700">
                          {toOrganizationTerminology(permission)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#faf6ef] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Organization roles</p>
              <div className="mt-4 space-y-4">
                {(policies?.tenant_roles ?? []).map((roleRow) => (
                  <div key={roleRow.role} className="rounded-[1rem] border border-slate-900/10 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-950">{prettyLabel(roleRow.role)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {roleRow.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="rounded-full border-slate-300 bg-[#faf6ef] text-slate-700">
                          {toOrganizationTerminology(permission)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
