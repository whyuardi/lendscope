import { ethers } from 'ethers';
import { CHAINS, ChainKey } from './constants';

export type ChainId = 1 | 10 | 137 | 42161 | 8453;

const chainIdMap: Record<ChainKey, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
};

// ─── Best RPC selector (pick fastest responding) ────────────────────────────

export async function getBestProvider(chain: ChainKey): Promise<ethers.JsonRpcProvider> {
  const rpcs = CHAINS[chain].rpcs;
  const timeout = 4000;

  const results = await Promise.allSettled(
    rpcs.map(async (rpc) => {
      const start = Date.now();
      const provider = new ethers.JsonRpcProvider(rpc, chainIdMap[chain], {
        staticNetwork: true,
      });
      try {
        await provider.getBlockNumber();
        return { rpc, latency: Date.now() - start };
      } finally {
        provider.destroy();
      }
    })
  );

  const valid = results
    .map((r): { rpc: string; latency: number } | null => {
      if (r.status === 'rejected') return null;
      return { rpc: String(r.value.rpc), latency: r.value.latency };
    })
    .filter((r): r is { rpc: string; latency: number } => r !== null)
    .sort((a, b) => a.latency - b.latency);

  if (valid.length === 0) {
    // Fallback: use first RPC anyway
    return new ethers.JsonRpcProvider(rpcs[0], chainIdMap[chain], { staticNetwork: true });
  }

  return new ethers.JsonRpcProvider(valid[0].rpc, chainIdMap[chain], { staticNetwork: true });
}

// ─── Provider cache per chain ───────────────────────────────────────────────

const providerCache = new Map<ChainKey, ethers.JsonRpcProvider>();

export async function getProvider(chain: ChainKey): Promise<ethers.JsonRpcProvider> {
  if (providerCache.has(chain)) return providerCache.get(chain)!;
  const p = await getBestProvider(chain);
  providerCache.set(chain, p);
  return p;
}

// ─── Batch multicall ────────────────────────────────────────────────────────

export async function multicall(
  chain: ChainKey,
  calls: Array<{ target: string; abi: string[]; functionName: string; args?: unknown[] }>
): Promise<unknown[]> {
  const provider = await getProvider(chain);
  const { MULTICALL3_ABI, MULTICALL3 } = await import('./constants');

  const iface = new ethers.Interface(MULTICALL3_ABI);
  const encoded = calls.map((c) => ({
    target: c.target,
    callData: new ethers.Interface(c.abi).encodeFunctionData(c.functionName, c.args ?? []),
  }));

  const result = await provider.call({
    to: MULTICALL3,
    data: iface.encodeFunctionData('aggregate', [encoded]),
  });

  const [, returnData] = iface.decodeFunctionResult('aggregate', result);
  return calls.map((c, i) => {
    const data = returnData[i];
    if (!data || data === '0x') return null;
    try {
      return new ethers.Interface(c.abi).decodeFunctionResult(c.functionName, data);
    } catch {
      return null;
    }
  });
}

// ─── Single contract call ───────────────────────────────────────────────────

export async function readContract<T = unknown>(
  chain: ChainKey,
  target: string,
  abi: string[],
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  const provider = await getProvider(chain);
  const iface = new ethers.Interface(abi);
  const data = iface.encodeFunctionData(functionName, args);

  const result = await provider.call({ to: target, data });
  const decoded = iface.decodeFunctionResult(functionName, result);

  // Return first item if single result, else the full tuple
  return (Array.isArray(decoded) ? decoded.length === 1 ? decoded[0] : decoded : decoded) as T;
}

// ─── Gas price ─────────────────────────────────────────────────────────────

export async function getGasPrice(chain: ChainKey): Promise<{ gasPrice: bigint; symbol: string }> {
  const provider = await getProvider(chain);
  const gasPrice = await provider.getFeeData();
  const symbol = chain === 'ethereum' ? 'ETH' : CHAINS[chain].name;
  return { gasPrice: gasPrice.gasPrice ?? 0n, symbol };
}

// ─── ETH price (from chainlink-like price feed) ─────────────────────────────

const PRICE_FEEDS: Record<ChainKey, string> = {
  ethereum: '0x5f4eC3Df9cbd43714FE2740f5E3617235B190712',  // ETH/USD on ETH
  arbitrum: '0x639Fe6ab55C921f74e7fac1ee960C0B6293Ba612',  // ETH/USD on Arb
  optimism: '0x13e3Ee699D1909Ey6F564Aa9D7B17CeC3D62aE8b', // ETH/USD on OP (placeholder)
  base: '0x7109796a0b0B0F9bF73d29D69F6eFD8FE9e6fFD0',      // ETH/USD on Base (placeholder)
  polygon: '0xF9680D99D6C9589e2c93aD165B9C54d5e2E94fCE',    // MATIC/USD on Polygon
};

export async function getEthPrice(chain: ChainKey): Promise<number> {
  try {
    const feed = PRICE_FEEDS[chain];
    const answer = await readContract<bigint>(chain, feed, [
      'function latestAnswer() view returns (int256)',
    ], 'latestAnswer', []);
    return Number(answer) / 1e8; // Chainlink 8 decimals
  } catch {
    // Fallback: return a reasonable estimate
    return chain === 'ethereum' ? 3450 : chain === 'polygon' ? 0.85 : 3450;
  }
}

// ─── Token price (simple, from DEX pair or static) ─────────────────────────

const STATIC_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, DAI: 1,
  WETH: 3450, ETH: 3450,
  WBTC: 98500, BTC: 98500,
  ARB: 1.12,
  cbBTC: 98500,
};

export async function getTokenPrice(symbol: string, chain: ChainKey): Promise<number> {
  const key = `${chain}:${symbol}`;
  if (STATIC_PRICES[symbol]) return STATIC_PRICES[symbol];
  // Could extend with DeBank or DEX price fetch
  return STATIC_PRICES[symbol] ?? 1;
}

// ─── Clear provider cache ───────────────────────────────────────────────────

export function clearProviderCache() {
  providerCache.forEach((p) => p.destroy());
  providerCache.clear();
}