export { formatCompact } from './protocols';

export function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatAPY(n: number): string {
  if (n <= 0) return '—';
  return `${n.toFixed(2)}%`;
}

export function healthFactorColor(hf: number): string {
  if (hf <= 0) return 'text-text-dim';
  if (hf < 1.05) return 'text-accent-red';
  if (hf < 1.5) return 'text-accent-amber';
  if (hf < 3) return 'text-accent-green';
  return 'text-accent';
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const CHAIN_LOGOS: Record<string, string> = {
  ethereum: '⟠',
  arbitrum: '🔷',
  optimism: '🔴',
  base: '🔵',
  polygon: '🟣',
};

export const PROTOCOL_COLORS: Record<string, string> = {
  'Aave V3': '#9D6EEF',
  'Compound V3': '#00D395',
  'Radiant V2': '#F54B7E',
  'Morpho': '#5B7DFF',
};

export function clsx(...args: (string | boolean | undefined)[]): string {
  return args.filter(Boolean).join(' ');
}

export const DEBOUNCE_MS = 300;