'use client';

import { useMemo, useState } from 'react';
import { useReservesUsdFormat, type ReserveUsdFormat } from '@sodax/dapp-kit';
import { isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtPct, fmtUsd } from '@/lib/format';
import { MMSheet } from './MMSheet';
import { StakingPanel } from './StakingPanel';
import { InstrumentHeader, Section } from '@/components/instrument';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function EarnInstrument() {
  const { data: reserves, isLoading } = useReservesUsdFormat();
  const [selected, setSelected] = useState<ReserveUsdFormat | null>(null);

  const markets = useMemo(() => {
    if (!reserves) return [];
    return reserves
      .filter(r => isTokenAllowed(cleanSymbol(r.symbol)))
      .slice()
      .sort((a, b) => Number(b.supplyAPY) - Number(a.supplyAPY));
  }, [reserves]);

  return (
    <>
      <InstrumentHeader title="Earn">
        <Badge variant="outline" className="gap-1.5 border-flow/45 text-flow">
          <span className="size-1.5 rounded-full bg-flow" />
          Live
        </Badge>
      </InstrumentHeader>

      <Table className="text-xs">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="label-micro h-8">Asset</TableHead>
            <TableHead className="label-micro h-8 text-right">Supply</TableHead>
            <TableHead className="label-micro h-8 text-right">Borrow</TableHead>
            <TableHead className="label-micro h-8 text-right">Supplied</TableHead>
            <TableHead className="h-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {markets.map(r => (
            <TableRow key={r.underlyingAsset}>
              <TableCell className="fig py-1.5">{cleanSymbol(r.symbol)}</TableCell>
              <TableCell className="fig py-1.5 text-right text-viable">
                {fmtPct(r.supplyAPY)}
              </TableCell>
              <TableCell className="fig py-1.5 text-right">
                {fmtPct(r.variableBorrowAPY)}
              </TableCell>
              <TableCell className="fig py-1.5 text-right text-muted-foreground">
                {fmtUsd(r.totalLiquidityUSD, { compact: true })}
              </TableCell>
              <TableCell className="py-1.5 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  className="label-micro h-6 px-2"
                  onClick={() => setSelected(r)}
                >
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Section>
        <StakingPanel />
      </Section>

      {selected && <MMSheet reserve={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
