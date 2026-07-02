'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { ChainKey } from '@/lib/constants';
import { MarketData, fetchAllMarkets, fetchPortfolio } from '@/lib/protocols';
import { CHAINS } from '@/lib/constants';

const ACCENT = '#00E5A0';
const RED = '#FF4D6A';
const AMBER = '#FFB347';
const SURFACE = '#0A160D';
const SURFACE2 = '#101F14';
const SURFACE3 = '#162518';
const BORDER = '#1E3A22';
const TEXT = '#E8F5EC';
const MUTED = '#7A9F84';
const DIM = '#4A6B53';

const P_COLORS = ['#9D6EEF', '#00D395', '#F54B7E', '#5B7DFF', '#FFB347', '#4D9FFF', '#FF8C42'];
const PROTOCOL_NAMES = ['Aave V3', 'Compound V3', 'Radiant V2', 'Morpho'];

function f$(n: number) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

function fAPY(n: number) {
  if (n <= 0) return '\u2014';
  return n.toFixed(2) + '%';
}

function fHF(n: number) {
  if (n <= 0) return '\u2014';
  return n.toFixed(3);
}

const CHART_TOOLTIP = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: MUTED, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, fontFamily: 'JetBrains Mono, monospace' }}>
          {p.name}: {fAPY(p.value)}
        </div>
      ))}
    </div>
  );
};

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  const c = color || 'green';
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: 'rgba(0,229,160,0.12)', text: ACCENT },
    red: { bg: 'rgba(255,77,106,0.12)', text: RED },
    amber: { bg: 'rgba(255,179,71,0.12)', text: AMBER },
    blue: { bg: 'rgba(77,159,255,0.12)', text: '#4D9FFF' },
    purple: { bg: 'rgba(157,110,239,0.12)', text: '#9D6EEF' },
  };
  const cc = colors[c] || colors.green;
  return (
    <span style={{ background: cc.bg, color: cc.text, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      background: SURFACE2, border: '1px solid ' + (accent ? ACCENT : BORDER),
      borderRadius: 12, padding: '16px 20px',
      boxShadow: accent ? '0 0 24px rgba(0,229,160,0.1), inset 0 0 20px rgba(0,229,160,0.03)' : 'none',
    }}>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ color: accent ? ACCENT : TEXT, fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChainSelector({ selected, onChange }: { selected: ChainKey[]; onChange: (v: ChainKey[]) => void }) {
  const chains: ChainKey[] = ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon'];
  const toggle = (c: ChainKey) => {
    if (selected.includes(c)) {
      if (selected.length > 1) onChange(selected.filter((x) => x !== c));
    } else {
      onChange([...selected, c]);
    }
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {chains.map((c) => {
        const active = selected.includes(c);
        return (
          <button key={c} onClick={() => toggle(c)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1px solid ' + (active ? ACCENT : BORDER),
            background: active ? 'rgba(0,229,160,0.15)' : 'transparent',
            color: active ? ACCENT : MUTED, cursor: 'pointer', transition: 'all 0.15s ease',
            fontFamily: 'Outfit, sans-serif',
          }}>
            {CHAINS[c].name}
          </button>
        );
      })}
    </div>
  );
}

