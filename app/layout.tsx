import type { Metadata } from 'next';
import { Inter, Cinzel, Crimson_Pro } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// Display: Monumental, carved headlines - like Roman inscriptions
const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Serif: Elegant Latin text
const crimson = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap'
});

// Sans: Modern SaaS UI
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Caesar in a Year',
  description: 'Learn to read De Bello Gallico with daily guided sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${crimson.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
