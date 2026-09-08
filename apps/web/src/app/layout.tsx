import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'GridPulse — P2P Renewable Energy Trading Platform',
  description: 'Decentralized peer-to-peer renewable energy trading platform and virtual microgrid simulator. Trade solar energy with your neighbors in real-time.',
  keywords: ['P2P energy trading', 'renewable energy', 'microgrid', 'solar energy', 'blockchain-free trading'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
