import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, Cloud, Activity, Pencil, Trash2, Brain, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState, ErrorState } from "@/components/common/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { qk } from "@/lib/query-keys";
import { aiService, type AiModel, type AiProvider, type CreateAiModelInput } from "@/services/ai";
import { ensureRole } from "@/lib/route-guards";

export const Route = createFileRoute("/app/ai-models")({
  beforeLoad: ({ context, location }) =>
    ensureRole({ auth: context.auth, href: location.href }, ["admin"]),
  component: AIModelsPage,
});

const errText = (e: unknown) => (e instanceof Error ? e.message : "Request failed");

const PROVIDERS: AiProvider[] = ["OLLAMA", "OPENAI", "DEEPSEEK", "OTHER"];

type FormState = {
  provider: AiProvider;
  modelName: string;
  displayName: string;
  baseUrl: string;
  isLocal: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  provider: "OLLAMA",
  modelName: "",
  displayName: "",
  baseUrl: "",
  isLocal: true,
  isActive: true,
};

function AIModelsPage() {
  const queryClient = useQueryClient();

  const modelsQuery = useQuery({ queryKey: qk.aiModels.list(), queryFn: aiService.listModels });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AiModel | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<AiModel | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: AiModel) => {
    setEditing(m);
    setForm({
      provider: m.provider,
      modelName: m.modelName,
      displayName: m.displayName ?? "",
      baseUrl: m.baseUrl ?? "",
      isLocal: m.isLocal,
      isActive: m.isActive,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: CreateAiModelInput = {
        provider: form.provider,
        modelName: form.modelName.trim(),
        displayName: form.displayName.trim() || null,
        baseUrl: form.baseUrl.trim() || null,
        isLocal: form.isLocal,
        isActive: form.isActive,
      };
      return editing ? aiService.updateModel(editing.id, payload) : aiService.createModel(payload);
    },
    onSuccess: (model) => {
      queryClient.invalidateQueries({ queryKey: qk.aiModels.all });
      toast.success(
        `Model “${model.displayName ?? model.modelName}” ${editing ? "updated" : "created"}`,
      );
      setDialogOpen(false);
    },
    // 409 duplicate (provider, modelName) and validation errors land here with
    // the backend `{ error }` message.
    onError: (e) => toast.error(errText(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => aiService.removeModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.aiModels.all });
      toast.success("Model deleted");
      setDeleteTarget(null);
    },
    // FK 409 ("referenced by N interactions — deactivate instead") arrives here;
    // surface the backend message rather than treating it as a crash.
    onError: (e) => toast.error(errText(e)),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => aiService.testModel(id),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message ?? "Connection OK");
      else toast.warning(result.message ?? "Model is not reachable");
    },
    // Non-Ollama providers respond 501; the thrown Error message is shown.
    onError: (e) => toast.error(errText(e)),
  });

  return (
    <>
      <PageHeader
        title="AI models"
        description="Configure which local Ollama / provider models are available. Suggestions never auto-approve content."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Add AI model
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Instructors never see API keys. AI suggestions are advisory and never auto-approve content
          — every suggestion is reviewed in the AI review queue.
        </div>

        <OllamaStatusCard />

        {modelsQuery.isLoading ? (
          <LoadingState label="Loading AI models…" />
        ) : modelsQuery.isError ? (
          <ErrorState message={errText(modelsQuery.error)} onRetry={() => modelsQuery.refetch()} />
        ) : (modelsQuery.data ?? []).length === 0 ? (
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title="No AI models configured"
            description="Add a local Ollama model to enable AI suggestions and advisory insights."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" /> Add AI model
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(modelsQuery.data ?? []).map((m) => (
              <Card key={m.id}>
                <CardHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{m.displayName ?? m.modelName}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {m.provider} · {m.modelName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge
                        status={m.isLocal ? "Local" : "Cloud"}
                        tone={m.isLocal ? "success" : "warning"}
                        icon={
                          m.isLocal ? <Shield className="h-3 w-3" /> : <Cloud className="h-3 w-3" />
                        }
                      />
                      <StatusBadge
                        status={m.isActive ? "Active" : "Inactive"}
                        tone={m.isActive ? "success" : "muted"}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <Kv label="Base URL" value={m.baseUrl ?? "— (provider default)"} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground">
                      Updated {new Date(m.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => testMutation.mutate(m.id)}
                        disabled={testMutation.isPending}
                      >
                        <Activity className="mr-1 h-3.5 w-3.5" /> Test
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(m)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit AI model" : "Add AI model"}</DialogTitle>
            <DialogDescription>
              Only the active local Ollama model is used for generation. Models must also be
              installed (<code>ollama pull</code>) to respond.
            </DialogDescription>
          </DialogHeader>
          <form
            id="ai-model-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.modelName.trim()) {
                toast.error("Model identifier is required");
                return;
              }
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider">
                <Select
                  value={form.provider}
                  onValueChange={(v) => setForm((f) => ({ ...f, provider: v as AiProvider }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Model identifier">
                <Input
                  value={form.modelName}
                  onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
                  placeholder="qwen3:8b"
                  autoFocus
                />
              </Field>
              <Field label="Display name">
                <Input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Local Reasoning"
                />
              </Field>
              <Field label="Base URL (optional)">
                <Input
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="http://localhost:11434"
                />
              </Field>
            </div>
            <div className="space-y-2 rounded-md border bg-surface p-3">
              <label className="flex items-center justify-between text-sm">
                <span>Local model</span>
                <Switch
                  checked={form.isLocal}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isLocal: v }))}
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>Active</span>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </label>
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" form="ai-model-form" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Add model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this AI model?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes “{deleteTarget?.displayName ?? deleteTarget?.modelName}”. If
              the model is referenced by existing AI interactions, the server will refuse and ask
              you to deactivate it instead — that message will be shown.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function OllamaStatusCard() {
  const statusQuery = useQuery({
    queryKey: qk.ai.list("ollama-status"),
    queryFn: aiService.ollamaStatus,
  });

  const data = statusQuery.data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Ollama runtime</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
        >
          <RefreshCw
            className={`mr-1 h-3.5 w-3.5 ${statusQuery.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {statusQuery.isLoading ? (
          <span className="text-muted-foreground">Checking Ollama…</span>
        ) : statusQuery.isError ? (
          <span className="text-destructive">{errText(statusQuery.error)}</span>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={data.reachable ? "Reachable" : "Offline"}
                tone={data.reachable ? "success" : "danger"}
              />
              <span className="text-xs text-muted-foreground">{data.baseUrl}</span>
            </div>
            {data.message && <p className="text-xs text-muted-foreground">{data.message}</p>}
            {data.reachable && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Installed models ({data.models.length})
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.models.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      None installed — run <code>ollama pull &lt;model&gt;</code>.
                    </span>
                  ) : (
                    data.models.map((name) => <StatusBadge key={name} status={name} tone="muted" />)
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-surface p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
