import {
  Baby,
  Banknote,
  BriefcaseBusiness,
  Car,
  Clapperboard,
  CreditCard,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PawPrint,
  PiggyBank,
  Plane,
  ReceiptText,
  Repeat2,
  RotateCcw,
  Shapes,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { normalizeCategoryIcon, type CategoryIconId } from '@/lib/categoryIcons';

const categoryIconComponents: Readonly<Record<CategoryIconId, LucideIcon>> = {
  general: Shapes,
  home: House,
  groceries: ShoppingCart,
  dining: Utensils,
  transport: Car,
  utilities: Zap,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Clapperboard,
  subscriptions: Repeat2,
  'personal-care': Sparkles,
  gift: Gift,
  salary: Banknote,
  freelance: BriefcaseBusiness,
  interest: PiggyBank,
  refund: RotateCcw,
  shopping: ShoppingBag,
  travel: Plane,
  pets: PawPrint,
  insurance: ShieldCheck,
  taxes: ReceiptText,
  debt: CreditCard,
  childcare: Baby,
  sports: Dumbbell,
};

export function CategoryIcon({
  icon,
  size = 18,
  strokeWidth = 1.8,
  className,
}: {
  icon?: CategoryIconId | string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Icon = categoryIconComponents[normalizeCategoryIcon(icon)];
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={strokeWidth} />;
}
