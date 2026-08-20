'use client';

import { ArrowLeftRight, Layers, Wallet, Radar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export const INSTRUMENTS = ['Trade', 'Earn', 'Portfolio', 'Analytics'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

const GLYPH = {
  Trade: ArrowLeftRight,
  Earn: Layers,
  Portfolio: Wallet,
  Analytics: Radar,
} as const;

export function InstrumentRail({
  active,
  onSelect,
}: {
  active: Instrument;
  onSelect: (i: Instrument) => void;
}) {
  return (
    <nav
      aria-label="Instruments"
      className="flex h-full flex-col items-center gap-1 border-r border-border bg-card pt-3"
    >
      {INSTRUMENTS.map(name => {
        const Glyph = GLYPH[name];
        const isActive = active === name;
        return (
          <Tooltip key={name}>
            <TooltipTrigger
              onClick={() => onSelect(name)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative grid size-10 place-items-center rounded-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {isActive && (
                <span className="absolute inset-y-2 left-0 w-0.5 bg-primary" />
              )}
              <Glyph className="size-[18px]" strokeWidth={1.5} />
              <span className="sr-only">{name}</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="label-micro text-foreground">
              {name}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
