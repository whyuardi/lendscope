// ─── Chain & Protocol Constants ──────────────────────────────────────────────

export const CHAINS = {
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcs: [
      'https://eth.drpc.org',
      'https://ethereum.publicnode.com',
      'https://1rpc.io/eth',
      'https://rpc.ankr.com/eth',
    ],
    explorer: 'https://etherscan.io',
    explorerName: 'Etherscan',
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://arbitrum.drpc.org',
    ],
    explorer: 'https://arbiscan.io',
    explorerName: 'Arbiscan',
  },
  optimism: {
    id: 10,
    name: 'Optimism',
    rpcs: [
      'https://mainnet.optimism.io',
      'https://optimism.llamarpc.com',
    ],
    explorer: 'https://optimistic.etherscan.io',
    explorerName: 'OP Etherscan',
  },
  base: {
    id: 8453,
    name: 'Base',
    rpcs: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base.drpc.org',
    ],
    explorer: 'https://basescan.org',
    explorerName: 'Basescan',
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    rpcs: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
    ],
    explorer: 'https://polygonscan.com',
    explorerName: 'Polygonscan',
  },
} as const;

export type ChainKey = keyof typeof CHAINS;

export type AssetInfo = {
  symbol: string;
  address: string;
  decimals: number;
  logo?: string;
};

export const DEFAULT_ASSETS: Record<ChainKey, AssetInfo[]> = {
  ethereum: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3380', decimals: 18 },
  ],
  arbitrum: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
    { symbol: 'WBTC', address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8 },
    { symbol: 'ARB', address: '0xB50721BCf8d664c30412Cfbc6cf7aDF452E7f2F9', decimals: 18 },
  ],
  optimism: [
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000042', decimals: 18 },
    { symbol: 'WBTC', address: '0x68f180fcCe6836688e9904A47931228732eC9B5d', decimals: 8 },
  ],
  base: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    { symbol: 'cbBTC', address: '0xcbB7C0000aB88B4730fFa35c3c5D6B3bE30f3E35', decimals: 8 },
  ],
  polygon: [
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
    { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
    { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
  ],
};

// ─── Aave V3 ─────────────────────────────────────────────────────────────────

export const AAVE_V3 = {
  name: 'Aave V3',
  poolProxies: {
    1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    8453: '0xA238Dd80C259a72e81d7eB4AAD4789D0FB5d2733',
    137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  } as Record<number, string>,
  poolABI: [
    'function getReserveData(address asset) view returns (tuple(uint256 configurationData, uint128 liquidityRate, uint128 variableBorrowRate, uint128 stableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbackedMintFee, uint128 isolatedPrincipal))',
    'function getUserAccountData(address user) view returns (tuple(uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor, uint256 eModeCategoryId))',
    'function getReservesList() view returns (address[])',
  ],
  aTokenABI: [
    'function balanceOf(address) view returns (uint256)',
    'function scaledBalanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
  ],
};

// ─── Compound V3 ─────────────────────────────────────────────────────────────

export const COMPOUND_V3 = {
  name: 'Compound V3',
  comets: {
    1: {
      USDC: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
      WETH: '0xA17581A9E3356d9A8584487892b0dcb86022D243',
    },
    42161: {
      USDC: '0x9c4ec900c49e84686F2b8347695daB7bE44De37D',
    },
  } as Record<number, Record<string, string>>,
  cometABI: [
    'function underlying() view returns (address)',
    'function totalSupply() view returns (uint256)',
    'function totalBorrow() view returns (uint256)',
    'function supplyRatePerSecond() view returns (uint256)',
    'function borrowRatePerSecond() view returns (uint256)',
    'function getCash() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function borrowBalanceOf(address) view returns (uint256)',
    'function collateralBalanceOf(address, address) view returns (uint256)',
    'function getSupplyRate(uint256 utilization) view returns (uint256)',
    'function getBorrowRate(uint256 utilization) view returns (uint256)',
    'function totalCollateral(address asset) view returns (uint256)',
    'function userCollateral(address account, address asset) view returns (tuple(bool enabled, uint128 balance, uint128 _))',
  ],
};

// ─── Morpho Blue ──────────────────────────────────────────────────────────────

export const MORPHO = {
  name: 'Morpho Blue',
  address: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62B0c3BCAC2',
  morphoABI: [
    'function idToMarketParams(uint256 id) view returns (tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv))',
    'function market() view returns (tuple(uint256 totalSupplyAssets, uint256 totalSupplyShares, uint256 totalBorrowAssets, uint256 totalBorrowShares, uint256 lastUpdate, uint256 fee))',
    'function getSupplyRate(address loanToken, address collateralToken, uint256 lltv) view returns (uint256)',
    'function getBorrowRate(address loanToken, address collateralToken, uint256 lltv) view returns (uint256)',
    'function totalSupplyAssets(address loanToken, uint256 lltv) view returns (uint256)',
    'function totalBorrowAssets(address loanToken, uint256 lltv) view returns (uint256)',
  ],
};

// ─── Radiant V2 ──────────────────────────────────────────────────────────────

export const RADIANT = {
  name: 'Radiant V2',
  poolAddress: {
    42161: '0x7bb11d0212B1E13d9ca9A2C20d2A578d0B3F7b4e',
  } as Record<number, string>,
  poolABI: [
    'function getAssetInfo(uint8 index) view returns (tuple(uint8 isActive, uint8 isCollateral, uint256 underlyingAsset, uint256 totalSupply, uint256 totalBorrow, uint256 supplyRate, uint256 borrowRate, uint256 collateralFactor, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 priceFeed, uint256 lastUpdate))',
    'function getTotalStats() view returns (tuple(uint256 totalSupplyUSD, uint256 totalBorrowUSD, uint256 totalValueLockedUSD))',
    'function availableLiquidity() view returns (uint256)',
  ],
  vTokenABI: [
    'function balanceOf(address) view returns (uint256)',
    'function borrowBalanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function totalBorrow() view returns (uint256)',
  ],
};

// ─── Multicall3 ─────────────────────────────────────────────────────────────

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const MULTICALL3_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
  'function aggregate3(tuple(address target, bool requireSuccess, bytes callData)[] calls) payable returns (bool[] successes, bytes[] returnData)',
];

// ─── Blocks Per Year ─────────────────────────────────────────────────────────

export const BLOCKS_PER_YEAR: Record<number, number> = {
  1: 2102400,       // ETH avg ~12s
  42161: 52560000,  // Arbitrum avg ~0.25s
  10: 52560000,     // Optimism avg ~0.25s
  8453: 52560000,   // Base avg ~0.25s
  137: 15768000,    // Polygon avg ~2s
};

// ─── Utility ─────────────────────────────────────────────────────────────────

export function blocksToAPY(ratePerBlock: bigint, blocksPerYear: number): number {
  if (ratePerBlock === 0n) return 0;
  const perYear = ratePerBlock * BigInt(blocksPerYear);
  return Number(perYear) / 1e18;
}

export function rayToAPY(ray: bigint): number {
  if (ray === 0n) return 0;
  return (Number(ray) / 1e27) * 100;
}

export function secondsToAPY(ratePerSecond: bigint): number {
  if (ratePerSecond === 0n) return 0;
  const SECONDS_PER_YEAR = 31536000n;
  return (Number(ratePerSecond * SECONDS_PER_YEAR) / 1e18) * 100;
}