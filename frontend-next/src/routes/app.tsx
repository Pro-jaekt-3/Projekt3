import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ensureAuthenticated } from "@/lib/route-guards";

export const Route = createFileRoute("/app")({
  // Gate the whole /app subtree: unauthenticated users go to /login, keeping
  // the intended destination so they land there after signing in.
  beforeLoad: ({ context, location }) =>
    ensureAuthenticated({ auth: context.auth, href: location.href }),
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
