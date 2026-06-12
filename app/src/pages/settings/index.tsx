import { Moon, Laptop, SunMedium } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/settings/SectionCard';
import { useSettingsWorkspace } from '@/components/settings/WorkspaceProvider';
import { settingsControlButtonClass } from '@/components/settings/visual';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

const themeOptions = [
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'light' as const, label: 'Light', icon: SunMedium },
  { value: 'system' as const, label: 'System', icon: Laptop },
];

function MetricCard({
  title,
  value,
  description,
  loading,
  className,
}: {
  title: string;
  value: string;
  description: string;
  loading: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden rounded-[28px] border-0 shadow-[0_20px_60px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      <CardContent className="p-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/65">
          {title}
        </p>
        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-12 w-24 bg-white/20" />
          ) : (
            <p className="text-4xl font-semibold tracking-[-0.05em]">{value}</p>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-white/75">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function SettingsGeneralPage() {
  const workspace = useSettingsWorkspace();
  const { theme, setTheme } = useTheme();

  const activeRules = workspace.priorityRules.filter((rule) => rule.is_active);
  const rankingRulesCount = workspace.priorityRules.length;
  const activeImpact = activeRules.reduce((total, rule) => total + Number(rule.ranking_score || 0), 0);
  const activePartners = workspace.dealerships.filter((location) => location.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Ranking rules"
          value={String(rankingRulesCount)}
          description="Rules currently shaping the dispatch queue."
          loading={workspace.loading}
          className="bg-[linear-gradient(135deg,#0f172a,#1e293b)]"
        />
        <MetricCard
          title="Active impact"
          value={`+${activeImpact} pts`}
          description="Total scoring weight from enabled rules."
          loading={workspace.loading}
          className="bg-[linear-gradient(135deg,#0f766e,#14b8a6)]"
        />
        <MetricCard
          title="Partners"
          value={String(activePartners)}
          description="Active locations currently connected to the workspace."
          loading={workspace.loading}
          className="bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)]"
        />
      </div>

      <SectionCard
        title="Theme"
        description="Choose how the settings workspace should look on this device."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;

            return (
              <Button
                key={option.value}
                type="button"
                variant={isActive ? 'default' : 'ghost'}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'h-auto justify-start rounded-[24px] px-4 py-4 text-left',
                  isActive
                    ? 'bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
                    : settingsControlButtonClass,
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
                    isActive
                      ? 'border-white/15 bg-white/10 text-white'
                      : 'border-border/70 bg-muted text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span
                    className={cn(
                      'mt-1 block text-xs leading-5',
                      isActive ? 'text-white/70' : 'text-muted-foreground',
                    )}
                  >
                    {isActive ? 'Active theme' : 'Apply this color mode'}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="outline" className="rounded-full">
            Current: {theme}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Saved locally
          </Badge>
        </div>
      </SectionCard>
    </div>
  );
}
