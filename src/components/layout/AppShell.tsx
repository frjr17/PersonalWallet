import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  ChartLine,
  CalendarClock,
  FileUp,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
  Target,
  Wallet,
  DatabaseBackup,
  Shapes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAuth } from '@/features/authentication/AuthProvider';
import { OfflineNotice } from '@/features/settings/OfflineNotice';

const primaryNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/recurring', label: 'Recurring', icon: CalendarClock },
  { to: '/reports', label: 'Reports', icon: ChartLine },
] as const;

const secondaryNav = [
  { to: '/categories', label: 'Categories', icon: Shapes },
  { to: '/imports', label: 'Import CSV', icon: FileUp },
  { to: '/settings/backup', label: 'Backup', icon: DatabaseBackup },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

function OnlineDot() {
  const online = useOnlineStatus();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <span
        aria-hidden="true"
        className={cn('size-2 rounded-full', online ? 'bg-income' : 'bg-expense')}
      />
      {online ? 'Online' : 'Offline — changes will sync'}
    </span>
  );
}

function SidebarLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/settings'}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/60',
          isActive
            ? 'bg-accent text-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-full before:bg-primary'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}

export function AppShell() {
  const { user, signOutUser } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh md:flex">
      <OfflineNotice />
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r bg-card md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <img src="/icon.svg" alt="" className="size-8" />
          <span className="font-display text-lg font-semibold tracking-tight">Pocket Ledger</span>
        </div>
        <div className="px-3">
          <Button className="w-full" onClick={() => navigate('/transactions/new')}>
            <Plus /> New transaction
          </Button>
        </div>
        <nav aria-label="Main" className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {primaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
          <div className="my-3 border-t" />
          {secondaryNav.map((item) => (
            <SidebarLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{user?.displayName ?? user?.email}</p>
            <OnlineDot />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={() => void signOutUser()}
          >
            <LogOut />
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="" className="size-7" />
          <span className="font-display font-semibold">Pocket Ledger</span>
        </div>
        <OnlineDot />
      </header>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <Outlet />
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5 items-end">
          {primaryNav.slice(0, 2).map((item) => (
            <MobileLink key={item.to} {...item} />
          ))}
          <div className="flex justify-center">
            <Button
              size="icon"
              aria-label="New transaction"
              className="-mt-5 size-12 rounded-full shadow-lg"
              onClick={() => navigate('/transactions/new')}
            >
              <Plus className="size-5" />
            </Button>
          </div>
          <MobileLink to="/transactions" label="Records" icon={ArrowLeftRight} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
                <MoreHorizontal className="size-5" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              <DropdownMenuItem onSelect={() => navigate('/budgets')}>
                <Target /> Budgets
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/recurring')}>
                <CalendarClock /> Recurring
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/reports')}>
                <ChartLine /> Reports
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/categories')}>
                <Shapes /> Categories
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/imports')}>
                <FileUp /> Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/settings/backup')}>
                <DatabaseBackup /> Backup
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/settings')}>
                <Settings /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOutUser()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}

function MobileLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 py-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          isActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  );
}
