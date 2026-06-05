import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import type { AppUserRole } from "../auth/AuthProvider";

type ProtectedRouteProps = {
  allowedRoles: AppUserRole[];
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
    const requiredRoles = allowedRoles.join(" or ");
    const roleMismatchMessage = appUser
      ? `Your signed-in account has role ${appUser.role}. This page requires ${requiredRoles}.`
      : `This page requires ${requiredRoles}.`;
    const demoRoleHint =
      appUser?.role === "PARTICIPANT" &&
      allowedRoles.some((role) => role === "ADMIN" || role === "INSTRUCTOR")
        ? " For instructor/admin demo access, sign in with a Firebase account whose email matches a database user with that role."
        : "";

    return (
      <div className="p-10 text-center">
        <h1 className="text-3xl font-bold mb-4">
          Access Denied
        </h1>

        <p>
          {roleMismatchMessage}
          {demoRoleHint}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export default ProtectedRoute;
