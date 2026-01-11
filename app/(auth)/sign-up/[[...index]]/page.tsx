'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-parchment flex items-center justify-center py-16 px-4">
      <SignUp routing="path" path="/sign-up" appearance={{ variables: { colorPrimary: '#66023C' } }} />
    </main>
  );
}
