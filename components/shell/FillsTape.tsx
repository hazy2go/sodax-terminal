'use client';

import { useEffect, useMemo, useRef } from 'react';
import { animate, type JSAnimation } from 'animejs';
import { useBackendOrderbook, useSodaxContext } from '@sodax/dapp-kit';
import { ChainKeys } from '@sodax/types';
import { chainName, isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtAmount } from '@/lib/format';

/**
 * The running tape. These are OPEN intents streaming off the live orderbook —
 * not fills. The backend orderbook reports what is awaiting a solver, so that
 * is what the tape claims.
 */
export function FillsTape() {
  const { sodax } = useSodaxContext();
  const { data: orderbook } = useBackendOrderbook({
    params: { pagination: { offset: '0', limit: '24' } },
  });
  const stripRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<JSAnimation | null>(null);

  const items = useMemo(() => {
    if (!orderbook) return [];
    return orderbook.data
      .map(o => {
        const token = sodax.config.getXTokenFromHubAsset(o.intentData.inputToken);
        if (!token) return null;
        const sym = cleanSymbol(token.symbol);
        if (!isTokenAllowed(sym)) return null;

        const srcId = BigInt(o.intentData.srcChain);
        const dstId = BigInt(o.intentData.dstChain);
        if (
          !sodax.config.isValidIntentRelayChainId(srcId) ||
          !sodax.config.isValidIntentRelayChainId(dstId)
        ) {
          return null;
        }
        const src = sodax.config.getSpokeChainKeyFromIntentRelayChainId(srcId);
        const dst = sodax.config.getSpokeChainKeyFromIntentRelayChainId(dstId);

        return {
          key: o.intentData.intentHash,
          route: `${chainName(src)} → ${chainName(dst)}`,
          amount: fmtAmount(o.intentState.remainingInput, token.decimals),
          symbol: sym,
          hub: src === ChainKeys.SONIC_MAINNET,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [orderbook, sodax]);

  // The tape's native motion: a continuous crawl. Distance-proportional so the
  // speed stays constant however many intents are open.
  useEffect(() => {
    animRef.current?.revert();
    animRef.current = null;
    if (!stripRef.current || items.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const width = stripRef.current.scrollWidth / 2;
    if (width <= 0) return;

    animRef.current = animate(stripRef.current, {
      x: [0, -width],
      duration: width * 24,
      ease: 'linear',
      loop: true,
    });

    return () => {
      animRef.current?.revert();
      animRef.current = null;
    };
  }, [items]);

  return (
    <div className="tape">
      <div className="tape-label">
        <span className="badge badge-live">
          <span className="dot" />
          Live
        </span>
        <span className="label">Open intents</span>
      </div>
      <div className="tape-strip" ref={stripRef}>
        {items.length === 0 && <span className="tape-item muted">Awaiting orderbook…</span>}
        {/* duplicated once so the crawl wraps seamlessly */}
        {[...items, ...items].map((it, i) => (
          <span className="tape-item" key={`${it.key}-${i}`}>
            <span>{it.route}</span>
            <span className="sym">
              {it.amount} {it.symbol}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
