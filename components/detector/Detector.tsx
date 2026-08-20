'use client';

import { useEffect, useMemo, useState } from 'react';
import * as echarts from 'echarts/core';
import { LinesChart, EffectScatterChart, ScatterChart } from 'echarts/charts';
import { TooltipComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import { useReservesUsdFormat, useBackendOrderbook, useSodaxContext } from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/types';
import { chainName, isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtUsd } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useFocus } from './focus';

echarts.use([
  LinesChart,
  EffectScatterChart,
  ScatterChart,
  TooltipComponent,
  GridComponent,
  CanvasRenderer,
]);

const TRACK = '#ffd23a'; // hub / accent
const FLOW = '#35d0ff'; // live activity
const STEEL = '#3a5a7a'; // idle chain outline - neutral, NOT the destructive red
const IDLE_FILL = '#22354a';
const INK = '#e6ecf3';
const MUTED = '#93a1b3';
const CARD = '#070a0e';

/** Backend caps out well above the live book; one call returns everything. */
export const ORDERBOOK_LIMIT = '500';
/** Most routes drawn. Beyond this the ring reads as spaghetti, so we take the
 *  busiest and say how many were left out rather than silently truncating. */
const MAX_ROUTES = 60;

const R = 100; // ring radius in chart space
const EXTENT = 152; // axis half-extent; keeps the ring clear of the legend

type ChainPoint = {
  name: string;
  value: [number, number, number];
  symbolSize: number;
  assets: number;
  intents: number;
  hub: boolean;
  itemStyle: {
    color: string;
    borderColor: string;
    borderWidth: number;
    opacity?: number;
  };
  label: { position: 'left' | 'right'; color: string };
};

/**
 * The hub and its spokes, animated with ECharts flow effects rather than drawn
 * as a static picture. The motion encodes data: particles travel only along
 * routes that have live intents, and only chains with activity ripple.
 */
