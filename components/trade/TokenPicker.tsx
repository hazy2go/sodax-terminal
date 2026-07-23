'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import type { XToken } from '@sodax/types';
import { chainName } from '@/lib/config';
import { tokenKey } from '@/lib/tokens';

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
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? tokens.filter(
          t =>
            t.symbol.toLowerCase().includes(q) ||
            chainName(t.chainKey).toLowerCase().includes(q),
        )
      : tokens;
    return list.slice(0, 80);
  }, [tokens, query]);

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="picker-btn"
        onClick={() => {
          setOpen(o => !o);
          setQuery('');
        }}
      >
        {selected ? (
          <>
            <span className="picker-symbol">{selected.symbol}</span>
            <span className="picker-chain">{chainName(selected.chainKey)}</span>
          </>
        ) : (
          <span className="muted">Select {label}</span>
        )}
        <span className="picker-caret">▾</span>
      </button>
      {open && (
        <div className="picker-menu">
          <input
            className="input picker-search"
            placeholder="Search token or chain"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="picker-list">
            {filtered.length === 0 && <div className="picker-empty">No matches</div>}
            {filtered.map(t => (
              <button
                type="button"
                key={tokenKey(t)}
                className="picker-item"
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                }}
              >
                <span className="picker-symbol">{t.symbol}</span>
                <span className="picker-chain">{chainName(t.chainKey)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
