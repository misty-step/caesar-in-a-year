'use client';

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-roman-50 flex items-center justify-center py-16 px-4">
      <SignIn routing="path" path="/sign-in" appearance={{ variables: { colorPrimary: '#b84232' } }} />
    </main>
  );
}
