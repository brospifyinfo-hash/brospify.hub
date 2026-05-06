import { AdminErrorBoundary } from "@/components/AdminErrorBoundary";

// Wraps /admin so a top-level crash inside `page.tsx` (state init,
// import error, rendering bug) shows the recovery card instead of a
// white screen. The page-internal boundaries handle per-tab failures.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminErrorBoundary label="Admin-Panel">
      {children}
    </AdminErrorBoundary>
  );
}
