import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const crimson = Crimson_Pro({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Caesar in a Year',
  description: 'Learn to read De Bello Gallico with daily guided sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${crimson.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
