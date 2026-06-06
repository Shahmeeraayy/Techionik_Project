import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Search } from 'lucide-react';
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
  fetchSuperAdminAuditLogs,
  getStoredSuperAdminToken,
  type BackendSuperAdminAuditLog,
} from '@/lib/backend-api';
import { toOrganizationTerminology } from '@/lib/super-admin-terminology';

function prettyLabel(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

export default function SuperAdminAuditLogsPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<BackendSuperAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState(searchParams.get('module') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');

  const loadLogs = async (background = false) => {
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
      const next = await fetchSuperAdminAuditLogs(token, {
        module: moduleFilter || undefined,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setRows(next);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load audit logs.');
      if (!background) {
        setRows([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-slate-900/10 bg-white/85">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="text-2xl tracking-[-0.04em]" style={{ fontFamily: '"Space Grotesk", "Sora", system-ui, sans-serif' }}>
                Platform Audit Logs
              </CardTitle>
              <CardDescription>Searchable records for platform changes, break-glass access, billing actions, and security review.</CardDescription>
            </div>
            <Button onClick={() => void loadLogs(true)} className="rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="super-admin-filter-row grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(13rem,0.62fr)_minmax(13rem,0.62fr)_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action, or reason" className="h-12 rounded-full border-slate-900/10 bg-[#faf6ef] pl-11" />
            </div>
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="h-12 rounded-full border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900">
              <option value="">All modules</option>
              <option value="tenant_management">Organization management</option>
              <option value="billing">Billing</option>
              <option value="feature_access">Feature access</option>
              <option value="platform_settings">Platform settings</option>
              <option value="security">Security</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-12 rounded-full border border-slate-900/10 bg-[#faf6ef] px-4 text-sm text-slate-900">
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <Button onClick={() => void loadLogs(true)} className="h-12 rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white hover:brightness-105">
              Apply
            </Button>
          </div>

          {error ? (
            <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          <div className="rounded-[1.5rem] border border-slate-900/10 bg-[#fffdf9] p-2">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Actor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-sm text-slate-500">Loading audit logs...</TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">No audit logs matched your filters.</TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-slate-950">{row.actor_name}</TableCell>
                        <TableCell>{prettyLabel(row.actor_role)}</TableCell>
                        <TableCell>{toOrganizationTerminology(prettyLabel(row.action))}</TableCell>
                        <TableCell>{toOrganizationTerminology(prettyLabel(row.module))}</TableCell>
                        <TableCell>
                          <Badge className={`rounded-full ${row.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {prettyLabel(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{toOrganizationTerminology(row.tenant_id ?? 'Platform')}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{toOrganizationTerminology(row.reason ?? '-')}</TableCell>
                        <TableCell>{formatDateTime(row.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
