import { cn } from "@/lib/utils";

// Small inline loading spinner reused by query loading states.
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

// Centered loading block for full-section query loading states.
export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-muted-foreground">
      <Spinner />
      {label && <span>{label}</span>}
    </div>
  );
}

// Inline error block for failed queries; message comes from Error.message
// (apiClient already extracts the backend `{ error }` field).
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="m-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm sm:m-6 lg:m-8">
      <div className="font-medium text-destructive">Something went wrong</div>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          Try again
        </button>
      )}
    </div>
  );
}
