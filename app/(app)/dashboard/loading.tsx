export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-parchment text-ink">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8 animate-pulse">
        {/* Hero skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-12 w-96 bg-slate-200 rounded" />
          <div className="h-6 w-80 bg-slate-100 rounded" />
        </div>

        {/* Stats skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-parchment rounded-card border border-slate-200 p-6 h-32" />
          ))}
        </div>

        {/* Session card skeleton */}
        <div className="bg-parchment rounded-card border border-slate-200 p-6 h-24" />

        {/* Progress grid skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-parchment rounded-card border border-slate-200 p-6 h-48" />
          <div className="bg-parchment rounded-card border border-slate-200 p-6 h-48" />
        </div>

        {/* Journey progress skeleton */}
        <div className="bg-parchment rounded-card border border-slate-200 p-6 h-28" />

        {/* Heatmap skeleton */}
        <div className="bg-parchment rounded-card border border-slate-200 p-6 h-40" />
      </div>
    </main>
  );
}
