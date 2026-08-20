'use client';

import { useState } from 'react';
import type { XToken } from '@sodax/types';
import { ChevronDown } from 'lucide-react';
import { chainName } from '@/lib/config';
import { tokenKey, tokenLogo } from '@/lib/tokens';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function TokenPicker({
  label,
  tokens,
  selected,
  onSelect,
}: {
  label: string;
  tokens: XToken[];
  selected: XToken | null;
  onSelect: (t: XToken) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="flex h-full shrink-0 items-center gap-2 border-l border-input px-3 text-left transition-colors hover:bg-secondary"
        aria-label={selected ? `${selected.symbol} — change token` : `Select ${label}`}
      >
        {selected ? (
          <>
            <TokenMark token={selected} />
            <span className="flex flex-col leading-tight">
              <span className="fig text-xs text-foreground">{selected.symbol}</span>
              <span className="label-micro">{chainName(selected.chainKey)}</span>
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Select {label}</span>
        )}
        <ChevronDown className="size-3.5 opacity-60" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[300px] p-0">
        <Command
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search token or chain" />
          <CommandList>
            <CommandEmpty>No matching token.</CommandEmpty>
            <CommandGroup>
              {tokens.slice(0, 300).map(t => (
                <CommandItem
                  key={tokenKey(t)}
                  value={`${t.symbol} ${chainName(t.chainKey)}`}
                  onSelect={() => {
                    onSelect(t);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <TokenMark token={t} />
                  <span className="fig text-xs">{t.symbol}</span>
                  <span className="label-micro ml-auto">{chainName(t.chainKey)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TokenMark({ token, size = 18 }: { token: XToken; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tokenLogo(token.symbol)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full bg-accent"
      style={{ width: size, height: size }}
      onError={e => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}
