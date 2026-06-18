/**
 * Format a number into compact human-readable form: 1.2K, 4.5M, 1.3B
 * For values < 1000 it returns the number with up to 2 decimal places.
 * Optionally prefix with $ for currency.
 */
export function compact(value: number, currency = false): string {
  const prefix = currency ? '$' : '';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${(abs / 1_000).toFixed(1).replace(/\.?0+$/, '')}K`;
  }
  if (abs === 0) return `${prefix}0`;
  // Small numbers: show up to 4 sig figs
  if (abs < 0.01) return `${sign}${prefix}${abs.toExponential(2)}`;
  return `${sign}${prefix}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/**
 * Format a USD dollar amount compactly.
 */
export function usd(value: number): string {
  return compact(value, true);
}

/**
 * Format a token amount (no $ prefix, smart decimals).
 */
export function tokenAmount(value: number, decimals = 6): string {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1_000) return compact(value);
  return value.toFixed(Math.min(decimals, 6)).replace(/\.?0+$/, '');
}