export function Detector() {
  const { sodax } = useSodaxContext();
  const { data: reserves } = useReservesUsdFormat();
  // The whole orderbook, not a sample. At limit 40 the chart drew 3 of the 65
  // live routes and claimed to be showing the orderbook. The backend returns
  // the full set in one call, and the same query key is reused by FillsTape so
  // this is still a single request.
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: ORDERBOOK_LIMIT } },
  });
  const { route } = useFocus();

  // Motion is opt-out, and the reduced-motion build is a genuinely static chart.
  const [hovered, setHovered] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const on = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const spokes = useMemo(
    () =>
      sodax.config.getSupportedSpokeChains().filter(c => c !== ChainKeys.SONIC_MAINNET),
    [sodax],
  );

  const model = useMemo(() => {
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

    // route counts per chain pair, plus per-chain activity and hub-local volume
    const pairs = new Map<string, { from: string; to: string; count: number }>();
    const activity = new Map<string, number>();
    let hubLocal = 0;
    let unresolved = 0;

    for (const o of orderbook?.data ?? []) {
      const s = resolve(sodax, o.intentData.srcChain);
      const t = resolve(sodax, o.intentData.dstChain);
      if (!s || !t) {
        unresolved += 1;
        continue;
      }
      const token = sodax.config.getXTokenFromHubAsset(o.intentData.inputToken);
      if (!token) {
        unresolved += 1;
        continue;
      }
      if (!isTokenAllowed(cleanSymbol(token.symbol))) continue;

      if (s === t) {
        hubLocal += 1;
        activity.set(s, (activity.get(s) ?? 0) + 1);
        continue;
      }
      const key = `${s} ${t}`;
      pairs.set(key, { from: s, to: t, count: (pairs.get(key)?.count ?? 0) + 1 });
      activity.set(s, (activity.get(s) ?? 0) + 1);
      activity.set(t, (activity.get(t) ?? 0) + 1);
    }

    const maxReach = Math.max(...[...reach.values()].map(r => r.usd), 1);
    const pos = new Map<string, [number, number]>();
    const hubName = chainName(ChainKeys.SONIC_MAINNET);
    pos.set(hubName, [0, 0]);

    const idle: ChainPoint[] = [];
    const live: ChainPoint[] = [];

    spokes.forEach((chainKey, i) => {
      const a = (i / spokes.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * R;
      const y = -Math.sin(a) * R;
      const name = chainName(chainKey);
      pos.set(name, [x, y]);

      const r = reach.get(chainKey) ?? { usd: 0, assets: 0 };
      const intents = activity.get(name) ?? 0;
      const lit = route
        ? chainKey === route.srcChainKey || chainKey === route.dstChainKey
        : false;
      const active = intents > 0 || lit;

      const point: ChainPoint = {
        name,
        value: [x, y, r.usd],
        symbolSize: 9 + (Math.sqrt(r.usd) / Math.sqrt(maxReach)) * 17,
        assets: r.assets,
        intents,
        hub: false,
        itemStyle: {
          color: lit ? TRACK : active ? FLOW : IDLE_FILL,
          borderColor: lit ? TRACK : active ? FLOW : STEEL,
          borderWidth: 1,
          opacity: hovered && hovered !== name ? 0.25 : 1,
        },
        // label sits outboard of the ring, so it never lands on a neighbour
        label: { position: x >= 0 ? 'right' : 'left', color: active ? INK : MUTED },
      };
      (active ? live : idle).push(point);
    });

    const hubReach = reach.get(ChainKeys.SONIC_MAINNET) ?? { usd: 0, assets: 0 };
    const hub: ChainPoint = {
      name: hubName,
      value: [0, 0, hubReach.usd],
      symbolSize: 34,
      assets: hubReach.assets,
      intents: hubLocal,
      hub: true,
      itemStyle: { color: TRACK, borderColor: TRACK, borderWidth: 0 },
      label: { position: 'right', color: INK },
    };

    // one animated line per live route, busiest first
    const ranked = [...pairs.values()].sort((a, b) => b.count - a.count);
    const shown = ranked.slice(0, MAX_ROUTES);
    const hiddenRoutes = ranked.length - shown.length;

    /**
     * Every cross-chain intent settles through Sonic, so a route is drawn as
     * source -> hub -> destination rather than as a direct chord. That is both
     * what actually happens and what turns sixty crossing chords into a radial
     * star you can read.
     */
    const flows = shown.map(p => {
      const a = pos.get(p.from) ?? [0, 0];
      const b = pos.get(p.to) ?? [0, 0];
      const viaHub = p.from !== hubName && p.to !== hubName;
      const touches = (c: string | null) => c === p.from || c === p.to;
      const dimmed = hovered !== null && !touches(hovered);

      return {
        coords: viaHub ? [a, [0, 0], b] : [a, b],
        value: p.count,
        from: p.from,
        to: p.to,
        lineStyle: {
          color: p.from === hubName || p.to === hubName ? TRACK : FLOW,
          width: Math.min(2.2, 0.7 + Math.log2(p.count + 1) * 0.5),
          opacity: dimmed ? 0.03 : hovered ? 0.8 : 0.16,
          cap: 'round',
          join: 'round',
        },
      };
    });

    return {
      idle,
      live,
      hub,
      flows,
      hubLocal,
      unresolved,
      hiddenRoutes,
      routeCount: ranked.length,
      counted: (orderbook?.data.length ?? 0) - unresolved,
      total: orderbook?.total ?? 0,
      totalReach: [...reach.values()].reduce((s, r) => s + r.usd, 0),
    };
  }, [reserves, orderbook, sodax, spokes, route, hovered]);

  const option = useMemo(() => {
    const labelBase = {
      show: true,
      distance: 8,
      fontFamily: 'Geist Mono, monospace',
      fontSize: 10,
      formatter: (p: { name: string }) => p.name.toUpperCase(),
    };

    const pointTip = (p: { data: ChainPoint }) => {
      const d = p.data;
      return [
        `<b>${d.name}</b>${d.hub ? ' - hub' : ''}`,
        `reachable ${fmtUsd(d.value[2], { compact: true })}`,
        `${d.assets} assets`,
        d.intents > 0
          ? `${d.intents} open intent${d.intents === 1 ? '' : 's'}`
          : 'no open intents',
      ].join('<br/>');
    };

    return {
      backgroundColor: 'transparent',
      animationDuration: 800,
      animationEasing: 'quinticOut' as const,
      tooltip: {
        backgroundColor: CARD,
        borderColor: '#2c4056',
        borderWidth: 1,
        padding: [8, 10],
        textStyle: { color: INK, fontFamily: 'Geist Mono, monospace', fontSize: 11 },
      },
      xAxis: { type: 'value' as const, min: -EXTENT, max: EXTENT, show: false },
      yAxis: { type: 'value' as const, min: -EXTENT, max: EXTENT, show: false },
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      series: [
        // the routes themselves, faint - the particles carry the eye
        {
          type: 'lines' as const,
          coordinateSystem: 'cartesian2d',
          polyline: true,
          data: model.flows,
          silent: true,
          z: 1,
        },
        // travelling particles: motion only where intents actually flow
        {
          type: 'lines' as const,
          coordinateSystem: 'cartesian2d',
          polyline: true,
          data: model.flows,
          z: 2,
          effect: {
            show: !reduceMotion,
            period: 4.5,
            // staggered, so sixty routes read as traffic rather than a metronome
            delay: (idx: number) => (idx % 9) * 500,
            trailLength: 0.42,
            symbol: 'circle',
            symbolSize: 3,
            loop: true,
          },
          lineStyle: { width: 0, opacity: 0 },
          tooltip: {
            formatter: (p: { data: { from: string; to: string; value: number } }) =>
              `<b>${p.data.from} to ${p.data.to}</b><br/>${p.data.value} open intent${p.data.value === 1 ? '' : 's'}`,
          },
        },
        // idle chains - plain points, so a ripple always means real activity
        {
          type: 'scatter' as const,
          coordinateSystem: 'cartesian2d',
          data: model.idle,
          z: 3,
          label: { ...labelBase },
          tooltip: { formatter: pointTip },
        },
        // chains carrying live intents - rippling
        {
          type: reduceMotion ? ('scatter' as const) : ('effectScatter' as const),
          coordinateSystem: 'cartesian2d',
          data: model.live,
          z: 4,
          rippleEffect: { scale: 3, brushType: 'stroke', period: 3.5 },
          label: { ...labelBase },
          tooltip: { formatter: pointTip },
        },
        // the hub - its ripple carries hub-local intent volume
        {
          type: reduceMotion ? ('scatter' as const) : ('effectScatter' as const),
          coordinateSystem: 'cartesian2d',
          data: [model.hub],
          z: 5,
          rippleEffect: {
            scale: model.hubLocal > 0 ? 3.6 : 2,
            brushType: 'stroke',
            period: 3,
          },
          label: {
            ...labelBase,
            position: 'inside' as const,
            distance: 0,
            fontFamily: 'Archivo, sans-serif',
            fontSize: 10,
            fontWeight: 600,
            color: CARD,
          },
          tooltip: { formatter: pointTip },
        },
      ],
    };
  }, [model, reduceMotion]);

  const onEvents = useMemo(
    () => ({
      mouseover: (p: { seriesType?: string; name?: string }) => {
        if (p.seriesType === 'scatter' || p.seriesType === 'effectScatter') {
          setHovered(p.name ?? null);
        }
      },
      mouseout: () => setHovered(null),
      globalout: () => setHovered(null),
    }),
    [],
  );

  const loading = !reserves && !orderbook;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,#0e141c_0%,var(--background)_70%)]">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Skeleton className="h-[60%] w-[60%] rounded-full" />
        </div>
      ) : (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          onEvents={onEvents}
          style={{ height: '100%', width: '100%' }}
        />
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-[290px] space-y-1.5 border border-border bg-card/85 p-3 backdrop-blur-sm lg:block">
        <div className="label-micro">Reading this</div>
        <LegendRow
          swatch={
            <span className="size-2.5 rounded-full bg-[#22354a] ring-1 ring-[#3a5a7a]" />
          }
        >
          A chain with no open intents right now
        </LegendRow>
        <LegendRow swatch={<span className="size-2.5 rounded-full bg-flow" />}>
          Pulsing, a chain carrying live intents
        </LegendRow>
        <LegendRow swatch={<span className="h-0.5 w-5 bg-flow" />}>
          Every route settles through the hub. Hover a chain to isolate its flow
        </LegendRow>
        <LegendRow swatch={<span className="size-2.5 rounded-full bg-track" />}>
          Sonic, the hub every route settles through
        </LegendRow>
        <div className="fig space-y-0.5 pt-1 text-[11px] text-muted-foreground">
          <div>
            {model.counted} of {model.total} open intents, {model.hubLocal} settling
            on-hub
          </div>
          <div>
            {model.routeCount} cross-chain routes
            {model.hiddenRoutes > 0 && `, ${model.hiddenRoutes} not drawn`}
            {model.unresolved > 0 && `, ${model.unresolved} unreadable`}
          </div>
          <div>{fmtUsd(model.totalReach, { compact: true })} reachable liquidity</div>
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

/** Relay chain ids are not EVM chain ids - always resolve through the SDK. */
function resolve(
  sodax: ReturnType<typeof useSodaxContext>['sodax'],
  relayChainId: number,
): string | null {
  const id = BigInt(relayChainId);
  if (!sodax.config.isValidIntentRelayChainId(id)) return null;
  return chainName(sodax.config.getSpokeChainKeyFromIntentRelayChainId(id));
}
