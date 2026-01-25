// Force dynamic rendering for all authenticated routes
// This prevents prerendering errors when Clerk keys aren't available during CI builds
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
