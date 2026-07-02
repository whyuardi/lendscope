import { ethers } from 'ethers';
import { ChainKey, AAVE_V3, COMPOUND_V3, RADIANT, DEFAULT_ASSETS } from './constants';
import { getProvider, readContract } from './rpc';

const CHAIN_ID: Record<ChainKey, number> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  polygon: 137,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export type MarketData = {
  symbol: string;
  address: string;
  decimals: number;
  chain: ChainKey;
  protocol: string;
  supplyAPY: number;       // percentage
  borrowAPY: number;        // percentage
  totalSupply: string;     // human-readable
  totalBorrow: string;     // human-readable
  TVL: number;              // USD
  LTV: number;              // Loan-to-Value (0-1)
  liquidationThreshold: number;
available: boolean;
  price: number;
};

export type PortfolioPosition = {
  symbol: string;
  chain: ChainKey;
  protocol: string;
  supplied: number;        // USD
  borrowed: number;        // USD
  healthFactor: number;
  netAPY: number;
};

// ─── Aave V3 ─────────────────────────────────────────────────────────────────

interface AaveReserveData {
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  aTokenAddress: string;
}

interface AaveUserData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

export async function fetchAaveV3Market(chain: ChainKey): Promise<MarketData[]> {
  const chainId = { ethereum: 1, arbitrum: 42161, optimism: 10, base: 8453, polygon: 137 }[chain];
  const poolProxy = AAVE_V3.poolProxies[chainId];
  if (!poolProxy) return [];

  try {
    const assets = DEFAULT_ASSETS[chain];
    const results = await Promise.allSettled(
      assets.map(async (asset) => {
        const data = await readContract<AaveReserveData>(chain, poolProxy, AAVE_V3.poolABI, 'getReserveData', [asset.address]);
        const supplyAPY = Number(data.liquidityRate) / 1e25; // ray → percentage
        const borrowAPY = Number(data.variableBorrowRate) / 1e25;

        // Get total supply from aToken
        let totalSupply = 0n;
        try {
          const aToken = new ethers.Contract(data.aTokenAddress, ['function totalSupply() view returns (uint256)'], await getProvider(chain));
          totalSupply = await (aToken.totalSupply() as Promise<bigint>);
        } catch {
          totalSupply = 0n;
        }

        const formatted = parseFloat(ethers.formatUnits(totalSupply, asset.decimals));
        const price = 1; // simplified
        const tvl = formatted * price;

        return {
          symbol: asset.symbol,
          address: asset.address,
          decimals: asset.decimals,
          chain,
          protocol: 'Aave V3',
          supplyAPY,
          borrowAPY,
          totalSupply: formatCompact(formatted),
          totalBorrow: '—',
          TVL: tvl,
          LTV: 0.8, // Aave v3 default LTV varies by asset
          liquidationThreshold: 0.82,
          available: supplyAPY > 0,
          price,
        };
      })
    );

    return results
      .filter((r): r is PromiseFulfilledResult<MarketData> => r.status === 'fulfilled')
      .map((r) => r.value);
  } catch (e) {
    console.error(`Aave V3 fetch failed for ${chain}:`, e);
    return [];
  }
}

// ─── Compound V3 ─────────────────────────────────────────────────────────────

export async function fetchCompoundV3Market(chain: ChainKey): Promise<MarketData[]> {
  const chainId = CHAIN_ID[chain];
  if (!COMPOUND_V3.comets[chainId]) return [];

  const comets = COMPOUND_V3.comets[chainId];
  const results: MarketData[] = [];

  for (const [symbol, cometAddr] of Object.entries(comets)) {
    try {
      const supplyRate = await readContract<bigint>(chain, cometAddr, COMPOUND_V3.cometABI, 'supplyRatePerSecond', []);
      const borrowRate = await readContract<bigint>(chain, cometAddr, COMPOUND_V3.cometABI, 'borrowRatePerSecond', []);
      const totalSupply = await readContract<bigint>(chain, cometAddr, COMPOUND_V3.cometABI, 'totalSupply', []);
      const totalBorrow = await readContract<bigint>(chain, cometAddr, COMPOUND_V3.cometABI, 'totalBorrow', []);
      const cash = await readContract<bigint>(chain, cometAddr, COMPOUND_V3.cometABI, 'getCash', []);

      const SECONDS_PER_YEAR = 31536000;
      const supplyAPY = (Number(supplyRate) * SECONDS_PER_YEAR / 1e18) * 100;
      const borrowAPY = (Number(borrowRate) * SECONDS_PER_YEAR / 1e18) * 100;
      const total = Number(totalSupply) / 1e6; // USDC or WETH decimals
      const borrowed = Number(totalBorrow) / 1e6;
      const tvl = (Number(cash) + borrowed) / 1e6;

      results.push({
        symbol,
        address: cometAddr,
        decimals: symbol === 'USDC' ? 6 : 18,
        chain,
        protocol: 'Compound V3',
        supplyAPY,
        borrowAPY,
        totalSupply: formatCompact(total),
        totalBorrow: formatCompact(borrowed),
        TVL: tvl,
        LTV: 0.8,
        liquidationThreshold: 0.83,
        available: supplyAPY > 0,
        price: 1,
      });
    } catch (e) {
      console.error(`Compound V3 fetch failed for ${symbol} on ${chain}:`, e);
    }
  }

  return results;
}

