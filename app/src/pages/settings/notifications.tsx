import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bot, CheckCircle2, Settings2, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/settings/SectionCard';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import {
  NOTIFICATION_PREFERENCES_STORAGE_KEY,
  DEFAULT_NOTIFICATION_PREFERENCES,
  saveSettingsObject,
  type NotificationPreferences,
} from '@/components/settings/storage';

type ToggleKey = keyof NotificationPreferences;

type NotificationGroup = {
  title: string;
  description: string;
  icon: LucideIcon;
  keys: Array<{ key: ToggleKey; title: string; description: string }>;
};

const GROUPS: NotificationGroup[] = [
  {
    title: 'Technician alerts',
    description: 'Notify the field team when work changes, jobs are assigned, or follow-up is needed.',
    icon: Users,
    keys: [
      {
        key: 'technicianJobAssignments',
        title: 'New assignments',
        description: 'Notify technicians when a new job is assigned to them.',
      },
      {
        key: 'technicianJobUpdates',
        title: 'Job updates',
        description: 'Send changes when a technician job is rescheduled, cancelled, or updated.',
      },
    ],
  },
  {
    title: 'Manager alerts',
    description: 'Keep leads informed when the queue needs attention or a summary is due.',
    icon: Settings2,
    keys: [
      {
        key: 'managerEscalations',
        title: 'Escalations',
        description: 'Flag urgent jobs or overdue requests for managers.',
      },
      {
        key: 'managerDailySummary',
        title: 'Daily summary',
        description: 'Send a concise digest of the queue and billing activity each morning.',
      },
    ],
  },
  {
    title: 'Customer alerts',
    description: 'Control the client-facing notifications that shape the booking experience.',
    icon: CheckCircle2,
    keys: [
      {
        key: 'customerBookingConfirmation',
        title: 'Booking confirmation',
        description: 'Send confirmation after a customer submits a booking request.',
      },
      {
        key: 'customerStatusUpdates',
        title: 'Status updates',
        description: 'Notify customers when their request moves through the workflow.',
      },
    ],
  },
  {
    title: 'System alerts',
    description: 'Track platform health, routing, and integration reliability.',
    icon: Bot,
    keys: [
      {
        key: 'systemEmailDeliverability',
        title: 'Email deliverability',
        description: 'Alert the team when sending issues or bounces are detected.',
      },
      {
        key: 'systemIntegrationHealth',
        title: 'Integration health',
        description: 'Raise alerts when connected services stop syncing correctly.',
      },
    ],
  },
];

export default function SettingsNotificationsPage() {
  const workspace = useSettingsWorkspace();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace.loading) {
      return;
    }
    setPreferences(workspace.notificationPreferences);
  }, [workspace.loading, workspace.lastRefreshedAt, workspace.notificationPreferences]);

  const enabledCount = useMemo(
    () => Object.values(preferences).filter(Boolean).length,
    [preferences],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      saveSettingsObject(NOTIFICATION_PREFERENCES_STORAGE_KEY, preferences);
      await workspace.refresh();
      toast.success('Notification preferences saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (workspace.loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Loading notification groups..." description="Please wait while settings are loaded.">
          <div className="space-y-4">
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-full">
          {enabledCount} enabled
        </Badge>
        <Badge variant="outline" className="rounded-full">
          Saved locally
        </Badge>
      </div>

      <div className="grid gap-4">
        {GROUPS.map((group) => {
          const Icon = group.icon;
          const activeInGroup = group.keys.filter((item) => preferences[item.key]).length;

          return (
            <SectionCard
              key={group.title}
              title={group.title}
              description={group.description}
              action={
                <Badge variant="outline" className="rounded-full">
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {activeInGroup}/{group.keys.length} on
                </Badge>
              }
            >
              <div className="space-y-3">
                {group.keys.map((toggle) => (
                  <ToggleSwitch
                    key={toggle.key}
                    title={toggle.title}
                    description={toggle.description}
                    checked={preferences[toggle.key]}
                    onCheckedChange={(checked) =>
                      setPreferences((current) => ({ ...current, [toggle.key]: checked }))
                    }
                  />
                ))}
              </div>
            </SectionCard>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-full">
          {saving ? 'Saving...' : 'Save preferences'}
        </Button>
      </div>
    </div>
  );
}
