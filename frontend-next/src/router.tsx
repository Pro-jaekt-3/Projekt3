import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import type { AuthState } from "./lib/role-context";

export interface RouterContext {
  queryClient: QueryClient;
  auth: AuthState;
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    // `auth` is supplied at render time by <RouterProvider context={{ auth }} />
    // (see main.tsx); the placeholder satisfies the typed root context.
    context: { queryClient, auth: undefined as unknown as AuthState },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
