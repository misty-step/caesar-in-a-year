export default function HomePage() {
  return (
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-4xl px-6 py-20 space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-roman-500 font-semibold">Caesar in a Year</p>
        <h1 className="text-4xl sm:text-5xl font-serif font-semibold">Next.js 16 scaffold ready.</h1>
        <p className="text-lg text-roman-700 max-w-2xl">
          App Router, Turbopack, Clerk-ready layout, and design tokens are now in place. Continue with auth, data, and session flows.
        </p>
      </div>
    </main>
  );
}
