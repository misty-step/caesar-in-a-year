import type { Metadata } from 'next';
import { Inter, Crimson_Pro } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Suspense } from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const crimson = Crimson_Pro({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Caesar in a Year',
  description: 'Learn to read De Bello Gallico with daily guided sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClerkProvider
        publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/dashboard"
        afterSignUpUrl="/dashboard"
      >
        <html lang="en" className={`${inter.variable} ${crimson.variable}`}>
          <body>{children}</body>
        </html>
      </ClerkProvider>
    </Suspense>
  );
}
