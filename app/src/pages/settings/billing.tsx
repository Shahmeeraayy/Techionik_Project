import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SectionCard } from '@/components/settings/SectionCard';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { cn } from '@/lib/utils';

function UsageBar({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value}/{total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-[linear-gradient(135deg,#0f172a,#155e75)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: string;
  helper: string;
  className: string;
}) {
  return (
    <Card className={cn('gap-0 rounded-[28px] border-0 shadow-[0_18px_60px_rgba(15,23,42,0.12)]', className)}>
      <CardContent className="p-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/65">{label}</p>
        <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{value}</p>
        <p className="mt-3 text-sm leading-6 text-white/75">{helper}</p>
      </CardContent>
    </Card>
  );
}

export default function SettingsBillingPage() {
  const workspace = useSettingsWorkspace();

  const renewalLabel = useMemo(() => {
    const renewalDate = new Date(workspace.billingSubscription.renewalDate);
    return Number.isNaN(renewalDate.getTime())
      ? workspace.billingSubscription.renewalDate
      : renewalDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }, [workspace.billingSubscription.renewalDate]);

  const technicianUsage = workspace.billingSubscription.technicianLimit > 0
    ? Math.min(Math.round((workspace.technicianCount / workspace.billingSubscription.technicianLimit) * 100), 100)
    : 0;
  const locationUsage = workspace.billingSubscription.locationLimit > 0
    ? Math.min(Math.round((workspace.dealerships.length / workspace.billingSubscription.locationLimit) * 100), 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Current plan"
          value={workspace.billingSubscription.planName}
          helper={workspace.billingSubscription.monthlyPrice}
          className="bg-[linear-gradient(135deg,#0f172a,#1e293b)]"
        />
        <SummaryCard
          label="Renewal date"
          value={renewalLabel}
          helper="Billing renews automatically unless paused."
          className="bg-[linear-gradient(135deg,#0f766e,#14b8a6)]"
        />
        <SummaryCard
          label="Usage"
          value={`${workspace.technicianCount + workspace.dealerships.length}`}
          helper="Combined active technicians and locations."
          className="bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)]"
        />
      </div>

      <SectionCard
        title="Usage"
        description="Track the number of active technicians and locations against your plan limits."
      >
        <div className="space-y-5">
          <UsageBar
            label="Technicians"
            value={workspace.technicianCount}
            total={workspace.billingSubscription.technicianLimit}
          />
          <UsageBar
            label="Locations"
            value={workspace.dealerships.length}
            total={workspace.billingSubscription.locationLimit}
          />
          <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Billing provider</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Billing information is currently managed in the dashboard and can be synced to your billing provider when that integration is connected.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Plan details" description="The current subscription plan for this workspace.">
          <div className="grid gap-3 rounded-[24px] border border-border/70 bg-background/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Plan</span>
              <span className="text-sm font-medium text-foreground">{workspace.billingSubscription.planName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Price</span>
              <span className="text-sm font-medium text-foreground">{workspace.billingSubscription.monthlyPrice}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Renewal</span>
              <span className="text-sm font-medium text-foreground">{renewalLabel}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Limits" description="How much room remains in the current plan.">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Technician usage</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                {workspace.technicianCount}/{workspace.billingSubscription.technicianLimit}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{technicianUsage}% of technician seats used.</p>
            </div>
            <div className="rounded-[24px] border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Location usage</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                {workspace.dealerships.length}/{workspace.billingSubscription.locationLimit}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{locationUsage}% of location capacity used.</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex justify-end">
        <Badge variant="outline" className="rounded-full">
          Billing read-only in this build
        </Badge>
      </div>
    </div>
  );
}

