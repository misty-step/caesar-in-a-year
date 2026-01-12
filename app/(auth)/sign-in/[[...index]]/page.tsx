'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center py-16 px-4">
      <SignIn routing="path" path="/sign-in" appearance={{ variables: { colorPrimary: '#D64045' } }} />
    </main>
  );
}
