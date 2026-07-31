import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import { createDemoSession } from "@/lib/demo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — EchoBank" },
      {
        name: "description",
        content: "Sign in to your EchoBank audio-first current account, or open a demo account instantly.",
      },
      { property: "og:title", content: "Sign in — EchoBank" },
      { property: "og:description", content: "Sign in to your EchoBank audio-first current account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || "there" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then come back and sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in didn't work");
    } finally {
      setBusy(false);
    }
  }

  async function startDemo() {

    setBusy(true);
    try {
      const demo = await createDemoSession();
      const { error } = await supabase.auth.signInWithPassword({
        email: demo.email,
        password: demo.password,
      });
      if (error) throw error;
      await navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the demo");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background px-5 py-10">
      <main id="main" className="mx-auto w-full max-w-md">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-foreground">
          Echo<span className="text-primary">Bank</span>
        </Link>

        <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight text-foreground">
          {mode === "signin" ? "Sign in" : "Open an account"}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Or skip it entirely and{" "}
          <button
            type="button"
            onClick={startDemo}
            disabled={busy}
            className="min-h-11 font-semibold text-primary underline underline-offset-4 disabled:opacity-60"
          >
            open a demo account
          </button>
          .
        </p>

        {notice ? (
          <p
            role="status"
            className="mt-6 rounded-xl border border-border bg-card p-4 text-base text-foreground"
          >
            {notice}
          </p>
        ) : null}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card text-lg font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2.1H12z"
            />
            <path
              fill="#34A853"
              d="M6.6 14.3 5.9 15l-2.6 2c1.6 3.2 4.9 5.4 8.7 5.4 2.6 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.4-4z"
            />
            <path fill="#FBBC05" d="M3.3 7c-.7 1.4-1.1 3-1.1 5s.4 3.6 1.1 5l3.3-2.6a6 6 0 0 1 0-4.8L3.3 7z" />
            <path
              fill="#4285F4"
              d="M12 5.4c1.5 0 2.8.5 3.8 1.5l2.9-2.9C16.9 2.4 14.6 1.5 12 1.5 8.2 1.5 4.9 3.7 3.3 7l3.3 2.6A5.9 5.9 0 0 1 12 5.4z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-border" />
          <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-5">

          {mode === "signup" ? (
            <div>
              <label htmlFor="name" className="text-base font-semibold text-foreground">
                What should EchoBank call you?
              </label>
              <input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="given-name"
                className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="text-base font-semibold text-foreground">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-base font-semibold text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="mt-2 text-sm text-muted-foreground">At least 8 characters.</p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 min-h-11 text-base font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {mode === "signin" ? "I don't have an account yet" : "I already have an account"}
        </button>
      </main>
    </div>
  );
}