// ─── Radiant V2 ─────────────────────────────────────────────────────────────

export async function fetchRadiantMarket(chain: ChainKey): Promise<MarketData[]> {
  if (chain !== 'arbitrum') return [];
  const poolAddr = RADIANT.poolAddress[42161];
  if (!poolAddr) return [];

  try {
    const results: MarketData[] = [];
    // Try fetching first 8 assets
    for (let i = 0; i < 8; i++) {
      try {
        const info = await readContract<[bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]>(
          chain, poolAddr, RADIANT.poolABI, 'getAssetInfo', [i]
        );
        const [isActive, , underlyingAsset, totalSupply, totalBorrow, supplyRate, borrowRate] = info;

        if (Number(isActive) === 0) continue;

        // Decode: supplyRate and borrowRate are in bips × 1e9 (ray format)
        const supplyAPY = Number(supplyRate) / 1e9 * 100 * 365;  // very rough estimate
        const borrowAPY = Number(borrowRate) / 1e9 * 100 * 365;
        const tvl = Number(totalSupply) / 1e6; // approx

        const symbol = getSymbolFromAddress(chain, underlyingAsset.toString());
        results.push({
          symbol,
          address: underlyingAsset.toString(),
          decimals: 18,
          chain,
          protocol: 'Radiant V2',
          supplyAPY,
          borrowAPY,
          totalSupply: formatCompact(Number(totalSupply) / 1e18),
          totalBorrow: formatCompact(Number(totalBorrow) / 1e18),
          TVL: tvl,
          LTV: Number(info[8]) / 1e4,
          liquidationThreshold: Number(info[9]) / 1e4,
          available: Number(isActive) === 1,
          price: 1,
        });
      } catch {
        break; // no more assets
      }
    }
    return results;
  } catch (e) {
    console.error('Radiant fetch failed:', e);
    return [];
  }
}

// ─── Portfolio ───────────────────────────────────────────────────────────────

export async function fetchPortfolio(wallet: string, chains: ChainKey[]): Promise<PortfolioPosition[]> {
  const positions: PortfolioPosition[] = [];
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(wallet);
  if (!isValidAddress) return [];

  for (const chain of chains) {
    const chainId = { ethereum: 1, arbitrum: 42161, optimism: 10, base: 8453, polygon: 137 }[chain];

    // Aave V3 portfolio
    const poolProxy = AAVE_V3.poolProxies[chainId];
    if (poolProxy) {
      try {
        const userData = await readContract<AaveUserData>(chain, poolProxy, AAVE_V3.poolABI, 'getUserAccountData', [wallet]);
        if (userData && userData.healthFactor > 0n) {
          const healthFactor = Number(userData.healthFactor) / 1e18;
          const supplied = Number(userData.totalCollateralBase) / 1e8;
          const borrowed = Number(userData.totalDebtBase) / 1e8;

          positions.push({
            symbol: 'All',
            chain,
            protocol: 'Aave V3',
            supplied,
            borrowed,
            healthFactor,
            netAPY: 0, // would need more complex calc
          });
        }
      } catch { /* wallet not in Aave */ }
    }
  }

  return positions;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

const ADDRESS_TO_SYMBOL: Record<string, string> = {
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
  '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'WETH',
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC',
  '0x6B175474E89094C44Da98b954EescdeCB5BE3380': 'DAI',
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': 'USDC',
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1': 'WETH',
  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f': 'WBTC',
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': 'USDC',
  '0x4200000000000000000000000000000000000006': 'WETH',
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
};

function getSymbolFromAddress(chain: ChainKey, address: string): string {
  return ADDRESS_TO_SYMBOL[address] ?? '???';
}

// ─── All Markets ─────────────────────────────────────────────────────────────

export async function fetchAllMarkets(chains: ChainKey[]): Promise<MarketData[]> {
  const results = await Promise.allSettled(
    chains.flatMap((chain) => [
      fetchAaveV3Market(chain),
      fetchCompoundV3Market(chain),
      fetchRadiantMarket(chain),
    ])
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MarketData[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => b.supplyAPY - a.supplyAPY);
}