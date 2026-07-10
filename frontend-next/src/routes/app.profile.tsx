import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useRole } from "@/lib/role-context";
import { auth } from "@/lib/firebase";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/profile")({
  beforeLoad: ({ context, location }) =>
    ensureRole(
      { auth: context.auth, href: location.href },
      ["admin", "instructor", "participant"],
    ),
  component: ProfilePage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "ADMIN",
  instructor: "INSTRUCTOR",
  participant: "PARTICIPANT",
};

function ProfilePage() {
  const { user, role } = useRole();
  const [isSendingReset, setIsSendingReset] = useState(false);

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  const handleChangePassword = async () => {
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Password reset email sent");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send password reset email.",
      );
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" description="Your account details." />
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="max-w-xl">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary text-base text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileField label="Display name" value={user.name} />
              <ProfileField label="Email" value={user.email} />
              <ProfileField
                label="Role"
                value={<StatusBadge status={ROLE_LABEL[role] ?? role.toUpperCase()} />}
              />
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium">Password</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Send a password reset link to your email to change your password.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleChangePassword}
                disabled={isSendingReset}
              >
                <KeyRound className="mr-1.5 h-4 w-4" />
                {isSendingReset ? "Sending…" : "Change password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
