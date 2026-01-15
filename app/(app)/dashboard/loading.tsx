export default function DashboardLoading() {
  return (
    <main className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8 animate-pulse">
        {/* Hero skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-32 bg-surface rounded" />
          <div className="h-12 w-96 bg-surface rounded" />
          <div className="h-6 w-80 bg-border rounded" />
        </div>

        {/* Stats skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-card border border-border p-6 h-32" />
          ))}
        </div>

        {/* Session card skeleton */}
        <div className="bg-surface rounded-card border border-border p-6 h-24" />

        {/* Progress grid skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-surface rounded-card border border-border p-6 h-48" />
          <div className="bg-surface rounded-card border border-border p-6 h-48" />
        </div>

        {/* Journey progress skeleton */}
        <div className="bg-surface rounded-card border border-border p-6 h-28" />

        {/* Heatmap skeleton */}
        <div className="bg-surface rounded-card border border-border p-6 h-40" />
      </div>
    </main>
  );
}
