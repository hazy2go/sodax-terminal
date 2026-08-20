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
  R_INNER,
  R_OUTER,
  makeAxis,
  polar,
  valueRadius,
  sector,
  arcPath,
  trackPath,
  hubTick,
  angleFromHash,
} from './geometry';
import { useFocus } from './focus';

type Callout = { x: number; y: number; rows: [string, string][] } | null;

type Bar = {
  key: string;
  start: number;
  end: number;
  r: number;
  usd: number;
  assets: number;
  top: string;
  chainKey: SpokeChainKey;
  chain: string;
};

type Track = {
  key: string;
  d: string | null;
  tick: { x1: number; y1: number; x2: number; y2: number } | null;
  tone: 'y' | 'c';
  from: string;
  to: string;
  amount: string;
  end: { x: number; y: number } | null;
};

export function Detector() {
  const { sodax } = useSodaxContext();
  const { data: reserves } = useReservesUsdFormat();
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '26' } },
  });
  const { route } = useFocus();

  const rootRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<Scope | null>(null);
  const [callout, setCallout] = useState<Callout>(null);

  /** Sonic is the beamline; every other supported spoke chain owns a sector. */
  const { spokes, sectorOf } = useMemo(() => {
    const list = sodax.config
      .getSupportedSpokeChains()
      .filter(c => c !== ChainKeys.SONIC_MAINNET);
    return { spokes: list, sectorOf: new Map<string, number>(list.map((c, i) => [c, i])) };
  }, [sodax]);

  /**
   * One wedge per chain. Length is the total money-market liquidity that chain
   * can actually reach — the sum over the assets it supports. Drawing a bar per
   * asset instead repeated the same protocol-wide figures in every sector, which
   * encoded nothing: 103 marks that all said the same thing.
   */
  const bars = useMemo<{ list: Bar[]; axis: ReturnType<typeof makeAxis> }>(() => {
    const empty = { list: [] as Bar[], axis: makeAxis([]) };
    if (!reserves) return empty;
    const bySymbol = new Map<string, number>();
    for (const r of reserves) {
      const sym = cleanSymbol(r.symbol);
      if (!isTokenAllowed(sym)) continue;
      bySymbol.set(sym.toUpperCase(), Number(r.totalLiquidityUSD));
    }

    const totals = spokes.map(chainKey => {
      const tokens = sodax.config
        .getSupportedMoneyMarketTokensByChainId(chainKey)
        .filter(t => isTokenAllowed(t.symbol) && bySymbol.has(t.symbol.toUpperCase()));
      return tokens.reduce((sum, t) => sum + bySymbol.get(t.symbol.toUpperCase())!, 0);
    });
    const axis = makeAxis(totals);

    const list = spokes.map((chainKey, i) => {
      const s = sector(i, spokes.length);
      const tokens = sodax.config
        .getSupportedMoneyMarketTokensByChainId(chainKey)
        .filter(t => isTokenAllowed(t.symbol) && bySymbol.has(t.symbol.toUpperCase()));

      let usd = 0;
      let top = '—';
      let topUsd = -1;
      for (const t of tokens) {
        const v = bySymbol.get(t.symbol.toUpperCase())!;
        usd += v;
        if (v > topUsd) {
          topUsd = v;
          top = t.symbol;
        }
      }

      return {
        key: chainKey,
        start: s.start,
        end: s.end,
        r: valueRadius(usd, axis),
        usd,
        assets: tokens.length,
        top,
        chainKey,
        chain: chainName(chainKey),
      };
    });
    return { list, axis };
  }, [reserves, sodax, spokes]);

  const { list: barList, axis } = bars;

  /* ---- live intent tracks between named sectors ---- */
  const tracks = useMemo<Track[]>(() => {
    if (!orderbook) return [];
    const out: Track[] = [];
    for (const o of orderbook.data) {
      const src = resolve(sodax, sectorOf, spokes.length, o.intentData.srcChain);
      const dst = resolve(sodax, sectorOf, spokes.length, o.intentData.dstChain);
      if (!src || !dst) continue;

      const token = sodax.config.getXTokenFromHubAsset(o.intentData.inputToken);
      if (!token || !isTokenAllowed(cleanSymbol(token.symbol))) continue;

      const hash = o.intentData.intentHash;
      const hubLocal = src.hub && dst.hub;
      const remaining = Number(o.intentState.remainingInput) / 10 ** token.decimals;
      const srcR = src.hub ? CORE_R + 8 : R_OUTER - 16;
      const dstR = dst.hub ? CORE_R + 8 : R_OUTER - 16;

      out.push({
        key: hash,
        end: hubLocal ? null : polar(dstR, dst.deg),
        tick: hubLocal
          ? hubTick(angleFromHash(hash, 360), Math.sqrt(remaining) / 26)
          : null,
        d: hubLocal ? null : trackPath(src.deg, dst.deg, srcR, dstR),
        tone: angleFromHash(hash + 'tone', 2) < 1 ? 'y' : 'c',
        from: src.name,
        to: dst.name,
        amount: `${fmtAmount(o.intentState.remainingInput, token.decimals)} ${cleanSymbol(token.symbol)}`,
      });
    }
    return out.slice(0, 26);
  }, [orderbook, sodax, sectorOf, spokes.length]);

  /* ---- the route the trade form is composing ---- */
  const focusTrack = useMemo(() => {
    if (!route) return null;
    const s = resolveKey(sectorOf, spokes.length, route.srcChainKey);
    const d = resolveKey(sectorOf, spokes.length, route.dstChainKey);
    if (!s || !d) return null;
    return trackPath(
      s.deg,
      d.deg,
      s.hub ? CORE_R + 8 : R_OUTER - 16,
      d.hub ? CORE_R + 8 : R_OUTER - 16,
    );
  }, [route, sectorOf, spokes.length]);

  const hubTvl = useMemo(
    () => (reserves ? reserves.reduce((sum, r) => sum + Number(r.totalLiquidityUSD), 0) : null),
    [reserves],
  );

  /* ---- the event bloom: the one authored moment ---- */
  const bloomed = useRef(false);
  const ready = barList.length > 0 || tracks.length > 0;
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
      animate('.js-grid', {
        opacity: [0.2, 1],
        scale: [0.94, 1],
        duration: 900,
        delay: stagger(60),
        ease: 'outExpo',
      });
      animate('.js-bar', {
        scaleY: [0, 1],
        duration: 760,
        delay: stagger(6, { start: 260 }),
        ease: 'outExpo',
      });
      const paths = svg.createDrawable('.js-track');
      animate(paths, {
        draw: ['0.5 0.5', '0 1'],
        duration: 1150,
        delay: stagger(30, { start: 420 }),
        ease: 'outExpo',
      });
      animate('.js-label', {
        opacity: [0, 1],
        duration: 520,
        delay: stagger(24, { start: 420 }),
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
        aria-label={`Detector: Sonic hub, ${spokes.length} spoke chains, ${barList.length} chains and ${tracks.length} open intents`}
      >
        {/* value axis — the rings are gridlines you read bar length against */}
        <g>
          {axis.ticks.map(v => (
            <circle
              key={v}
              className="grid-ring js-grid"
              cx={CX}
              cy={CY}
              r={valueRadius(v, axis)}
            />
          ))}
          {axis.ticks.map(v => (
            <text
              key={`gl-${v}`}
              className="grid-label js-label"
              x={CX + 5}
              y={CY - valueRadius(v, axis) - 4}
            >
              {gridLabel(v)}
            </text>
          ))}
        </g>

        {/* sector dividers */}
        <g>
          {spokes.map((chainKey, i) => {
            const s = sector(i, spokes.length);
            const a = polar(R_INNER - 5, s.start - 1.7);
            const b = polar(R_OUTER + 4, s.start - 1.7);
            return (
              <line
                key={`div-${chainKey}`}
                className="sector-div"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            );
          })}
        </g>

        {/* one wedge per chain — reachable money-market liquidity */}
        <g>
          {barList.map(b => {
            const mid = (b.start + b.end) / 2;
            const p0 = polar(R_INNER, mid);
            const p1 = polar(b.r, mid);
            const lit = route
              ? b.chainKey === route.srcChainKey || b.chainKey === route.dstChainKey
              : false;
            return (
              <line
                key={b.key}
                className={`calo js-bar${lit ? ' lit' : ''}`}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                style={{ transformOrigin: `${p0.x}px ${p0.y}px` }}
                onMouseEnter={() =>
                  setCallout({
                    x: (p1.x / BOX_W) * 100,
                    y: (p1.y / BOX_H) * 100,
                    rows: [
                      ['chain', b.chain],
                      ['reachable', fmtUsd(b.usd, { compact: true })],
                      ['assets', String(b.assets)],
                      ['deepest', b.top],
                    ],
                  })
                }
                onMouseLeave={() => setCallout(null)}
              />
            );
          })}
        </g>

        {/* live intents */}
        <g>
          {tracks.map(t =>
            t.d ? (
            <path
              key={t.key}
              className={`intent-track js-track ${t.tone}`}
              d={t.d}
              onMouseEnter={() =>
                setCallout({
                  x: 58,
                  y: 10,
                  rows: [
                    ['route', `${t.from} → ${t.to}`],
                    ['remaining', t.amount],
                    ['state', 'open'],
                  ],
                })
              }
              onMouseLeave={() => setCallout(null)}
            />
            ) : (
              <line
                key={t.key}
                className={`hub-tick js-track ${t.tone}`}
                x1={t.tick!.x1}
                y1={t.tick!.y1}
                x2={t.tick!.x2}
                y2={t.tick!.y2}
                onMouseEnter={() =>
                  setCallout({
                    x: 58,
                    y: 10,
                    rows: [
                      ['route', `${t.from} → ${t.to}`],
                      ['remaining', t.amount],
                      ['state', 'open · stays on hub'],
                    ],
                  })
                }
                onMouseLeave={() => setCallout(null)}
              />
            ),
          )}
          {tracks.map(t =>
            t.end ? (
              <circle
                key={`cap-${t.key}`}
                className={`track-cap ${t.tone}`}
                cx={t.end.x}
                cy={t.end.y}
                r={2.8}
              />
            ) : null,
          )}
        </g>

        {focusTrack && (
          <path
            className="intent-track focus-track"
            d={focusTrack}
            strokeDasharray={route?.state === 'quoting' ? '6 7' : undefined}
          />
        )}

        {/* chain names, one per sector, set on the sector's own angle */}
        <g>
          {spokes.map((chainKey, i) => {
            const s = sector(i, spokes.length);
            const p = polar(R_OUTER + 13, s.mid);
            const flip = s.mid > 180;
            const lit = route
              ? chainKey === route.srcChainKey || chainKey === route.dstChainKey
              : false;
            return (
              <text
                key={chainKey}
                className={`sector-label js-label${lit ? ' lit' : ''}`}
                x={p.x}
                y={p.y}
                textAnchor={flip ? 'end' : 'start'}
                transform={`rotate(${flip ? s.mid + 90 : s.mid - 90} ${p.x} ${p.y})`}
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
          style={{ left: `${Math.min(callout.x, 66)}%`, top: `${Math.min(callout.y, 80)}%` }}
        >
          {callout.rows.map(([k, v]) => (
            <div className="callout-row" key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="legend">
          <div className="legend-title">Reading this</div>
          <div className="legend-row">
            <svg width="24" height="12" viewBox="0 0 24 12">
              <line x1="3" y1="11" x2="3" y2="4" stroke="var(--energy)" strokeWidth="2.4" />
              <line x1="9" y1="11" x2="9" y2="1" stroke="var(--energy)" strokeWidth="2.4" />
              <line x1="15" y1="11" x2="15" y2="7" stroke="var(--energy)" strokeWidth="2.4" />
            </svg>
            <span>One wedge per chain — length is liquidity it can reach</span>
          </div>
          <div className="legend-row">
            <svg width="24" height="12" viewBox="0 0 24 12">
              <path d="M1 11 A10 10 0 0 1 21 6" stroke="var(--ring)" strokeWidth="1" fill="none" />
            </svg>
            <span>
              Rings are the value scale, {gridLabel(axis.lo)} to {gridLabel(axis.hi)}
            </span>
          </div>
          <div className="legend-row">
            <svg width="24" height="12" viewBox="0 0 24 12">
              <path d="M1 11C7 11 9 2 16 2" stroke="var(--track-yellow)" strokeWidth="1.5" fill="none" />
              <circle cx="16" cy="2" r="2.2" fill="var(--track-yellow)" />
            </svg>
            <span>An open intent, source chain to destination</span>
          </div>
          <div className="legend-row">
            <svg width="24" height="12" viewBox="0 0 24 12">
              <line x1="4" y1="10" x2="4" y2="4" stroke="var(--track-cyan)" strokeWidth="2" />
              <line x1="9" y1="10" x2="9" y2="1" stroke="var(--track-yellow)" strokeWidth="2" />
              <line x1="14" y1="10" x2="14" y2="6" stroke="var(--track-cyan)" strokeWidth="2" />
            </svg>
            <span>Ticks at the core — swaps that stay on the hub</span>
          </div>
        </div>
      )}

      {loading && <div className="event-empty">Acquiring detector data…</div>}
    </div>
  );
}

function gridLabel(v: number): string {
  if (v >= 1_000_000_000) return `$${v / 1_000_000_000}B`;
  if (v >= 1_000_000) return `$${v / 1_000_000}M`;
  if (v >= 1_000) return `$${v / 1_000}K`;
  return `$${v}`;
}

/** Relay chain ids are not EVM chain ids — always resolve through the SDK. */
function resolve(
  sodax: ReturnType<typeof useSodaxContext>['sodax'],
  sectorOf: Map<string, number>,
  count: number,
  relayChainId: number,
): { deg: number; name: string; hub: boolean } | null {
  const id = BigInt(relayChainId);
  if (!sodax.config.isValidIntentRelayChainId(id)) return null;
  const key = sodax.config.getSpokeChainKeyFromIntentRelayChainId(id);
  return resolveKey(sectorOf, count, key);
}

function resolveKey(
  sectorOf: Map<string, number>,
  count: number,
  key: string,
): { deg: number; name: string; hub: boolean } | null {
  if (key === ChainKeys.SONIC_MAINNET) {
    return { deg: 0, name: chainName(key), hub: true };
  }
  const i = sectorOf.get(key);
  if (i === undefined) return null;
  return { deg: sector(i, count).mid, name: chainName(key), hub: false };
}

void HUB;
