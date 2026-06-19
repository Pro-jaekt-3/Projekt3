import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Filter, Search, Shield, GraduationCap, UserCircle2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { USERS } from "@/lib/mock-data";

import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/users")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin"]),
  component: UsersPage,
});

function UsersPage() {
  const [q, setQ] = useState("");
  const list = USERS.filter((u) =>
    !q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Manage users and roles across the system."
        actions={<Button size="sm"><UserPlus className="mr-1.5 h-4 w-4" /> Invite user</Button>}
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader><CardTitle className="text-base">Roles explained</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <RoleCard icon={<Shield className="h-4 w-4" />} title="Admin" body="Manages system configuration and oversight." />
              <RoleCard icon={<GraduationCap className="h-4 w-4" />} title="Instructor" body="Manages trainings, questions, assessments and results." />
              <RoleCard icon={<UserCircle2 className="h-4 w-4" />} title="Participant" body="Solves assigned assessments and views own results." />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="pl-9" />
          </div>
          <Button variant="outline" size="sm"><Filter className="mr-1.5 h-4 w-4" /> Filters</Button>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Last active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="capitalize text-xs">{u.role}</TableCell>
                    <TableCell><StatusBadge status={u.status} /></TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{u.lastActive}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">Change role</Button>
                      <Button variant="ghost" size="sm">Deactivate</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </>
  );
}

function RoleCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2"><span className="text-accent-foreground">{icon}</span><div className="text-sm font-semibold">{title}</div></div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
