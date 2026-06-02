import { currentUser } from "./mockUser";

export const hasRole = (
  ...roles: string[]
) => {
  return roles.includes(currentUser.role);
};