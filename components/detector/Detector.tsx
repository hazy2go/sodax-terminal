'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, createScope, stagger, svg, type Scope } from 'animejs';
import { useReservesUsdFormat, useBackendOrderbook, useSodaxContext } from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/types';
import type { SpokeChainKey } from '@sodax/types';
import { chainName, isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtUsd, fmtAmount } from '@/lib/format';

import {
  BOX_W,
  BOX_H,
  CX,
  CY,
  CORE_R,
  HUB,
  ringRadius,
  polar,
  trackPath,
  angleFromHash,
  logScale,
  hubLoopPath,
} from './geometry';
import { useFocus } from './focus';

type Callout = { x: number; y: number; rows: [string, string][] } | null;

type Bar = {
  key: string;
  ring: number;
  deg: number;
  len: number;
  symbol: string;
  usd: number;
  chainKey: SpokeChainKey;
};

type Track = {
  key: string;
  d: string;
  tone: 'y' | 'c';
  from: string;
  to: string;
  amount: string;
};

export function Detector() {
  const { sodax } = useSodaxContext();

  /** Sonic is the beamline; every other supported spoke chain is a ring outward. */
  const { spokes, ringOf } = useMemo(() => {
    const list = sodax.config
      .getSupportedSpokeChains()
      .filter(c => c !== ChainKeys.SONIC_MAINNET);
    return {
      spokes: list,
      ringOf: new Map<string, number>(list.map((c, i) => [c, i])),
    };
  }, [sodax]);
  const { data: reserves } = useReservesUsdFormat();
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '26' } },
  });
  const { route } = useFocus();

  const rootRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<Scope | null>(null);
  const [callout, setCallout] = useState<Callout>(null);

  /* ---- calorimeter bars: which assets each chain can source ---- */
  const bars = useMemo<Bar[]>(() => {
    if (!reserves) return [];
    const bySymbol = new Map<string, number>();
    for (const r of reserves) {
      const sym = cleanSymbol(r.symbol);
      if (!isTokenAllowed(sym)) continue;
      bySymbol.set(sym.toUpperCase(), Number(r.totalLiquidityUSD));
    }
    const max = Math.max(...bySymbol.values(), 1);

    const out: Bar[] = [];
    for (const chainKey of spokes) {
      const ring = ringOf.get(chainKey)!;
      const tokens = sodax.config
        .getSupportedMoneyMarketTokensByChainId(chainKey)
        .filter(t => isTokenAllowed(t.symbol));
      // spread across the right arc, where the comp puts the wedges
      const span = 54;
      // each ring's wedge group is nudged around the right arc so the groups
      // read as a field rather than as concentric collinear rows
      const start = 58 + ((ring * 7) % 26);
      tokens.forEach((t, i) => {
        const usd = bySymbol.get(t.symbol.toUpperCase());
        if (usd === undefined) return;
        const deg =
          tokens.length > 1
            ? start + (i * span) / (tokens.length - 1)
            : start + span / 2 + ((ring % 5) - 2) * 4;
        out.push({
          key: `${chainKey}-${t.address}`,
          ring,
          deg,
          len: logScale(usd, max, 34),
          symbol: t.symbol,
          usd,
          chainKey,
        });
      });
    }
    return out;
  }, [reserves, sodax, spokes, ringOf]);

  /* ---- live intent tracks: real routes from the orderbook ---- */
  const tracks = useMemo<Track[]>(() => {
    if (!orderbook) return [];
    const out: Track[] = [];
    for (const o of orderbook.data) {
      const src = relayToRing(sodax, ringOf, o.intentData.srcChain);
      const dst = relayToRing(sodax, ringOf, o.intentData.dstChain);
      if (src === null || dst === null) continue;

      const token = sodax.config.getXTokenFromHubAsset(o.intentData.inputToken);
      if (!token || !isTokenAllowed(cleanSymbol(token.symbol))) continue;

      const hash = o.intentData.intentHash;
      const sameRing = src.ring === dst.ring;
      out.push({
        key: hash,
        d: sameRing
          ? hubLoopPath(angleFromHash(hash, 360))
          : trackPath(
              src.ring,
              angleFromHash(hash, 300, 30),
              dst.ring,
              angleFromHash(hash + 'd', 300, 30),
            ),
        tone: angleFromHash(hash + 'tone', 2) < 1 ? 'y' : 'c',
        from: src.name,
        to: dst.name,
        amount: `${fmtAmount(o.intentState.remainingInput, token.decimals)} ${cleanSymbol(token.symbol)}`,
      });
    }
    return out.slice(0, 30);
  }, [orderbook, sodax, ringOf]);

  /* ---- the route the trade form is composing ---- */
  const focusTrack = useMemo(() => {
    if (!route) return null;
    const s =
      route.srcChainKey === ChainKeys.SONIC_MAINNET ? HUB : ringOf.get(route.srcChainKey);
    const d =
      route.dstChainKey === ChainKeys.SONIC_MAINNET ? HUB : ringOf.get(route.dstChainKey);
    if (s === undefined || d === undefined) return null;
    return trackPath(s, 318, d, 42);
  }, [route, ringOf]);

  const hubTvl = useMemo(() => {
    if (!reserves) return null;
    return reserves.reduce((sum, r) => sum + Number(r.totalLiquidityUSD), 0);
  }, [reserves]);

  /* ---- the event bloom: the one authored moment ---- */
  const bloomed = useRef(false);
  const ready = bars.length > 0 || tracks.length > 0;
  useEffect(() => {
    if (!rootRef.current || bloomed.current || !ready) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bloomed.current = true;
      return;
    }
    bloomed.current = true;

    scopeRef.current = createScope({ root: rootRef.current }).add(() => {
      animate('.js-core', {
        scale: [0.55, 1],
        opacity: [0, 1],
        duration: 700,
        ease: 'outExpo',
      });

      // Rings animate from an already-visible default — a failed or
      // interrupted animation must never leave the diagram blank.
      animate('.js-ring', {
        opacity: [0.25, 1],
        scale: [0.93, 1],
        duration: 900,
        delay: stagger(46),
        ease: 'outExpo',
      });

      const paths = svg.createDrawable('.js-track');
      animate(paths, {
        draw: ['0.5 0.5', '0 1'],
        duration: 1150,
        delay: stagger(34, { start: 340 }),
        ease: 'outExpo',
      });

      animate('.js-bar', {
        scaleX: [0, 1],
        duration: 620,
        delay: stagger(7, { start: 520 }),
        ease: 'outExpo',
      });

      animate('.js-ringlabel', {
        opacity: [0, 1],
        duration: 500,
        delay: stagger(40, { start: 420 }),
        ease: 'outExpo',
      });
    });

    return () => {
      scopeRef.current?.revert();
      scopeRef.current = null;
    };
  }, [ready]);

  const loading = !reserves && !orderbook;

  return (
    <div className="event" ref={rootRef}>
      <svg
        className="event-svg"
        viewBox={`0 0 ${BOX_W} ${BOX_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
          aria-label={`Detector cross-section: Sonic hub with ${spokes.length} spoke chains and ${tracks.length} open intents`}
      >
        {/* chain rings */}
        <g>
          {spokes.map((chainKey, i) => (
            <circle
              key={chainKey}
              className="ring-track js-ring"
              cx={CX}
              cy={CY}
              r={ringRadius(i)}
            />
          ))}
        </g>

        {/* calorimeter bars — asset liquidity, by the chain that can source it */}
        <g>
          {bars.map(b => {
            const r = ringRadius(b.ring) + 4;
            return (
              <g
                key={b.key}
                transform={`translate(${CX} ${CY}) rotate(${b.deg - 90})`}
              >
                <rect
                  className="calo js-bar"
                  x={r}
                  y={-1.6}
                  width={b.len}
                  height={3.2}
                  style={{ transformOrigin: `${r}px 0px` }}
                  onMouseEnter={() => {
                    const p = polar(r + b.len, b.deg);
                    setCallout({
                      x: (p.x / BOX_W) * 100,
                      y: (p.y / BOX_H) * 100,
                      rows: [
                        ['asset', b.symbol],
                        ['supplied', fmtUsd(b.usd, { compact: true })],
                        ['sourceable', chainName(b.chainKey)],
                      ],
                    });
                  }}
                  onMouseLeave={() => setCallout(null)}
                />
              </g>
            );
          })}
        </g>

        {/* live intent tracks */}
        <g>
          {tracks.map(t => (
            <path
              key={t.key}
              className={`intent-track js-track ${t.tone}`}
              d={t.d}
              onMouseEnter={() =>
                setCallout({
                  x: 62,
                  y: 12,
                  rows: [
                    ['route', `${t.from} → ${t.to}`],
                    ['remaining', t.amount],
                    ['state', 'open'],
                  ],
                })
              }
              onMouseLeave={() => setCallout(null)}
            />
          ))}
        </g>

        {/* the route being composed in the trade form */}
        {focusTrack && (
          <path
            className="intent-track"
            d={focusTrack}
            stroke="var(--track-yellow)"
            strokeWidth={2.2}
            strokeDasharray={route?.state === 'quoting' ? '5 6' : undefined}
            opacity={route?.state === 'quoting' ? 0.75 : 1}
          />
        )}

        {/* chain labels up the beam axis — one row per ring, never colliding */}
        <g>
          {spokes.map((chainKey, i) => {
            const p = polar(ringRadius(i), 0);
            const lit = route
              ? chainKey === route.srcChainKey || chainKey === route.dstChainKey
              : false;
            return (
              <text
                key={chainKey}
                className={`ring-label js-ringlabel${lit ? ' lit' : ''}`}
                x={p.x - 9}
                y={p.y + 3}
                textAnchor="end"
              >
                {chainName(chainKey)}
              </text>
            );
          })}
        </g>

        {/* beamline core */}
        <g className="js-core" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <circle className="core-plate" cx={CX} cy={CY} r={CORE_R} />
          <circle className="core-ring" cx={CX} cy={CY} r={CORE_R - 7} />
          <text className="core-label" x={CX} y={CY - 4}>
            SONIC
          </text>
          <text className="core-fig" x={CX} y={CY + 13}>
            {hubTvl ? fmtUsd(hubTvl, { compact: true }) : '—'}
          </text>
        </g>
      </svg>

      {callout && (
        <div
          className="callout"
          style={{
            left: `${Math.min(callout.x, 68)}%`,
            top: `${Math.min(callout.y, 82)}%`,
          }}
        >
          {callout.rows.map(([k, v]) => (
            <div className="callout-row" key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="event-empty">Acquiring detector data…</div>}
    </div>
  );
}

/** Relay chain ids are not EVM chain ids — always resolve through the SDK. */
function relayToRing(
  sodax: ReturnType<typeof useSodaxContext>['sodax'],
  ringOf: Map<string, number>,
  relayChainId: number,
): { ring: number; name: string } | null {
  const id = BigInt(relayChainId);
  if (!sodax.config.isValidIntentRelayChainId(id)) return null;
  const key = sodax.config.getSpokeChainKeyFromIntentRelayChainId(id);
  if (key === ChainKeys.SONIC_MAINNET) return { ring: HUB, name: chainName(key) };
  const ring = ringOf.get(key);
  if (ring === undefined) return null;
  return { ring, name: chainName(key) };
}
