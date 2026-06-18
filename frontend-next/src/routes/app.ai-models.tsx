import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Shield, Cloud, Activity } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AI_MODELS } from "@/lib/mock-data";

export const Route = createFileRoute("/app/ai-models")({
  component: AIModelsPage,
});

function AIModelsPage() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="AI models"
        description="Configure which AI models are available to instructors in contextual workflows."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add AI model</Button>
            </DialogTrigger>
            <AddModelDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <div className="rounded-md border bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Instructors never see API keys. AI suggestions never auto-approve content.
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {AI_MODELS.map((m) => (
            <Card key={m.id}>
              <CardHeader className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{m.displayName}</CardTitle>
                    <p className="text-xs text-muted-foreground">{m.provider} · {m.modelId}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge
                      status={m.location === "local" ? "Local" : "Cloud"}
                      tone={m.location === "local" ? "success" : "warning"}
                      icon={m.location === "local" ? <Shield className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                    />
                    <StatusBadge
                      status={m.enabled ? "Enabled" : "Disabled"}
                      tone={m.enabled ? "success" : "muted"}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Kv label="Context" value={m.contextWindow} />
                  <Kv label="Speed" value={m.speed} />
                  <Kv label="Quality" value={m.quality} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Use cases</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.useCases.map((u) => <StatusBadge key={u} status={u} tone="muted" />)}
                  </div>
                </div>
                {m.defaultFor.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Default for: <span className="font-medium text-foreground">{m.defaultFor.join(", ")}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Activity className={`h-3.5 w-3.5 ${m.lastTest.status === "ok" ? "text-emerald-600" : m.lastTest.status === "warn" ? "text-amber-600" : "text-rose-600"}`} />
                    Last test {m.lastTest.at}
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toast.success("Connection OK")}>Test</Button>
                    <Button size="sm" variant="ghost">{m.enabled ? "Disable" : "Enable"}</Button>
                    <Button size="sm" variant="ghost">Edit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Defaults</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Default model</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["Question drafting", "Equivalent question generation", "Equivalence checking", "Programming/code questions"].map((a) => (
                  <TableRow key={a}>
                    <TableCell>{a}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {AI_MODELS.find((m) => m.defaultFor.includes(a))?.displayName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost">Set</Button></TableCell>
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

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-surface p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-semibold">{value}</div>
    </div>
  );
}

function AddModelDialog({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Add AI model</DialogTitle>
        <DialogDescription>API keys are stored securely and never shown to instructors.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name"><Input placeholder="Local Reasoning" /></Field>
          <Field label="Provider">
            <Select defaultValue="ollama">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="openai">OpenAI-compatible API</SelectItem>
                <SelectItem value="custom">Custom local endpoint</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Model identifier"><Input placeholder="gpt-oss:120b" /></Field>
          <Field label="Endpoint / base URL"><Input placeholder="http://localhost:11434" /></Field>
          <Field label="API key (optional)"><Input type="password" placeholder="••••••••" /></Field>
          <Field label="Location">
            <Select defaultValue="local">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="cloud">Cloud</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="space-y-2 rounded-md border bg-surface p-3">
          <label className="flex items-center justify-between text-sm">
            <span>Enabled</span><Switch defaultChecked />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Available to instructors</span><Switch defaultChecked />
          </label>
        </div>
        <div>
          <Label className="text-xs">Allowed actions</Label>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {["Generate question draft", "Improve question", "Generate equivalent variant", "Check equivalence", "Generate explanation", "Convert question type"].map((a) => (
              <label key={a} className="flex items-start gap-2 text-sm">
                <Checkbox defaultChecked className="mt-0.5" />
                <span>{a}</span>
              </label>
            ))}
          </div>
        </div>
        <Field label="Admin notes"><Textarea rows={2} placeholder="Internal note for other admins…" /></Field>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { toast.success("Connection OK"); }}>Test connection</Button>
        <Button onClick={() => { toast.success("Model saved"); onClose(); }}>Save model</Button>
      </DialogFooter>
    </DialogContent>
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
