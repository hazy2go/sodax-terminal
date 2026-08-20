'use client';

import { useEffect, useMemo, useRef } from 'react';
import { animate, type JSAnimation } from 'animejs';
import { useBackendOrderbook, useSodaxContext } from '@sodax/dapp-kit';
import { chainName, isTokenAllowed } from '@/lib/config';
import { cleanSymbol, fmtAmount } from '@/lib/format';
import { Badge } from '@/components/ui/badge';

/**
 * These are OPEN intents streaming off the live orderbook — not fills. The
 * backend reports what is awaiting a solver, so that is what the tape claims.
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
        return {
          key: o.intentData.intentHash,
          route: `${chainName(sodax.config.getSpokeChainKeyFromIntentRelayChainId(srcId))} → ${chainName(sodax.config.getSpokeChainKeyFromIntentRelayChainId(dstId))}`,
          amount: fmtAmount(o.intentState.remainingInput, token.decimals),
          symbol: sym,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [orderbook, sodax]);

  // The tape's native motion: a continuous crawl, distance-proportional so the
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
    <div className="relative flex h-full min-w-0 items-center overflow-hidden border-t border-border bg-card">
      <div className="z-10 flex h-full shrink-0 items-center gap-2 border-r border-border bg-card px-3">
        <Badge variant="outline" className="gap-1.5 border-flow/45 text-flow">
          <span className="size-1.5 rounded-full bg-flow" />
          Live
        </Badge>
        <span className="label-micro max-sm:hidden">Open intents</span>
      </div>
      <div ref={stripRef} className="flex min-w-0 items-center whitespace-nowrap">
        {items.length === 0 && (
          <span className="px-3 text-[10px] text-muted-foreground">Awaiting orderbook…</span>
        )}
        {/* duplicated once so the crawl wraps seamlessly */}
        {[...items, ...items].map((it, i) => (
          <span
            key={`${it.key}-${i}`}
            className="fig flex shrink-0 items-center gap-2 border-r border-border px-3.5 text-[10px] text-muted-foreground"
          >
            <span>{it.route}</span>
            <span className="text-foreground">
              {it.amount} {it.symbol}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
