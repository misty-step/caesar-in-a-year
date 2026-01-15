import type { Metadata } from 'next';
import { Inter, Fraunces, Crimson_Pro } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Display: Fraunces - warm, wonky, scholarly without Hollywood kitsch
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Serif: Crimson Pro - elegant Latin text
const crimson = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

// Sans: Inter - clean UI (Swiss precision)
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Caesar in a Year',
  description: 'Learn to read De Bello Gallico with daily guided sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${crimson.variable} ${inter.variable}`}>
      <body className="font-sans antialiased bg-background text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
