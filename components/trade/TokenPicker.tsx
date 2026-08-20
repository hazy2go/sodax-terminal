'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { XToken } from '@sodax/types';
import { chainName } from '@/lib/config';
import { tokenKey, tokenLogo } from '@/lib/tokens';
import { IconChevron, IconSearch } from '@/components/icons';

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
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
    return list.slice(0, 90);
  }, [tokens, query]);

  return (
    <div className="picker" ref={rootRef}>
      <button
        type="button"
        className="picker-btn"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen(o => !o);
          setQuery('');
        }}
      >
        {selected ? (
          <>
            <TokenMark token={selected} />
            <span className="picker-id">
              <span className="picker-sym">{selected.symbol}</span>
              <span className="picker-chain">{chainName(selected.chainKey)}</span>
            </span>
          </>
        ) : (
          <span className="muted">Select {label}</span>
        )}
        <IconChevron size={13} />
      </button>

      {open && (
        <div className="picker-menu" role="listbox">
          <div className="field-row" style={{ border: 0, borderBottom: '1px solid var(--hairline-hi)' }}>
            <span style={{ display: 'grid', placeItems: 'center', paddingLeft: 10, color: 'var(--faint)' }}>
              <IconSearch size={13} />
            </span>
            <input
              className="input"
              style={{ border: 0, background: 'none' }}
              placeholder="Search token or chain"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="picker-list">
            {filtered.length === 0 && <div className="picker-empty">No matches</div>}
            {filtered.map(t => (
              <button
                type="button"
                role="option"
                aria-selected={selected ? tokenKey(t) === tokenKey(selected) : false}
                key={tokenKey(t)}
                className="picker-item"
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                }}
              >
                <TokenMark token={t} />
                <span className="picker-id">
                  <span className="picker-sym">{t.symbol}</span>
                  <span className="picker-chain">{chainName(t.chainKey)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TokenMark({ token, size = 17 }: { token: XToken; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="tok-logo"
      src={tokenLogo(token.symbol)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={e => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}
