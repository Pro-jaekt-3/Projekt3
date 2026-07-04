import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, QrCode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { qk } from "@/lib/query-keys";
import { userTrainingsService } from "@/services/userTrainings";
import { ensureAuthenticated } from "@/lib/route-guards";

// Participant enrollment flow (QR / code). A QR code encodes a link of the form
//   /app/join?trainingId=<id>&token=<enrollmentToken>
// Opening it (authenticated) pre-fills the form; "Join" calls
// POST /trainings/:id/enroll which creates UserTraining(PARTICIPANT).

type JoinSearch = {
  trainingId?: number;
  token?: string;
};

export const Route = createFileRoute("/app/join")({
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    trainingId: search.trainingId ? Number(search.trainingId) : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  beforeLoad: ({ context, location }) =>
    ensureAuthenticated({ auth: context.auth, href: location.href }),
  component: JoinTraining,
});

function JoinTraining() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const [trainingId, setTrainingId] = useState(search.trainingId ? String(search.trainingId) : "");
  const [token, setToken] = useState(search.token ?? "");

  // Keep the form in sync when the page is opened via a (new) QR link.
  useEffect(() => {
    if (search.trainingId) setTrainingId(String(search.trainingId));
    if (search.token) setToken(search.token);
  }, [search.trainingId, search.token]);

  const myTrainingsQuery = useQuery({
    queryKey: qk.userTrainings.list("mine"),
    queryFn: userTrainingsService.myTrainings,
  });

  const enrollMutation = useMutation({
    mutationFn: () => userTrainingsService.enroll(trainingId.trim(), token.trim()),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: qk.userTrainings.all });
      if (result.alreadyEnrolled) {
        toast.info(`You are already enrolled in “${result.training.title}”`);
      } else {
        toast.success(`Enrolled in “${result.training.title}”`);
      }
      setToken("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to join the training"),
  });

  const memberships = myTrainingsQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Join a training"
        description="Scan a QR code from your instructor or enter the enrollment code manually."
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4" /> Enrollment code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!trainingId.trim() || !token.trim()) {
                  toast.error("Training ID and enrollment code are required");
                  return;
                }
                enrollMutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="join-training-id">Training ID</Label>
                <Input
                  id="join-training-id"
                  value={trainingId}
                  onChange={(e) => setTrainingId(e.target.value)}
                  placeholder="e.g. 3"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="join-token">Enrollment code</Label>
                <Input
                  id="join-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Code from the QR link"
                />
              </div>
              <Button type="submit" disabled={enrollMutation.isPending} className="w-full">
                {enrollMutation.isPending ? "Joining…" : "Join training"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-4 w-4" /> My trainings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myTrainingsQuery.isLoading ? (
              <LoadingState label="Loading your trainings…" />
            ) : myTrainingsQuery.isError ? (
              <ErrorState
                message={
                  myTrainingsQuery.error instanceof Error
                    ? myTrainingsQuery.error.message
                    : "Failed to load your trainings"
                }
                onRetry={() => myTrainingsQuery.refetch()}
              />
            ) : memberships.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="h-5 w-5" />}
                title="No trainings yet"
                description="Join a training with an enrollment code to see it here."
              />
            ) : (
              <ul className="divide-y">
                {memberships.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{m.training.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.role === "INSTRUCTOR" ? "Instructor" : "Enrolled"} ·{" "}
                        {new Date(m.enrolledAt).toLocaleDateString()}
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
