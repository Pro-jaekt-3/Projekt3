import { Link } from "react-router-dom";

import { EmptyState, PageHeader, SectionCard } from "../components/ui";

function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <PageHeader
        eyebrow="Admin control"
        title="Users & Roles"
        description="Manage user access and role assignments from one place when backend support is available."
        actions={
          <button type="button" disabled className="app-button-primary opacity-50">
            Add User
          </button>
        }
      />

      <SectionCard
        title="User management backend is not implemented yet"
        description="Firebase authentication and role-based access are active, but there is no safe user administration API for listing, creating or changing users from the frontend."
      >
        <EmptyState
          title="No user table available"
          description="This page is intentionally disabled instead of showing fake user data. Existing access still comes from Firebase auth plus the backend user record returned by /auth/me."
          action={
            <Link to="/" className="app-button-secondary">
              Back to Dashboard
            </Link>
          }
        />
      </SectionCard>
    </div>
  );
}

export default AdminUsersPage;
