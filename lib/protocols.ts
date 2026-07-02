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
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: string;
  totalBorrow: string;
  TVL: number;
  LTV: number;
  liquidationThreshold: number;
  available: boolean;
  price: number;
};

export type PortfolioPosition = {
  symbol: string;
  chain: ChainKey;
  protocol: string;
  supplied: number;
  borrowed: number;
  healthFactor: number;
  netAPY: number;
};

// ─── Aave V3 ─────────────────────────────────────────────────────────────────

/*
  Aave V3 ReserveData struct (15 fields):
  [0] configuration  (uint256)
  [1] liquidityIndex (uint128, RAY)
  [2] variableBorrowIndex (uint128, RAY)
  [3] currentLiquidityRate (uint128, RAY)
  [4] currentVariableBorrowRate (uint128, RAY)
  [5] currentStableBorrowRate (uint128, RAY)
  [6] lastUpdateTimestamp (uint40)
  [7] id (uint16)
  [8] aTokenAddress (address)
  [9] stableDebtTokenAddress (address)
  [10] variableDebtTokenAddress (address)
  [11] interestRateStrategyAddress (address)
  [12] accruedToTreasury (uint128)
  [13] unbacked (uint128)
  [14] isolationModeTotalDebt (uint128)
*/

// Minimal Aave V3 ABI for accessing reserve data
const AAVE_GET_RESERVE_ABI = [
  'function getReserveData(address) view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128))',
];

const AAVE_USER_ACCOUNT_ABI = [
  'function getUserAccountData(address) view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256))',
];

export async function fetchAaveV3Market(chain: ChainKey): Promise<MarketData[]> {
  const chainId = { ethereum: 1, arbitrum: 42161, optimism: 10, base: 8453, polygon: 137 }[chain];
  const poolProxy = AAVE_V3.poolProxies[chainId];
  if (!poolProxy) return [];

  try {
    const assets = DEFAULT_ASSETS[chain];
    const results = await Promise.allSettled(
      assets.map(async (asset) => {
        try {
          const res = await readContract<ethers.Result>(chain, poolProxy, AAVE_GET_RESERVE_ABI, 'getReserveData', [asset.address]);
          const currentLiquidityRate = res[3] as bigint;
          const currentVariableBorrowRate = res[4] as bigint;
          const aTokenAddr = res[8] as string;

          const supplyAPY = Number(currentLiquidityRate) / 1e25; // RAY → percentage
          const borrowAPY = Number(currentVariableBorrowRate) / 1e25;

          let totalSupply = 0n;
          try {
            const aToken = new ethers.Contract(aTokenAddr, ['function totalSupply() view returns (uint256)'], await getProvider(chain));
            totalSupply = await (aToken.totalSupply() as Promise<bigint>);
          } catch {
            totalSupply = 0n;
          }

          const formatted = parseFloat(ethers.formatUnits(totalSupply, asset.decimals));
          const price = 1;
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
            totalBorrow: '\u2014',
            TVL: tvl,
            LTV: 0.8,
            liquidationThreshold: 0.82,
            available: supplyAPY > 0,
            price,
          };
        } catch (e) {
          console.error(`Aave fetch failed for ${asset.symbol} on ${chain}:`, e);
          throw e;
        }
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
      const provider = await getProvider(chain);
      const comet = new ethers.Contract(cometAddr, COMPOUND_V3.cometABI, provider);

      const supplyRate = await comet.supplyRatePerSecond() as bigint;
      const borrowRate = await comet.borrowRatePerSecond() as bigint;
      const totalSupply = await comet.totalSupply() as bigint;
      const totalBorrow = await comet.totalBorrow() as bigint;
      const cash = await comet.getCash() as bigint;

      // Convert per-second rate to APY
      const SECONDS_PER_YEAR = 31536000;
      const supplyAPY = (Math.pow(1 + Number(supplyRate) / 1e18, SECONDS_PER_YEAR) - 1) * 100;
      const borrowAPY = (Math.pow(1 + Number(borrowRate) / 1e18, SECONDS_PER_YEAR) - 1) * 100;

      const isUSDC = symbol.includes('USDC');
      const decimals = isUSDC ? 6 : 18;
      const scale = Math.pow(10, decimals);

      const total = Number(totalSupply) / scale;
      const borrowed = Number(totalBorrow) / scale;
      const tvl = (Number(cash) + Number(totalBorrow)) / scale;

      results.push({
        symbol,
        address: cometAddr,
        decimals,
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

// ─── Radiant V2 ──────────────────────────────────────────────────────────────

export async function fetchRadiantMarket(chain: ChainKey): Promise<MarketData[]> {
  if (chain !== 'arbitrum') return [];
  const poolAddr = RADIANT.poolAddress[42161];
  if (!poolAddr) return [];

  try {
    const results: MarketData[] = [];
    for (let i = 0; i < 8; i++) {
      try {
        const info = await readContract<ethers.Result>(
          chain, poolAddr, RADIANT.poolABI, 'getAssetInfo', [i]
        );
        const isActive = Number(info[0]);
        if (isActive === 0) continue;

        const underlyingAsset = info[2].toString();
        const totalSupply = Number(info[3]);
        const totalBorrow = Number(info[4]);
        const supplyRate = Number(info[5]);
        const borrowRate = Number(info[6]);

        // Rate conversion: Radiant uses RAY for rates
        const supplyAPY = (supplyRate / 1e27) * 100;
        const borrowAPY = (borrowRate / 1e27) * 100;

        const symbol = getSymbolFromAddress(chain, underlyingAsset);
        const decimals = 18;
        const tvl = totalSupply / 1e18;

        results.push({
          symbol,
          address: underlyingAsset,
          decimals,
          chain,
          protocol: 'Radiant V2',
          supplyAPY,
          borrowAPY,
          totalSupply: formatCompact(totalSupply / 1e18),
          totalBorrow: formatCompact(totalBorrow / 1e18),
          TVL: tvl,
          LTV: 1,
          liquidationThreshold: 1,
          available: isActive === 1,
          price: 1,
        });
      } catch {
        break;
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
        const res = await readContract<ethers.Result>(chain, poolProxy, AAVE_USER_ACCOUNT_ABI, 'getUserAccountData', [wallet]);
        // [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor, eModeCategoryId]
        const totalCollateral = Number(res[0]) / 1e8;  // USD with 8 decimals
        const totalDebt = Number(res[1]) / 1e8;
        const healthFactor = Number(res[5]) / 1e18;

        if (totalCollateral > 0 || totalDebt > 0) {
          positions.push({
            symbol: 'All',
            chain,
            protocol: 'Aave V3',
            supplied: totalCollateral,
            borrowed: totalDebt,
            healthFactor,
            netAPY: 0,
          });
          console.log(`Portfolio found: ${wallet} on ${chain}, collateral=${totalCollateral}, debt=${totalDebt}, HF=${healthFactor}`);
        } else {
          console.log(`No portfolio on ${chain} for ${wallet}`);
        }
      } catch (e) {
        console.log(`Portfolio check failed for ${wallet} on ${chain}:`, e);
      }
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
