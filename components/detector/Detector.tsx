'use client';

import { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { useReservesUsdFormat, useBackendOrderbook, useSodaxContext } from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/types';
import { chainName, isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtUsd, fmtAmount } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useFocus } from './focus';

echarts.use([GraphChart, TooltipComponent, TitleComponent, CanvasRenderer]);

const TRACK = '#ffd23a';
const FLOW = '#35d0ff';
const GRID = '#3a5a7a';
const INK = '#e6ecf3';
const MUTED = '#93a1b3';
const CARD = '#070a0e';
const ENERGY = '#ff4d4d';

type NodeDatum = {
  name: string;
  x: number;
  y: number;
  value: number;
  symbolSize: number;
  assets: number;
  hub: boolean;
  itemStyle: {
    color: string;
    borderColor: string;
    borderWidth: number;
    opacity?: number;
  };
  label?: Record<string, unknown>;
};

/**
 * The hub and its spokes as a real network graph. Node size is the money-market
 * liquidity a chain can reach; edges are live intents, weighted by remaining
 * amount. Hovering a chain focuses its own flows.
 */
export function Detector() {
  const { sodax } = useSodaxContext();
  const { data: reserves } = useReservesUsdFormat();
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '40' } },
  });
  const { route } = useFocus();

  const spokes = useMemo(
    () =>
      sodax.config.getSupportedSpokeChains().filter(c => c !== ChainKeys.SONIC_MAINNET),
    [sodax],
  );

  const { nodes, links, totalReach, hubLocal } = useMemo(() => {
    const bySymbol = new Map<string, number>();
    for (const r of reserves ?? []) {
      const sym = cleanSymbol(r.symbol);
      if (!isTokenAllowed(sym)) continue;
      bySymbol.set(sym.toUpperCase(), Number(r.totalLiquidityUSD));
    }

    const reach = new Map<string, { usd: number; assets: number }>();
    for (const chainKey of [ChainKeys.SONIC_MAINNET, ...spokes]) {
      const tokens = sodax.config
        .getSupportedMoneyMarketTokensByChainId(chainKey)
        .filter(t => isTokenAllowed(t.symbol) && bySymbol.has(t.symbol.toUpperCase()));
      reach.set(chainKey, {
        usd: tokens.reduce((s, t) => s + bySymbol.get(t.symbol.toUpperCase())!, 0),
        assets: tokens.length,
      });
    }

    const maxReach = Math.max(...[...reach.values()].map(r => r.usd), 1);
    const size = (usd: number, lo: number, hi: number) =>
      usd <= 0 ? lo : lo + (Math.sqrt(usd) / Math.sqrt(maxReach)) * (hi - lo);

    const hubReach = reach.get(ChainKeys.SONIC_MAINNET) ?? { usd: 0, assets: 0 };
    const nodes: NodeDatum[] = [
      {
        name: chainName(ChainKeys.SONIC_MAINNET),
        x: 0,
        y: 0,
        value: hubReach.usd,
        assets: hubReach.assets,
        hub: true,
        symbolSize: 64,
        itemStyle: { color: CARD, borderColor: TRACK, borderWidth: 2 },
        label: {
          show: true,
          position: 'inside',
          color: INK,
          fontFamily: 'Archivo, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.4,
        },
      },
    ];

    spokes.forEach((chainKey, i) => {
      const a = (i / spokes.length) * Math.PI * 2 - Math.PI / 2;
      const r = reach.get(chainKey) ?? { usd: 0, assets: 0 };
      const lit = route
        ? chainKey === route.srcChainKey || chainKey === route.dstChainKey
        : false;
      nodes.push({
        name: chainName(chainKey),
        x: Math.cos(a) * 100,
        y: Math.sin(a) * 100,
        value: r.usd,
        assets: r.assets,
        hub: false,
        symbolSize: size(r.usd, 13, 42),
        itemStyle: {
          color: lit ? TRACK : ENERGY,
          borderColor: lit ? TRACK : '#ff8a8a',
          borderWidth: 1,
          // brightness tracks reachable liquidity, so the ranking reads
          // without hovering every node
          opacity: r.usd > 0 ? 0.42 + 0.58 * (Math.sqrt(r.usd) / Math.sqrt(maxReach)) : 0.3,
        },
      });
    });

    // edges: live intents, weighted by remaining input
    const byPair = new Map<
      string,
      { source: string; target: string; count: number; amount: string }
    >();
    let hubLocal = 0;
    for (const o of orderbook?.data ?? []) {
      const s = resolve(sodax, o.intentData.srcChain);
      const t = resolve(sodax, o.intentData.dstChain);
      if (!s || !t) continue;
      if (s === t) {
        hubLocal += 1;
        continue;
      }
      const token = sodax.config.getXTokenFromHubAsset(o.intentData.inputToken);
      if (!token || !isTokenAllowed(cleanSymbol(token.symbol))) continue;

      const key = `${s}→${t}`;
      const prev = byPair.get(key);
      byPair.set(key, {
        source: s,
        target: t,
        count: (prev?.count ?? 0) + 1,
        amount: `${fmtAmount(o.intentState.remainingInput, token.decimals)} ${cleanSymbol(token.symbol)}`,
      });
    }

    const links = [...byPair.values()].map(l => ({
      source: l.source,
      target: l.target,
      value: l.count,
      amount: l.amount,
      lineStyle: {
        color: l.source === chainName(ChainKeys.SONIC_MAINNET) ? TRACK : FLOW,
        width: Math.min(4, 1 + Math.log2(l.count + 1)),
        opacity: 0.85,
        curveness: 0.22,
      },
    }));

    return {
      nodes,
      links,
      hubLocal,
      totalReach: [...reach.values()].reduce((s, r) => s + r.usd, 0),
    };
  }, [reserves, orderbook, sodax, spokes, route]);

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      animationDuration: 900,
      animationEasing: 'quinticOut' as const,
      tooltip: {
        backgroundColor: CARD,
        borderColor: '#2c4056',
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: INK, fontFamily: 'Geist Mono, monospace', fontSize: 11 },
        formatter: (p: {
          dataType: string;
          data: Record<string, unknown>;
          name: string;
        }) => {
          if (p.dataType === 'edge') {
            const d = p.data as { source: string; target: string; value: number };
            return `<b>${d.source} → ${d.target}</b><br/>${d.value} open intent${d.value === 1 ? '' : 's'}`;
          }
          const d = p.data as unknown as NodeDatum;
          return [
            `<b>${d.name}</b>${d.hub ? ' · hub' : ''}`,
            `reachable ${fmtUsd(d.value, { compact: true })}`,
            `${d.assets} assets`,
          ].join('<br/>');
        },
      },
      series: [
        {
          type: 'graph' as const,
          layout: 'none' as const,
          coordinateSystem: undefined,
          roam: true,
          draggable: false,
          data: nodes,
          links,
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 6,
          focusNodeAdjacency: true,
          emphasis: {
            focus: 'adjacency' as const,
            scale: 1.06,
            lineStyle: { width: 3, opacity: 1 },
            label: { color: INK },
          },
          blur: { itemStyle: { opacity: 0.18 }, lineStyle: { opacity: 0.06 } },
          label: {
            show: true,
            position: 'right' as const,
            distance: 7,
            color: MUTED,
            fontFamily: 'Geist Mono, monospace',
            fontSize: 10,
            formatter: (p: { name: string }) => p.name.toUpperCase(),
          },
          lineStyle: { color: GRID, curveness: 0.22 },
          zoom: 0.82,
          scaleLimit: { min: 0.6, max: 3 },
        },
      ],
    }),
    [nodes, links],
  );

  const loading = !reserves && !orderbook;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(ellipse_70%_70%_at_50%_50%,#0e141c_0%,var(--background)_65%)]">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Skeleton className="h-[70%] w-[70%] rounded-full" />
        </div>
      ) : (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          style={{ height: '100%', width: '100%' }}
        />
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-[280px] space-y-1.5 border border-border bg-card/85 p-3 backdrop-blur-sm lg:block">
        <div className="label-micro">Reading this</div>
        <LegendRow swatch={<span className="size-2.5 rounded-full bg-energy" />}>
          Each node is a chain — size is liquidity it can reach
        </LegendRow>
        <LegendRow swatch={<span className="h-0.5 w-5 bg-track" />}>
          An edge is open intents flowing between two chains
        </LegendRow>
        <LegendRow
          swatch={<span className="size-2.5 rounded-full border-2 border-track" />}
        >
          Sonic is the hub every route settles through
        </LegendRow>
        <div className="fig pt-1 text-[11px] text-muted-foreground">
          {fmtUsd(totalReach, { compact: true })} reachable · {links.length} cross-chain
          {hubLocal > 0 && ` · ${hubLocal} on-hub`}
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  swatch,
  children,
}: {
  swatch: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] leading-tight text-muted-foreground">
      <span className="flex w-5 shrink-0 justify-center">{swatch}</span>
      <span>{children}</span>
    </div>
  );
}

/** Relay chain ids are not EVM chain ids — always resolve through the SDK. */
function resolve(
  sodax: ReturnType<typeof useSodaxContext>['sodax'],
  relayChainId: number,
): string | null {
  const id = BigInt(relayChainId);
  if (!sodax.config.isValidIntentRelayChainId(id)) return null;
  return chainName(sodax.config.getSpokeChainKeyFromIntentRelayChainId(id));
}
