'use client';

import { useCallback, useMemo, useState } from 'react';
import { flexRender } from '@tanstack/react-table';
// v9's modern API is a feature/atom rewrite; the shipped legacy entry point
// keeps the stable table API for a plain sortable grid like this one.
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import type { SortingState } from '@tanstack/table-core';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useReservesUsdFormat, useBackendOrderbook, useSodaxContext, type ReserveUsdFormat } from '@sodax/dapp-kit';
import { isTokenAllowed, relayChainName } from '@/lib/config';
import { fmtUsd, fmtPct, fmtAmount, cleanSymbol, fmtDeadline } from '@/lib/format';
import { InstrumentHeader, Section, Note } from '@/components/instrument';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function AnalyticsInstrument() {
  const { sodax } = useSodaxContext();
  const { data: reserves, isLoading } = useReservesUsdFormat();
  const { data: orderbook, isLoading: orderbookLoading } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '16' } },
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'totalLiquidityUSD', desc: true },
  ]);

  const data = useMemo(
    () => (reserves ?? []).filter(r => isTokenAllowed(cleanSymbol(r.symbol))),
    [reserves],
  );

  const columns = useMemo<LegacyColumnDef<ReserveUsdFormat>[]>(
    () => [
      {
        accessorFn: r => cleanSymbol(r.symbol),
        id: 'symbol',
        header: 'Asset',
        cell: info => <span className="text-foreground">{info.getValue<string>()}</span>,
      },
      {
        accessorFn: r => Number(r.priceInUSD),
        id: 'priceInUSD',
        header: 'Price',
        cell: info => fmtUsd(info.getValue<number>()),
      },
      {
        accessorFn: r => Number(r.totalLiquidityUSD),
        id: 'totalLiquidityUSD',
        header: 'Supplied',
        cell: info => fmtUsd(info.getValue<number>(), { compact: true }),
      },
      {
        accessorFn: r => Number(r.supplyAPY),
        id: 'supplyAPY',
        header: 'Supply',
        cell: info => <span className="text-viable">{fmtPct(info.getValue<number>())}</span>,
      },
      {
        accessorFn: r => Number(r.borrowUsageRatio),
        id: 'borrowUsageRatio',
        header: 'Util',
        cell: info => {
          const util = Math.min(1, Math.max(0, info.getValue<number>()));
          return (
            <span className="flex items-center justify-end gap-2">
              <span className="h-[3px] w-6 bg-accent">
                <span
                  className="block h-full bg-grid"
                  style={{ width: `${(util * 100).toFixed(0)}%` }}
                />
              </span>
              <span className="text-muted-foreground">{fmtPct(util, 0)}</span>
            </span>
          );
        },
      },
    ],
    [],
  );

  const table = useLegacyTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const reserveIndex = useMemo(() => {
    const m = new Map<string, { symbol: string; decimals: number }>();
    for (const r of reserves ?? []) {
      m.set(r.underlyingAsset.toLowerCase(), {
        symbol: cleanSymbol(r.symbol),
        decimals: r.decimals,
      });
    }
    return m;
  }, [reserves]);

  /**
   * Intents reference hub asset addresses. Resolve through the SDK's hub-asset
   * registry first, then the reserves. Null means unidentified — the row is
   * hidden, because an unresolved token can't be cleared by the denylist.
   */
  const resolveToken = useCallback(
    (address: string) => {
      const hubToken = sodax.config.getXTokenFromHubAsset(address);
      if (hubToken) {
        return { symbol: cleanSymbol(hubToken.symbol), decimals: hubToken.decimals };
      }
      return reserveIndex.get(address.toLowerCase()) ?? null;
    },
    [sodax, reserveIndex],
  );

  return (
    <>
      <InstrumentHeader title="Analytics">
        <Badge variant="outline" className="gap-1.5 border-flow/45 text-flow">
          <span className="size-1.5 rounded-full bg-flow" />
          Live
        </Badge>
      </InstrumentHeader>

      <Section>
        <InstrumentHeader as="h2" title="Reserves">
          <Badge variant="outline">{data.length}</Badge>
        </InstrumentHeader>
        <Table className="text-[11px]">
          <TableHeader>
            {table.getHeaderGroups().map(hg => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h, i) => (
                  <TableHead
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className={`label-micro h-8 cursor-pointer select-none px-2 ${i > 0 ? 'text-right' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${i > 0 ? 'flex-row-reverse' : ''}`}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === 'asc' ? (
                        <ArrowUp className="size-3" />
                      ) : h.column.getIsSorted() === 'desc' ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-30" />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
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
            {table.getRowModel().rows.map(row => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell, i) => (
                  <TableCell
                    key={cell.id}
                    className={`fig px-2 py-1.5 ${i > 0 ? 'text-right' : ''}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section>
        <InstrumentHeader as="h2" title="Open intents">
          <Badge variant="outline">{orderbook?.total ?? '—'}</Badge>
        </InstrumentHeader>
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-micro h-8">Pair</TableHead>
              <TableHead className="label-micro h-8 text-right">Remaining</TableHead>
              <TableHead className="label-micro h-8 text-right">Route</TableHead>
              <TableHead className="label-micro h-8 text-right">Expiry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderbookLoading && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            )}
            {orderbook?.data.map(o => {
              const input = resolveToken(o.intentData.inputToken);
              const output = resolveToken(o.intentData.outputToken);
              // Fail closed: an unidentified token can't clear the denylist.
              if (!input || !output) return null;
              if (!isTokenAllowed(input.symbol) || !isTokenAllowed(output.symbol)) return null;
              return (
                <TableRow key={o.intentData.intentHash}>
                  <TableCell className="fig py-1.5">
                    {input.symbol}
                    <span className="text-muted-foreground"> → </span>
                    {output.symbol}
                  </TableCell>
                  <TableCell className="fig py-1.5 text-right">
                    {fmtAmount(o.intentState.remainingInput, input.decimals)}
                  </TableCell>
                  <TableCell className="fig py-1.5 text-right text-muted-foreground">
                    {relayChainName(sodax.config, o.intentData.srcChain)}
                    {o.intentData.srcChain !== o.intentData.dstChain &&
                      ` → ${relayChainName(sodax.config, o.intentData.dstChain)}`}
                  </TableCell>
                  <TableCell className="fig py-1.5 text-right text-muted-foreground">
                    {fmtDeadline(o.intentData.deadline, Date.now())}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Section>

      <div className="p-3.5">
        <Note>
          Swaps are intent-based and routed by competing solvers. Every figure here is
          live protocol data.
        </Note>
      </div>
    </>
  );
}
