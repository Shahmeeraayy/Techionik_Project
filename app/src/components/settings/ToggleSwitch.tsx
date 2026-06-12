import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type ToggleSwitchProps = {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: ReactNode;
  className?: string;
};

export function ToggleSwitch({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  badge,
  className,
}: ToggleSwitchProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-background/70 px-4 py-4 transition-colors', className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