function YieldTable({ data, sortKey }: { data: MarketData[]; sortKey: string }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid ' + BORDER }}>
            {['#', 'Asset', 'Protocol', 'Chain', 'Supply APY', 'Borrow APY', 'TVL', 'LTV', 'Status'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', color: DIM, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => {
            const protoIdx = PROTOCOL_NAMES.indexOf(d.protocol);
            const protoColor = protoIdx >= 0 ? P_COLORS[protoIdx % P_COLORS.length] : ACCENT;
            return (
              <tr key={d.chain + '-' + d.protocol + '-' + d.symbol + '-' + i}
                style={{ borderBottom: '1px solid ' + BORDER + '22' }}>
                <td style={{ padding: '10px 12px', color: DIM, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{i + 1}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.symbol}</td>
                <td style={{ padding: '10px 12px' }}><Badge color={d.protocol === 'Aave V3' ? 'purple' : d.protocol === 'Compound V3' ? 'green' : 'blue'}>{d.protocol}</Badge></td>
                <td style={{ padding: '10px 12px', color: MUTED, fontSize: 12 }}>{CHAINS[d.chain].name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: ACCENT, fontWeight: 600 }}>{d.supplyAPY > 0 ? fAPY(d.supplyAPY) : '\u2014'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: d.borrowAPY > 8 ? RED : AMBER, fontWeight: 600 }}>{d.borrowAPY > 0 ? fAPY(d.borrowAPY) : '\u2014'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: MUTED, fontSize: 12 }}>{d.TVL > 0 ? f$(d.TVL) : '\u2014'}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: MUTED, fontSize: 12 }}>{d.LTV > 0 ? (d.LTV * 100).toFixed(0) + '%' : '\u2014'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: d.available && d.supplyAPY > 0 ? ACCENT : DIM,
                    boxShadow: d.available && d.supplyAPY > 0 ? '0 0 6px ' + ACCENT : 'none',
                  }} />
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={9} style={{ padding: '40px 12px', textAlign: 'center', color: DIM }}>No markets found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function GasOptimizer() {
  const GAS_DATA = [
    { chain: 'Ethereum', avgGas: 2800000, gasPriceGwei: 30, ethPrice: 3450 },
    { chain: 'Arbitrum', avgGas: 1700000, gasPriceGwei: 0.15, ethPrice: 3450 },
    { chain: 'Optimism', avgGas: 1400000, gasPriceGwei: 0.005, ethPrice: 3450 },
    { chain: 'Base', avgGas: 1300000, gasPriceGwei: 0.005, ethPrice: 3450 },
    { chain: 'Polygon', avgGas: 2100000, gasPriceGwei: 60, ethPrice: 3450 },
  ];
  const data = GAS_DATA.map((g) => ({
    chain: g.chain,
    avgGas: g.avgGas,
    gasPriceGwei: g.gasPriceGwei,
    ethPrice: g.ethPrice,
    costUSD: (g.avgGas * g.gasPriceGwei / 1e9) * g.ethPrice,
  })).sort((a, b) => a.costUSD - b.costUSD);

  const cheapest = data[0];
  const mostExpensive = data[data.length - 1];
  const savings = mostExpensive.costUSD - cheapest.costUSD;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {data.map((g) => {
          const isCheapest = g.chain === cheapest.chain;
          return (
            <div key={g.chain} style={{
              background: isCheapest ? 'rgba(0,229,160,0.08)' : SURFACE2,
              border: '1px solid ' + (isCheapest ? ACCENT : BORDER),
              borderRadius: 10, padding: '14px 16px',
              boxShadow: isCheapest ? '0 0 16px rgba(0,229,160,0.1)' : 'none',
            }}>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 4 }}>{g.chain}</div>
              <div style={{ color: isCheapest ? ACCENT : TEXT, fontSize: 22, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                {'$' + g.costUSD.toFixed(2)}
              </div>
              {isCheapest && <Badge color="green">Cheapest</Badge>}
              <div style={{ color: DIM, fontSize: 10, marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                {g.gasPriceGwei} gwei
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: '16px 20px' }}>
        <div style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>💡 Gas Savings</div>
        <div style={{ color: TEXT, fontSize: 14 }}>
          Using <strong style={{ color: ACCENT }}>{cheapest.chain}</strong> saves{' '}
          <strong style={{ color: ACCENT }}>{f$(savings)}</strong>/tx vs {mostExpensive.chain}
        </div>
      </div>
    </div>
  );
}

function WhatIfCalculator({ data }: { data: MarketData[] }) {
  const [supplyAsset, setSupplyAsset] = useState('USDC');
  const [supplyAmount, setSupplyAmount] = useState('10000');
  const [borrowAsset, setBorrowAsset] = useState('USDC');
  const [borrowAmount, setBorrowAmount] = useState('5000');
  const supply = parseFloat(supplyAmount) || 0;
  const borrow = parseFloat(borrowAmount) || 0;
  const selected = data.find((d) => d.symbol === supplyAsset);
  const supplyAPY = selected ? selected.supplyAPY : 0;
  const borrowAPY = selected ? selected.borrowAPY : 0;
  const yearlyEarn = supply * supplyAPY / 100;
  const yearlyCost = borrow * borrowAPY / 100;
  const dailyCost = yearlyCost / 365;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Supply</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: DIM, fontSize: 11, marginBottom: 4 }}>Asset</label>
            <select value={supplyAsset} onChange={(e) => setSupplyAsset(e.target.value)} style={{
              width: '100%', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 8,
              color: TEXT, padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'Outfit, sans-serif',
            }}>
              {data.map((d) => <option key={d.chain + '-' + d.symbol} value={d.symbol}>{d.symbol}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: DIM, fontSize: 11, marginBottom: 4 }}>Amount (USD)</label>
            <input type="number" value={supplyAmount} onChange={(e) => setSupplyAmount(e.target.value)} style={{
              width: '100%', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 8,
              color: TEXT, padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'JetBrains Mono, monospace',
            }} />
          </div>
          {selected && (
            <div style={{ marginTop: 12, color: ACCENT, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
              Earn: {fAPY(supplyAPY)} APY → ${yearlyEarn.toFixed(2)}/yr
            </div>
          )}
        </div>
        <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Borrow</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: DIM, fontSize: 11, marginBottom: 4 }}>Asset</label>
            <select value={borrowAsset} onChange={(e) => setBorrowAsset(e.target.value)} style={{
              width: '100%', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 8,
              color: TEXT, padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'Outfit, sans-serif',
            }}>
              {data.map((d) => <option key={d.chain + '-' + d.symbol} value={d.symbol}>{d.symbol}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', color: DIM, fontSize: 11, marginBottom: 4 }}>Amount (USD)</label>
            <input type="number" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} style={{
              width: '100%', background: SURFACE, border: '1px solid ' + BORDER, borderRadius: 8,
              color: TEXT, padding: '8px 12px', fontSize: 14, outline: 'none', fontFamily: 'JetBrains Mono, monospace',
            }} />
          </div>
          {borrowAPY > 0 && (
            <div style={{ marginTop: 12, color: RED, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
              Cost: {fAPY(borrowAPY)} APR → ${dailyCost.toFixed(2)}/day
            </div>
          )}
        </div>
      </div>
      <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Summary</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><div style={{ color: DIM, fontSize: 11 }}>Net Position</div><div style={{ color: supply >= borrow ? ACCENT : RED, fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{f$(supply - borrow)}</div></div>
          <div><div style={{ color: DIM, fontSize: 11 }}>Yearly Earnings</div><div style={{ color: ACCENT, fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>${yearlyEarn.toFixed(0)}</div></div>
          <div><div style={{ color: DIM, fontSize: 11 }}>Yearly Cost</div><div style={{ color: RED, fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>${yearlyCost.toFixed(0)}</div></div>
        </div>
      </div>
    </div>
  );
}

function PortfolioSection({ wallet, positions }: { wallet: string; positions: any[] }) {
  if (!wallet) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', color: DIM }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👛</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Enter wallet address above</div>
      </div>
    );
  }
  const totalSupplied = positions.reduce((s, p) => s + (p.supplied || 0), 0);
  const totalBorrowed = positions.reduce((s, p) => s + (p.borrowed || 0), 0);
  const avgHF = positions.length > 0 ? positions.reduce((s, p) => s + (p.healthFactor || 0), 0) / positions.length : 0;
  const hfColor = avgHF <= 0 ? DIM : avgHF < 1.05 ? RED : avgHF < 1.5 ? AMBER : avgHF < 3 ? ACCENT : '#4D9FFF';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <MetricCard label="Total Supplied" value={f$(totalSupplied)} sub={positions.length + ' positions'} />
        <MetricCard label="Total Borrowed" value={f$(totalBorrowed)} sub="Outstanding debt" />
        <MetricCard label="Net Worth" value={f$(totalSupplied - totalBorrowed)} accent={totalSupplied >= totalBorrowed} />
        <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Health Factor</div>
          <div style={{ color: hfColor, fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{fHF(avgHF)}</div>
        </div>
      </div>
      {positions.length === 0 && (
        <div style={{ background: SURFACE2, border: '1px dashed ' + (BORDER || BORDER), borderRadius: 12, padding: 32, textAlign: 'center', color: DIM }}>
          No active positions found
        </div>
      )}
    </div>
  );
}

export default function LendingDashboard() {
  const [selectedChains, setSelectedChains] = useState<ChainKey[]>(['ethereum', 'arbitrum', 'optimism', 'base', 'polygon']);
  const [wallet, setWallet] = useState('');
  const [walletInput, setWalletInput] = useState('');
  const [tab, setTab] = useState('overview');
  const [sortKey, setSortKey] = useState('supplyAPY');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const allMarkets = await fetchAllMarkets(selectedChains);
      setMarkets(allMarkets);
      if (wallet && wallet.length === 42) {
        try {
          const pos = await fetchPortfolio(wallet, selectedChains);
          setPortfolio(pos);
        } catch (e) {
          setPortfolio([]);
        }
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [selectedChains, wallet]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWalletChange = (value: string) => {
    setWalletInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
        setWallet(value);
      } else if (value === '') {
        setWallet('');
        setPortfolio([]);
      }
    }, 600);
  };

  const filtered = useMemo(() => {
    return markets
      .filter((m) => selectedChains.includes(m.chain))
      .sort((a, b) => {
        if (sortKey === 'supplyAPY') return b.supplyAPY - a.supplyAPY;
        if (sortKey === 'TVL') return b.TVL - a.TVL;
        if (sortKey === 'borrowAPY') return b.borrowAPY - a.borrowAPY;
        if (sortKey === 'LTV') return b.LTV - a.LTV;
        return 0;
      });
  }, [markets, selectedChains, sortKey]);

  const topMarket = filtered[0];
  const avgSupplyAPY = filtered.length > 0
    ? filtered.filter((m) => m.supplyAPY > 0).reduce((s, m) => s + m.supplyAPY, 0) / filtered.filter((m) => m.supplyAPY > 0).length
    : 0;
  const totalTVL = filtered.reduce((s, m) => s + m.TVL, 0);

  const chainAPY = selectedChains.map((c) => {
    const chainMarkets = filtered.filter((m) => m.chain === c && m.supplyAPY > 0);
    const avg = chainMarkets.length > 0 ? chainMarkets.reduce((s, m) => s + m.supplyAPY, 0) / chainMarkets.length : 0;
    return { name: CHAINS[c].name, avgSupplyAPY: avg };
  });

  const chartData = filtered.slice(0, 15).map((d) => ({
    name: d.symbol + ' ' + d.chain.slice(0, 2).toUpperCase(),
    Supply: Math.max(0, d.supplyAPY),
    Borrow: Math.max(0, d.borrowAPY),
  }));

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'yields', label: 'Best Yields' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'tools', label: 'Tools' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#030B06', color: TEXT }}>
      {/* Header */}
      <header style={{
        background: 'rgba(3,11,6,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid ' + BORDER, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, background: 'rgba(0,229,160,0.15)',
                border: '1px solid ' + ACCENT, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 13 L9 5 L15 13" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 10 H13" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>LendScope</div>
                <div style={{ color: DIM, fontSize: 10, letterSpacing: '0.06em' }}>CROSS-CHAIN LENDING ANALYTICS</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <ChainSelector selected={selectedChains} onChange={setSelectedChains} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="text" placeholder="0x..." value={walletInput}
                onChange={(e) => handleWalletChange(e.target.value)}
                style={{
                  background: SURFACE, border: '1px solid ' + (wallet && wallet.length === 42 ? ACCENT : BORDER),
                  borderRadius: 8, color: TEXT, padding: '6px 12px', fontSize: 12,
                  width: 200, outline: 'none', fontFamily: 'JetBrains Mono, monospace',
                }} />
              <button onClick={fetchData} disabled={loading} style={{
                width: 36, height: 36, borderRadius: 8, border: '1px solid ' + BORDER,
                background: loading ? 'rgba(0,229,160,0.15)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: loading ? ACCENT : TEXT,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  style={loading ? { animation: 'spin 1s linear infinite' } : undefined}>
                  <path d="M14 8A6 6 0 1 1 8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 2L10 4L8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 16px', background: 'transparent',
                border: 'none', borderBottom: '2px solid ' + (tab === t.id ? ACCENT : 'transparent'),
                color: tab === t.id ? TEXT : MUTED, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 64px' }}>
        {lastUpdated && (
          <div style={{ color: DIM, fontSize: 11, marginBottom: 20, fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block' }} />
            Live · {lastUpdated.toLocaleTimeString()} · {filtered.length} markets
          </div>
        )}

        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              <MetricCard label="Best Supply APY" value={topMarket ? fAPY(topMarket.supplyAPY) : '\u2014'}
                sub={topMarket ? topMarket.symbol + ' on ' + topMarket.protocol : ''} accent />
              <MetricCard label="Avg Supply APY" value={fAPY(avgSupplyAPY)} sub="Across all chains" />
              <MetricCard label="Pools Tracked" value={filtered.length.toString()} sub={selectedChains.length + ' chains'} />
              <MetricCard label="Total TVL" value={f$(totalTVL)} />
            </div>

            <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Avg Supply APY by Chain</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chainAPY} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(1) + '%'} />
                    <Tooltip content={<CHART_TOOLTIP />} cursor={{ fill: 'rgba(0,229,160,0.04)' }} />
                    <Bar dataKey="avgSupplyAPY" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={60} opacity={0.85}>
                      {chainAPY.map((_, i) => (
                        <Cell key={i} fill={'rgba(0,229,160,' + (0.4 + i * 0.15) + ')'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Supply vs Borrow APY</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span style={{ color: ACCENT }}>■ Supply</span>
                  <span style={{ color: RED }}>■ Borrow</span>
                </div>
              </div>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: MUTED, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: MUTED, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(1) + '%'} />
                    <Tooltip content={<CHART_TOOLTIP />} cursor={{ fill: 'rgba(0,229,160,0.04)' }} />
                    <Legend wrapperStyle={{ color: MUTED, fontSize: 12, paddingTop: 12 }} />
                    <Bar dataKey="Supply" fill={ACCENT} radius={[3, 3, 0, 0]} maxBarSize={16} opacity={0.9} />
                    <Bar dataKey="Borrow" fill={RED} radius={[3, 3, 0, 0]} maxBarSize={16} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === 'yields' && (
          <div>
            <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Best Yields — {filtered.length} pools
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['supplyAPY', 'TVL', 'borrowAPY', 'LTV'].map((k) => (
                    <button key={k} onClick={() => setSortKey(k)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: '1px solid ' + (sortKey === k ? ACCENT : BORDER),
                      background: sortKey === k ? 'rgba(0,229,160,0.15)' : 'transparent',
                      color: sortKey === k ? ACCENT : MUTED, cursor: 'pointer',
                      fontFamily: 'Outfit, sans-serif',
                    }}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <YieldTable data={filtered} sortKey={sortKey} />
            </div>
          </div>
        )}

        {tab === 'portfolio' && (
          <div>
            <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
              <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                Portfolio
              </div>
              <PortfolioSection wallet={wallet} positions={portfolio} />
            </div>
          </div>
        )}

        {tab === 'tools' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
              <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>What-If Calculator</div>
              <WhatIfCalculator data={filtered} />
            </div>
            <div>
              <div style={{ background: SURFACE2, border: '1px solid ' + BORDER, borderRadius: 12, padding: 20 }}>
                <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 16 }}>Gas Optimizer</div>
                <GasOptimizer />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}