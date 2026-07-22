import { Inbox } from 'lucide-react';
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center border-y py-8 text-center">
      <Inbox className="mb-3 text-jade" />
      <h2 className="font-display text-lg">{title}</h2>
      <p className="mt-1 max-w-sm text-ink/60 dark:text-white/60">{detail}</p>
    </div>
  );
}
