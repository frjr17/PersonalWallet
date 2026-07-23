import {
  Briefcase,
  Bus,
  Clapperboard,
  CircleDollarSign,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Percent,
  Plug,
  RefreshCcw,
  ShoppingCart,
  Sparkles,
  Undo2,
  UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  housing: Home,
  groceries: ShoppingCart,
  restaurants: UtensilsCrossed,
  transportation: Bus,
  utilities: Plug,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Clapperboard,
  subscriptions: RefreshCcw,
  'personal-care': Sparkles,
  gifts: Gift,
  salary: Briefcase,
  freelance: Laptop,
  interest: Percent,
  refund: Undo2,
  other: CircleDollarSign,
};

export const categoryIconNames = Object.keys(icons);

export function CategoryIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = icons[icon ?? 'other'] ?? CircleDollarSign;
  return <Icon className={cn('size-4', className)} aria-hidden="true" />;
}
