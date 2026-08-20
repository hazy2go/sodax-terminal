/** Formatting helpers — every number in the terminal goes through these. */

export function fmtUsd(v: number | string, opts?: { compact?: boolean }): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '—';
  if (opts?.compact && Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(2)}M`;
  if (opts?.compact && Math.abs(n) >= 10_000)
    return `$${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: n < 1 ? 4 : 2,
  });
}

export function fmtPct(v: number | string, digits = 2): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtAmount(raw: string | bigint, decimals: number, maxFrac = 4): string {
  try {
    const b = typeof raw === 'bigint' ? raw : BigInt(raw);
    const base = 10n ** BigInt(decimals);
    const whole = b / base;
    const frac = b % base;
    const n = Number(whole) + Number(frac) / Number(base);
    if (!Number.isFinite(n)) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
  } catch {
    return '—';
  }
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** "soda"-prefixed hub asset symbols → clean display symbols (sodaUSDC → USDC). */
export function cleanSymbol(symbol: string): string {
  if (symbol.startsWith('soda') && symbol.length > 4) return symbol.slice(4);
  return symbol;
}

/** Intent deadline: "0" means good-til-cancelled. */
export function fmtDeadline(deadline: string, nowMs: number): string {
  if (deadline === '0') return 'GTC';
  const ms = Number(deadline) * 1000;
  if (!Number.isFinite(ms)) return '—';
  const diff = ms - nowMs;
  if (diff <= 0) return 'expired';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
