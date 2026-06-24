import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, GraduationCap, UserCircle2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/types";
import { qk } from "@/lib/query-keys";
import { usersService, type AdminUser } from "@/services/users";
import { useRole } from "@/lib/role-context";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/users")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin"]),
  component: UsersPage,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

const ROLES: UserRole[] = ["ADMIN", "INSTRUCTOR", "PARTICIPANT"];
const roleLabel = (r: UserRole) => r.charAt(0) + r.slice(1).toLowerCase();

function UsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useRole();

  const usersQuery = useQuery({ queryKey: qk.users.list(), queryFn: usersService.list });

  const [q, setQ] = useState("");

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: UserRole }) => usersService.updateRole(id, role),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: qk.users.all });
      toast.success(`${updated.email} is now ${roleLabel(updated.role)}`);
    },
    // 403 (admin demoting their own account away from ADMIN), 400, 404 all arrive
    // here with the backend `{ error }` message — surface it, never crash.
    onError: (e) => toast.error(errText(e)),
  });

  if (usersQuery.isLoading) return <LoadingState label="Loading users…" />;
  if (usersQuery.isError) {
    return <ErrorState message={errText(usersQuery.error)} onRetry={() => usersQuery.refetch()} />;
  }

  const all = usersQuery.data ?? [];
  const needle = q.trim().toLowerCase();
  const list = needle
    ? all.filter(
        (u) =>
          u.email.toLowerCase().includes(needle) || (u.name ?? "").toLowerCase().includes(needle),
      )
    : all;

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="View all users and change their role. Role changes apply immediately."
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roles explained</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <RoleCard
                icon={<Shield className="h-4 w-4" />}
                title="Admin"
                body="Manages system configuration and oversight."
              />
              <RoleCard
                icon={<GraduationCap className="h-4 w-4" />}
                title="Instructor"
                body="Manages trainings, questions, assessments and results."
              />
              <RoleCard
                icon={<UserCircle2 className="h-4 w-4" />}
                title="Participant"
                body="Solves assigned assessments and views own results."
              />
            </div>
          </CardContent>
        </Card>

        {all.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-5 w-5" />}
            title="No users yet"
            description="Users appear here once they have signed in at least once."
          />
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or email"
                className="pl-9"
              />
            </div>

            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Email</TableHead>
                      <TableHead className="w-[220px]">Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isSelf={u.email === currentUser.email}
                        pending={roleMutation.isPending && roleMutation.variables?.id === u.id}
                        onChange={(role) => roleMutation.mutate({ id: u.id, role })}
                      />
                    ))}
                    {list.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No users match “{q}”.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function UserRow({
  user,
  isSelf,
  pending,
  onChange,
}: {
  user: AdminUser;
  isSelf: boolean;
  pending: boolean;
  onChange: (role: UserRole) => void;
}) {
  // The backend rejects an admin demoting their OWN account away from ADMIN (403).
  // Mirror that preventively: for the signed-in admin's own row, disable the
  // non-ADMIN options so the demote can't be attempted. Backend stays the guard.
  const lockSelfDemote = isSelf && user.role === "ADMIN";

  return (
    <TableRow>
      <TableCell className="font-medium">
        {user.name ?? "—"}
        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
      </TableCell>
      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
        {user.email}
      </TableCell>
      <TableCell>
        <Select
          value={user.role}
          disabled={pending}
          onValueChange={(role) => {
            if (role !== user.role) onChange(role as UserRole);
          }}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r} disabled={lockSelfDemote && r !== "ADMIN"}>
                {roleLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}

function RoleCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="text-accent-foreground">{icon}</span>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
