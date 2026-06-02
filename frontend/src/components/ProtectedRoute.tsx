import type { ReactNode } from "react";
import { currentUser } from "../auth/mockUser";

type ProtectedRouteProps = {
  allowedRoles: string[];
  children: ReactNode;
};

function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  if (
    !allowedRoles.includes(
      currentUser.role
    )
  ) {
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