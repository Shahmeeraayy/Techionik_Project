import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { SettingsSidebar, settingsNavItems } from './Sidebar';
import { SettingsWorkspaceProvider, useSettingsWorkspace } from './WorkspaceProvider';
import { settingsControlButtonClass, settingsIconButtonClass } from './visual';

function SettingsLayoutShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const workspace = useSettingsWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = useMemo(
    () =>
      [...settingsNavItems]
        .sort((a, b) => b.path.length - a.path.length)
        .find((item) => location.pathname === item.path || (item.path !== '/settings' && location.pathname.startsWith(item.path))) ??
      settingsNavItems[0],
    [location.pathname],
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(79,124,255,0.11),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#f7f9fc,#eef3fb)] text-foreground dark:bg-[radial-gradient(circle_at_top_right,rgba(79,124,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#07111f,#040913)]">
      <div className="mx-auto flex min-h-screen max-w-[1800px] lg:p-4">
        <aside className="hidden w-80 shrink-0 lg:flex lg:pr-4">
          <div className="sticky top-4 h-[calc(100vh-2rem)] w-full overflow-hidden rounded-[32px] border border-border/70 bg-background/85 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <SettingsSidebar />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-background/60 lg:rounded-[32px] lg:border lg:border-border/70 lg:shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:backdrop-blur-xl">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/70 bg-background/85 px-4 py-4 backdrop-blur-xl lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className={cn('lg:hidden', settingsIconButtonClass)}
                onClick={() => setMobileOpen(true)}
                aria-label="Open settings navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Settings</p>
                <h1 className="truncate text-lg font-semibold tracking-[-0.03em] sm:text-xl">{currentItem.label}</h1>
                <p className="hidden text-sm text-muted-foreground sm:block">{currentItem.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void workspace.refresh()}
                disabled={workspace.refreshing}
                className={cn('rounded-full', settingsControlButtonClass)}
              >
                <RefreshCw className={cn('h-4 w-4', workspace.refreshing && 'animate-spin')} />
                {workspace.refreshing ? 'Refreshing' : 'Refresh'}
              </Button>
              <Button variant="ghost" size="sm" asChild className={cn('rounded-full', settingsControlButtonClass)}>
                <Link to="/admin">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
              {!workspace.canUseBackend ? (
                <div className="mb-6 rounded-[24px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                  Backend sync is not connected. Local preferences still load, but live sections will remain read-only until an admin token is available.
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100vw,22rem)] p-0">
          <div className="h-full">
            <SettingsSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsWorkspaceProvider>
      <SettingsLayoutShell>{children}</SettingsLayoutShell>
    </SettingsWorkspaceProvider>
  );
}
