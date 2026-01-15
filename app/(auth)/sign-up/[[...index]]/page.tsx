'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center py-16 px-4">
      <SignUp routing="path" path="/sign-up" appearance={{ variables: { colorPrimary: '#D64045' } }} />
    </main>
  );
}
