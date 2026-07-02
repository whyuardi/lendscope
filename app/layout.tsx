import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LendScope — Cross-Chain Lending Analytics',
  description: 'Real-time APY comparison, liquidation alerts, and portfolio tracking across Aave, Compound, Morpho, and Radiant',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230A160D'/><path d='M8 22 L16 10 L24 22' stroke='%2300E5A0' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='M11 18 L21 18' stroke='%2300E5A0' stroke-width='2' stroke-linecap='round'/></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}