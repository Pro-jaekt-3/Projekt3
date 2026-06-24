import { apiJsonFetch } from "./apiClient";
import type { UserRole } from "@/types";

// Admin users domain service. Thin wrapper over apiClient — every call goes
// through the Bearer-token fetch. Endpoints (backend/routes/userRoutes.js, ADMIN):
//   GET   /users            -> AdminUser[]   (ordered by email asc)
//   PATCH /users/:id/role   -> AdminUser     body: { role }
//                              400 invalid/missing role · 404 not found ·
//                              403 if an admin tries to change their OWN role away from ADMIN
//
// The list is a projection (USER_SELECT) — not the full frozen `User` (no
// externalAuthId), so it is typed locally here. UserRole is imported from the
// frozen src/types rather than redefined.

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  firebaseUid: string | null;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const usersService = {
  list: () => apiJsonFetch<AdminUser[]>("/users"),

  updateRole: (id: number | string, role: UserRole) =>
    apiJsonFetch<AdminUser>(`/users/${id}/role`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ role }),
    }),
};
