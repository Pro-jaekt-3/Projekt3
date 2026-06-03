import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

type ProtectedRouteProps = {
  allowedRoles: string[];
  children: ReactNode;
};

function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const { appUser, firebaseUser, isLoading, authError } = useAuth();

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-3xl font-bold mb-4">
          Loading
        </h1>

        <p>Checking access...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (authError) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-3xl font-bold mb-4">
          Access Denied
        </h1>

        <p>
          {authError}
        </p>
      </div>
    );
  }

  if (!appUser || !allowedRoles.includes(appUser.role)) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-3xl font-bold mb-4">
          Access Denied
        </h1>

        <p>
          You do not have permission to
          access this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
