import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, RefreshCw, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchSuperAdminTenants,
  getStoredSuperAdminToken,
  type BackendSuperAdminTenantSummary,
} from '@/lib/backend-api';
import { toOrganizationTerminology } from '@/lib/super-admin-terminology';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString();
}

function prettyLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusClasses(status: BackendSuperAdminTenantSummary['platform_status']) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800';
  if (status === 'trial') return 'bg-cyan-100 text-cyan-800';
  if (status === 'payment_pending') return 'bg-amber-100 text-amber-800';
  if (status === 'suspended' || status === 'blocked') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-200 text-slate-700';
}

export default function SuperAdminTenantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<BackendSuperAdminTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');

  const filters = useMemo(() => ({
    search: searchParams.get('q') ?? undefined,
    platform_status: searchParams.get('status') ?? undefined,
    subscription_plan: searchParams.get('plan') ?? undefined,
    subscription_status: searchParams.get('billing') ?? undefined,
  }), [searchParams]);

  const loadTenants = async (background = false) => {
    const token = getStoredSuperAdminToken();
    if (!token) {
      setError('Super Admin session missing. Please sign in again.');
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const next = await fetchSuperAdminTenants(token, filters);
      setRows(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load organizations.');
      if (!background) {
        setRows([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadTenants();
  }, [searchParams]);

  const handleFilterChange = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleFilterChange('q', searchDraft.trim());
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                Organization Management
              </CardTitle>
              <CardDescription>Search, filter, and inspect every organization registered on NexusOps.</CardDescription>
            </div>

            <Button onClick={() => void loadTenants(true)} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="super-admin-filter-row grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(11rem,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search organization, business, or workspace"
                className="h-12 rounded-full border-slate-900/10 bg-[#faf6ef] pl-11"
              />
            </div>
            <select
              value={filters.platform_status ?? ''}
              onChange={(event) => handleFilterChange('status', event.target.value)}
              className="h-12 rounded-full border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="payment_pending">Payment Pending</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
              <option value="blocked">Blocked</option>
            </select>
            <select
              value={filters.subscription_plan ?? ''}
              onChange={(event) => handleFilterChange('plan', event.target.value)}
              className="h-12 rounded-full border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900"
            >
              <option value="">All plans</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              value={filters.subscription_status ?? ''}
              onChange={(event) => handleFilterChange('billing', event.target.value)}
              className="h-12 rounded-full border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900"
            >
              <option value="">All billing states</option>
              <option value="trial">Trial</option>
              <option value="paid">Paid</option>
              <option value="payment_pending">Payment Pending</option>
              <option value="past_due">Past Due</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </form>

          {error ? (
            <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#fffdf9] p-2">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Technicians</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={10} className="py-5 text-sm text-slate-500">
                          Loading organization data...
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-sm text-slate-500">
                        No organizations matched your current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="min-w-[220px]">
                            <p className="font-semibold text-slate-950">{toOrganizationTerminology(tenant.name)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{toOrganizationTerminology(tenant.slug)}</p>
                          </div>
                        </TableCell>
                        <TableCell>{prettyLabel(tenant.industry_type)}</TableCell>
                        <TableCell>
                          <div className="min-w-[180px]">
                            <p className="font-medium text-slate-900">{tenant.owner_name ?? 'No owner'}</p>
                            <p className="mt-1 text-sm text-slate-500">{tenant.owner_email ?? '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="rounded-full bg-slate-900 text-white">{tenant.subscription_plan}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`rounded-full ${statusClasses(tenant.platform_status)}`}>
                            {prettyLabel(tenant.platform_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-slate-700">
                            <Users className="h-4 w-4" />
                            {tenant.users_count}
                          </div>
                        </TableCell>
                        <TableCell>{tenant.technicians_count}</TableCell>
                        <TableCell>{formatDate(tenant.created_at)}</TableCell>
                        <TableCell>{formatDate(tenant.last_login_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" className="rounded-full text-slate-900 hover:bg-slate-100">
                            <Link to={`/super-admin/tenants/${tenant.id}`}>
                              Detail View
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.45rem] border border-slate-900/10 bg-[#faf6ef] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Visible organizations</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">{rows.length}</p>
            </div>
            <div className="rounded-[1.45rem] border border-slate-900/10 bg-[#faf6ef] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Suspended or blocked</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {rows.filter((tenant) => tenant.platform_status === 'suspended' || tenant.platform_status === 'blocked').length}
              </p>
            </div>
            <div className="rounded-[1.45rem] border border-slate-900/10 bg-[#faf6ef] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payment issues</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {rows.reduce((sum, tenant) => sum + tenant.payment_failures_count, 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
