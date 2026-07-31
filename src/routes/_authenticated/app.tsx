import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EchoContext, type EchoPrefs } from "@/components/echo-context";
import { useSpeech } from "@/hooks/use-speech";
import { overviewQuery, payeesQuery } from "@/lib/queries";
import { parseCommand, COMMAND_EXAMPLES } from "@/lib/commands";
import { setEarconsEnabled, playEarcon, unlockAudio } from "@/lib/audio";
import { setHapticsEnabled } from "@/lib/haptics";
import { speakAmount } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { hasArmedHold } from "@/components/hold-to-confirm";
import { matchPayeeName } from "@/lib/payee-match";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app", label: "Home", exact: true },
  { to: "/app/activity", label: "Activity", exact: false },
  { to: "/app/pay", label: "Pay", exact: false },
  { to: "/app/letters", label: "Post", exact: false },
  { to: "/app/assistant", label: "Ask", exact: false },
  { to: "/app/settings", label: "Settings", exact: false },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQuery(overviewQuery());
  const { data: payees } = useQuery(payeesQuery());
  const [lastSpoken, setLastSpoken] = useState("");

  const prefs: EchoPrefs = data
    ? { ...data.profile, verbosity: (data.profile.verbosity as EchoPrefs["verbosity"]) ?? "standard" }
    : {
    displayName: "there",
    speechRate: 1,
    verbosity: "standard" as const,
    hapticsEnabled: true,
    earconsEnabled: true,
    autoSpeak: false,
    onboarded: false,
  };

  const speech = useSpeech({
    onResult: (transcript) => handleCommand(transcript),
    onError: (message) => toast.error(message),
  });
  const { speak, setRate } = speech;

  useEffect(() => {
    setRate(prefs.speechRate);
    setEarconsEnabled(prefs.earconsEnabled);
    setHapticsEnabled(prefs.hapticsEnabled);
  }, [prefs.speechRate, prefs.earconsEnabled, prefs.hapticsEnabled, setRate]);

  const say = useCallback(
    (text: string) => {
      setLastSpoken(text);
      speak(text);
    },
    [speak],
  );

  const handleCommand = useCallback(
    (transcript: string) => {
      const command = parseCommand(transcript);
      switch (command.kind) {
        case "balance":
          if (data) say(`You have ${speakAmount(data.account.balancePence)} available.`);
          return;
        case "activity":
          void navigate({ to: "/app/activity" });
          return;
        case "letters":
          void navigate({ to: "/app/letters" });
          return;
        case "people":
        case "pay": {
          if (command.kind !== "pay") {
            void navigate({ to: "/app/pay", search: {} });
            return;
          }
          // Speech recognition mangles short names ("Nika" -> "new car"), so
          // snap the heard name onto a saved payee when it sounds like one.
          const names = (payees ?? []).map((p) => p.name);
          const resolved = matchPayeeName(command.payee, names) ?? command.payee;
          void navigate({
            to: "/app/pay",
            search: { payee: resolved, amount: command.amountPence },
          });
          return;
        }
        case "spending":
          void navigate({ to: "/app/activity" });
          return;
        case "settings":
          void navigate({ to: "/app/settings" });
          return;
        case "freeze":
          void navigate({ to: "/app/settings" });
          say("Freezing and unfreezing your card is here in settings.");
          return;
        case "help":
          say(`You can say: ${COMMAND_EXAMPLES.join(". ")}.`);
          return;
        default:
          void navigate({ to: "/app/assistant", search: { q: transcript } });
      }
    },
    [data, navigate, payees, say],
  );

  const beginListening = useCallback(() => {
    unlockAudio();
    playEarcon("listening");
    speech.startListening();
  }, [speech]);

  // Space anywhere on the page = tap and speak, unless the focus is somewhere
  // that already owns the space key (typing, or a button such as hold-to-pay).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" && event.key !== " ") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;
      // A payment awaiting confirmation owns the space key.
      if (hasArmedHold()) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, button, [role='button'], [contenteditable='true']"))
      ) {
        return;
      }
      event.preventDefault();
      if (speech.isListening) speech.stopListening();
      else beginListening();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beginListening, speech]);

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
  }

  return (
    <EchoContext.Provider
      value={{
        prefs,
        say,
        stopSpeaking: speech.cancelSpeech,
        isSpeaking: speech.isSpeaking,
        isListening: speech.isListening,
        startListening: beginListening,
        recognitionSupported: speech.recognitionSupported,
        lastSpoken,
      }}
    >
      <div className="min-h-dvh bg-background pb-40">
        <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link to="/app" className="font-display text-lg font-extrabold tracking-tight text-foreground">
            Echo<span className="text-primary">Bank</span>
          </Link>
          <button
            onClick={signOut}
            className="min-h-11 rounded-xl px-3 text-base font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Sign out
          </button>
        </header>

        <main id="main" className="mx-auto max-w-2xl px-5">
          <Outlet />
        </main>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-5 py-3">
            <p aria-live="polite" className="min-h-6 text-sm text-muted-foreground">
              {speech.isListening ? "Listening…" : speech.interim || lastSpoken}
            </p>
            <button
              onClick={() => (speech.isListening ? speech.stopListening() : beginListening())}
              aria-label="Speak a command. Shortcut: press the space bar."
              aria-pressed={speech.isListening}
              className="min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground transition hover:bg-primary/90"
            >
              {speech.isListening ? "Listening — speak now" : "Tap and speak"}
              <span className="ml-2 text-sm font-semibold opacity-80">Space</span>
            </button>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Press <kbd className="rounded bg-accent px-1.5 py-0.5 font-semibold">Space</kbd> anywhere to speak · hold{" "}
              <kbd className="rounded bg-accent px-1.5 py-0.5 font-semibold">Space</kbd> on a payment button to send
            </p>
            <nav aria-label="Sections" className="mt-3 flex justify-between gap-1">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "min-h-11 flex-1 rounded-xl px-1 text-center text-sm font-semibold leading-[2.75rem]",
                      active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </EchoContext.Provider>
  );
}
