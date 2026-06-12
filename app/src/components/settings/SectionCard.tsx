import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function SectionCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <Card className={cn('gap-0 rounded-[28px] border-border/70 bg-background/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl', className)}>
      <CardHeader className="border-b border-border/60 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold tracking-[-0.03em]">{title}</CardTitle>
            {description ? (
              <CardDescription className="max-w-2xl text-sm leading-6">{description}</CardDescription>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-6 pt-6', bodyClassName)}>{children}</CardContent>
      {footer ? <CardFooter className="border-t border-border/60 pt-5">{footer}</CardFooter> : null}
    </Card>
  );
}

