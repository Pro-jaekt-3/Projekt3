import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth, googleProvider } from "../lib/firebase";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [message, setMessage] = useState("Sign in with email/password or Google.");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      if (user?.email) {
        setMessage(`Logged in as ${user.email}.`);
      } else {
        setMessage("Sign in with email/password or Google.");
      }
    });

    return unsubscribe;
  }, []);

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessage("Enter both email and password.");
      return;
    }

    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to sign in with email/password.";
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to sign in with Google.";
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      await signOut(auth);
      setPassword("");
      setMessage("You have been logged out.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to log out.";
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-gradient-to-br from-slate-100 via-white to-blue-50">
      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Firebase authentication
          </p>

          <h1 className="mb-5 text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Sign in to PROJEKT3
          </h1>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Email & password
              </p>
              
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Google sign-in
              </p>
              
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Welcome back
            </p>

            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              Login
            </h2>
          </div>

          <form className="space-y-5" onSubmit={handleEmailLogin}>
            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-700"
                htmlFor="email"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-medium text-slate-700"
                htmlFor="password"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              or
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleLogin}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-800">
            {message}
          </div>

          {currentUser && (
            <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-medium text-emerald-900">
                Logged in as
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                {currentUser.email || "Google account without public email"}
              </p>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleLogout}
                className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Logout
              </button>
            </div>
          )}

          <p className="mt-6 text-sm text-slate-500">
            Need a landing page instead?{" "}
            <Link className="font-semibold text-blue-700 hover:text-blue-800" to="/">
              Go back home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
