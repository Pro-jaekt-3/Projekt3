import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Shield, GraduationCap, UserCircle2 } from "lucide-react";
import { z } from "zod";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { auth, googleProvider } from "@/lib/firebase";
import { useRole, isDevRoleOverrideEnabled, type Role } from "@/lib/role-context";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  // Already signed in? Skip the login page.
  beforeLoad: ({ context }) => {
    if (!context.auth.isLoading && context.auth.isAuthenticated) {
      throw redirect({ to: "/app/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Log in — PROJEKT3" },
      { name: "description", content: "Sign in to PROJEKT3." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useRole();
  const { redirect } = useSearch({ from: "/login" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const goToApp = () => {
    if (redirect) {
      if (typeof window !== "undefined") window.location.assign(redirect);
    } else {
      navigate({ to: "/app/dashboard" });
    }
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
      goToApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      goToApp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  // DEV-only fallback: preview any role without a real Firebase account.
  const continueAs = (role: Role) => {
    login(role);
    goToApp();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 sm:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">PROJEKT3</span>
        </Link>

        <div className="my-auto w-full max-w-sm self-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan, deliver and analyze knowledge assessments.
          </p>

          <form className="mt-6 space-y-3" onSubmit={handleEmailLogin}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.3 0-11.5-5.2-11.5-11.5S17.7 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.9l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 43.5c5 0 9.5-1.9 12.9-5l-5.9-5c-2 1.5-4.4 2.4-7 2.4-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l5.9 5C40.6 35 43.5 30 43.5 24c0-1.2-.1-2.4 0.1-3.5z"
                />
              </svg>
              Sign in with Google
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Authentication provided by Firebase
            </p>
          </form>

          {isDevRoleOverrideEnabled && (
            <>
              <div className="my-6 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Prototype roles
                </span>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => continueAs("admin")}
                >
                  <Shield className="mr-2 h-4 w-4" /> Continue as Admin
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => continueAs("instructor")}
                >
                  <GraduationCap className="mr-2 h-4 w-4" /> Continue as Instructor
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => continueAs("participant")}
                >
                  <UserCircle2 className="mr-2 h-4 w-4" /> Continue as Participant
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Dev-only role preview. In production, roles come from authentication and system
                permissions.
              </p>
            </>
          )}
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>

      <div className="hidden bg-gradient-to-br from-primary-soft via-surface to-surface-muted lg:flex lg:flex-col lg:justify-center lg:px-16">
        <blockquote className="max-w-md">
          <p className="text-2xl font-medium leading-snug tracking-tight text-foreground">
            “We design assessments around learning objectives — not around what's easy to grade.”
          </p>
          <footer className="mt-4 text-sm text-muted-foreground">
            Educational assessment platform for informatics teaching.
          </footer>
        </blockquote>
        <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="rounded-md border bg-card p-3">
            <div className="font-semibold text-foreground">28</div>
            participants
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="font-semibold text-foreground">42</div>
            questions
          </div>
          <div className="rounded-md border bg-card p-3">
            <div className="font-semibold text-foreground">+18%</div>
            pre→post
          </div>
        </div>
      </div>
    </div>
  );
}
