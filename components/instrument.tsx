'use client';

import { cn } from '@/lib/utils';

export function InstrumentHeader({
  title,
  children,
  as = 'h1',
}: {
  title: string;
  children?: React.ReactNode;
  as?: 'h1' | 'h2';
}) {
  const Heading = as;
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-3.5 py-2.5">
      <Heading className="panel-title text-foreground">{title}</Heading>
      {children}
    </div>
  );
}

export function InstrumentBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-col gap-3.5 p-3.5', className)}>{children}</div>;
}

export function Section({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-border">{children}</div>;
}

/** Label, dotted leader, right-aligned tabular value. */
export function Readout({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <dt className="label-micro shrink-0">{k}</dt>
      <span className="-translate-y-[3px] flex-1 border-b border-dotted border-input" />
      <dd
        className={cn(
          'fig text-right text-xs',
          tone === 'up' && 'text-viable',
          tone === 'down' && 'text-energy',
          !tone && 'text-foreground',
        )}
      >
        {v}
      </dd>
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="label-micro">
      {children}
    </label>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border border-destructive/45 p-2 text-[11px] text-destructive">
      {children}
    </p>
  );
}
