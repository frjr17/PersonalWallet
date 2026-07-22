import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';
const styles = cva(
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-jade text-white hover:bg-[#125849]',
        secondary: 'border bg-white/70 hover:bg-white dark:bg-white/10',
        ghost: 'hover:bg-ink/5 dark:hover:bg-white/10',
        danger: 'bg-apricot text-ink hover:bg-[#dc7655]',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof styles> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(styles({ variant }), className)} {...props} />;
}
