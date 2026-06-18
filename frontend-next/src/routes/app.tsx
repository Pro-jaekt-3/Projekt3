import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/app")({
  beforeLoad: ({ location }) => {
    // Client-side only: AppShell + role context handle gating in browser.
    // SSR-safe: we don't read localStorage here; redirect is handled in component if needed.
    void location;
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
