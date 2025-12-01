'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-roman-50 flex items-center justify-center py-16 px-4">
      <SignUp routing="path" path="/sign-up" appearance={{ variables: { colorPrimary: '#b84232' } }} />
    </main>
  );
}
