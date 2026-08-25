import { AuthGuard } from "@/components/layout/auth-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

// Every route here is gated behind client-side auth state and driven entirely
// by runtime API calls — there is no meaningful static HTML to prerender, and
// attempting to (Next's default) breaks on useAuthStore's zustand persist
// store having no localStorage during the build's server-side render pass.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
