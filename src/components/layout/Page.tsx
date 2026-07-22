import type { ReactNode } from 'react';
export function Page({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[90rem] p-4 sm:p-7 lg:p-10">
      <header className="mb-7 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
