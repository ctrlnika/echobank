import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createDemoSession } from "@/lib/demo.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EchoBank — the current account you can hear" },
      {
        name: "description",
        content:
          "EchoBank is an audio-first UK current account. Every balance is spoken, every category has its own sound, and Scam Shield stops a payment before the money moves.",
      },
      { property: "og:title", content: "EchoBank — the current account you can hear" },
      {
        property: "og:description",
        content:
          "Audio-first banking designed with blind and low-vision customers: voice payments, sound signatures, and Scam Shield.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    label: "Sound signatures",
    body: "Every category has its own chord. Groceries, bills, transport — you know what a payment is before the sentence finishes.",
  },
  {
    label: "Say it, hear it back",
    body: "Speak a payment in plain English. EchoBank repeats the name and amount, and you hold to confirm. Nothing moves on a single tap.",
  },
  {
    label: "Scam Shield",
    body: "Before money leaves, EchoBank tells you exactly why a payment looks unusual — new payee, odd hour, urgency in how you were asked.",
  },
  {
    label: "Your post, read aloud",
    body: "Bank letters and bills arrive as clear spoken summaries, so nobody else has to open your mail.",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
  }, []);

  async function startDemo() {
    setStarting(true);
    try {
      const { email, password } = await createDemoSession();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await navigate({ to: "/app" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the demo");
      setStarting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
          Echo<span className="text-primary">Bank</span>
        </span>
        <nav className="flex items-center gap-2 text-base">
          <Link
            to="/pitch"
            className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            The case
          </Link>
          <Link
            to={hasSession ? "/app" : "/auth"}
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-semibold text-foreground hover:bg-accent"
          >
            {hasSession ? "Open my account" : "Sign in"}
          </Link>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-5 pb-24">
        <section className="pt-10 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Audio-first current account
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Banking that works when you never look at the screen.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Most banking apps are a picture with a voice bolted on. EchoBank is built the other
            way round: the sound comes first, and the screen is drawn from it. Blind customers get a
            full account — and everyone else gets a bank they can use with their hands full.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={startDemo}
              disabled={starting}
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-7 text-lg font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:opacity-60"
            >
              {starting ? "Opening a demo account…" : "Try it now — no sign-up"}
            </button>
            <Link
              to="/auth"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-border bg-card px-7 text-lg font-semibold text-foreground transition hover:bg-accent"
            >
              Sign in with email
            </Link>
          </div>
          <p className="mt-4 text-base text-muted-foreground">
            The demo opens a real account with real data, seeded from a real customer diary. Sound
            is on by default — headphones are worth it.
          </p>
        </section>

        <section aria-labelledby="pillars" className="mt-20">
          <h2 id="pillars" className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            Four things a screen reader can't give you
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((pillar) => (
              <li key={pillar.label} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="font-display text-xl font-bold text-foreground">{pillar.label}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{pillar.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-20 rounded-3xl border border-border bg-card p-8">
          <blockquote className="max-w-3xl">
            <p className="font-display text-xl leading-snug text-foreground sm:text-2xl">
              “I can do my whole account with my hands full and my phone in my pocket. It tells me
              what happened, and it tells me why it's asking.”
            </p>
            <footer className="mt-4 text-base text-muted-foreground">
              Gemma, 38 — the customer this account was designed around
            </footer>
          </blockquote>
          <Link
            to="/pitch"
            className="mt-7 inline-flex min-h-12 items-center rounded-xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
          >
            Read the business case
          </Link>
        </section>
      </main>
    </div>
  );
}
