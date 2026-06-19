import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";

import { getRouter } from "./router";
import { RoleContext, useAuthController } from "./lib/role-context";
import "./styles.css";

const router = getRouter();

function App() {
  // Single auth source, lifted ABOVE the router so beforeLoad guards can read it
  // via the router context, and useRole() can read it via RoleContext.
  const auth = useAuthController();

  // Re-run route guards whenever auth meaningfully changes (login / logout /
  // dev role switch) so protected routes re-evaluate without a full reload.
  useEffect(() => {
    void router.invalidate();
  }, [auth.isAuthenticated, auth.role, auth.isLoading]);

  // Gate render on auth resolution: guards then always see a settled auth state,
  // which avoids a /login flash (or wrong-role content) on refresh.
  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <RoleContext.Provider value={auth}>
      <RouterProvider router={router} context={{ auth }} />
    </RoleContext.Provider>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error('Root element "#root" not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
