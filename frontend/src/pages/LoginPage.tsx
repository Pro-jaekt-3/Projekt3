import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    "Firebase authentication is not connected yet. This screen is ready for the next step."
  );

  const handleEmailLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setMessage("Enter both email and password to test the login form state.");
      return;
    }

    setMessage(
      `Login UI ready. Next step: connect Firebase sign-in for ${email.trim()}.`
    );
  };

  const handleGoogleLogin = () => {
    setMessage("Google sign-in button is ready to be connected to Firebase Auth.");
  };

  return (
    <div className="min-h-[calc(100vh-73px)] bg-gradient-to-br from-slate-100 via-white to-blue-50">
      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-10 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            Authentication foundation
          </p>

          <h1 className="mb-5 text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Sign in to PROJEKT3
          </h1>

          <p className="mb-8 max-w-xl text-lg leading-8 text-slate-600">
            This is a basic login screen prepared for Firebase integration. It already
            gives you the structure for email/password login and a Google sign-in entry
            point.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Ready for email auth
              </p>
              <p className="text-sm text-slate-600">
                Add Firebase `signInWithEmailAndPassword` here later.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                Ready for Google auth
              </p>
              <p className="text-sm text-slate-600">
                Add Firebase `signInWithPopup` with Google provider when auth is enabled.
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
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Sign in
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
            onClick={handleGoogleLogin}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            Continue with Google
          </button>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm text-blue-800">
            {message}
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Need a landing page instead?
            {" "}
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
