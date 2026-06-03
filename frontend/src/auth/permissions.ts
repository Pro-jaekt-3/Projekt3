import type { AppUserRole } from "./AuthProvider";

export const hasRole = (
  currentRole: AppUserRole | null | undefined,
  ...roles: AppUserRole[]
) => {
  if (!currentRole) {
    return false;
  }

  return roles.includes(currentRole);
};
