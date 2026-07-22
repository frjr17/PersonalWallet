import {
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  Download,
  FolderTree,
  Landmark,
  LayoutDashboard,
  Menu,
  Plus,
  Settings2,
  Upload,
  WalletCards,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
const items = [
  ['/dashboard', 'Today', LayoutDashboard],
  ['/accounts', 'Accounts', WalletCards],
  ['/categories', 'Categories', FolderTree],
  ['/transactions', 'Transactions', CircleDollarSign],
  ['/budgets', 'Budgets', Landmark],
  ['/recurring', 'Recurring', CalendarClock],
  ['/reports', 'Reports', BarChart3],
  ['/imports', 'Import', Upload],
  ['/settings', 'Settings', Settings2],
] as const;
export function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r bg-oat p-5 transition-transform dark:border-white/10 dark:bg-[#0c0f0d] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-10 flex items-center justify-between font-display">
          <span className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-jade text-white">
              <Landmark size={19} />
            </span>
            Personal Ledger
          </span>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>
        <nav className="space-y-1">
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold',
                  isActive ? 'bg-jade text-white' : 'hover:bg-ink/5 dark:hover:bg-white/[.08]',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5">
          <Button asChild className="w-full">
            <NavLink to="/transactions/new">
              <Plus size={18} />
              Add transaction
            </NavLink>
          </Button>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-oat/90 px-4 backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#080a09]/95">
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu />
        </button>
        <span className="font-display">Ledger</span>
        <NavLink to="/settings/backup" aria-label="Backups">
          <Download size={20} />
        </NavLink>
      </header>
      <main className="pb-24 lg:ml-64 lg:pb-8">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-oat/95 p-1 backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#080a09]/95">
        {items.slice(0, 4).map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 rounded-xl py-2 text-[.7rem]',
                isActive ? 'text-jade dark:text-[#75cbb9]' : 'opacity-65',
              )
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/transactions/new"
          className="flex flex-col items-center gap-1 rounded-xl py-2 text-[.7rem] text-apricot"
        >
          <Plus size={20} />
          Add
        </NavLink>
      </nav>
    </div>
  );
}
