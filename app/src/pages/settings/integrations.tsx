import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionCard } from '@/components/settings/SectionCard';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { cn } from '@/lib/utils';

const INTEGRATIONS = [
  {
    name: 'Google Calendar',
    description: 'Sync booking appointments and technician availability.',
    status: 'Connected',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Microsoft Outlook',
    description: 'Mirror dispatch updates into Microsoft 365 mailboxes.',
    status: 'Available',
    accent: 'from-sky-500 to-blue-500',
  },
  {
    name: 'Slack',
    description: 'Send escalations and manager notifications to Slack channels.',
    status: 'Available',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    name: 'Twilio SMS',
    description: 'Customer alerts and technician notifications via text message.',
    status: 'Connected',
    accent: 'from-orange-500 to-amber-500',
  },
  {
    name: 'Zapier',
    description: 'Automate handoffs into other operations tools.',
    status: 'Planned',
    accent: 'from-slate-500 to-slate-700',
  },
  {
    name: 'QuickBooks',
    description: 'Sync invoices, payments, and billing records.',
    status: 'Planned',
    accent: 'from-rose-500 to-red-500',
  },
];

export default function SettingsIntegrationsPage() {
  const workspace = useSettingsWorkspace();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Partner locations" description="Active locations currently linked to the workspace.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">{workspace.dealerships.length}</div>
        </SectionCard>
        <SectionCard title="Enabled integrations" description="External services already connected.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
            {INTEGRATIONS.filter((item) => item.status === 'Connected').length}
          </div>
        </SectionCard>
        <SectionCard title="Planned tools" description="Integrations ready to be connected next.">
          <div className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
            {INTEGRATIONS.filter((item) => item.status === 'Planned').length}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="External services"
        description="Track which tools are connected, available, or queued for rollout."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {INTEGRATIONS.map((integration) => (
            <Card
              key={integration.name}
              className="gap-0 rounded-[26px] border-border/70 bg-background/80 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
            >
              <CardContent className="space-y-4 p-5">
                <div className={cn('h-2 rounded-full bg-gradient-to-r', integration.accent)} />
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold tracking-[-0.03em] text-foreground">{integration.name}</h3>
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full',
                        integration.status === 'Connected'
                          ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : integration.status === 'Available'
                            ? 'border-sky-500/30 text-sky-700 dark:text-sky-300'
                            : 'border-slate-400/40 text-muted-foreground',
                      )}
                    >
                      {integration.status}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{integration.description}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Partner ready</span>
                  <Button type="button" variant="outline" size="sm" className="rounded-full">
                    {integration.status === 'Connected' ? 'Manage' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Partner network"
        description="Locations and partner organizations that currently participate in the workspace."
      >
        <div className="flex flex-wrap gap-2">
          {workspace.dealerships.length > 0 ? (
            workspace.dealerships.map((location) => (
              <Badge key={location.id} variant="outline" className="rounded-full px-3 py-1.5">
                {location.name}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No partners loaded yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

