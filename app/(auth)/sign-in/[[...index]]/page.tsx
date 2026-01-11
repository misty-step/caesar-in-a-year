'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-parchment flex items-center justify-center py-16 px-4">
      <SignIn routing="path" path="/sign-in" appearance={{ variables: { colorPrimary: '#66023C' } }} />
    </main>
  );
}
