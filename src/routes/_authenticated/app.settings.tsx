import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useEcho } from "@/components/echo-context";
import { overviewQuery } from "@/lib/queries";
import { setAccountFrozen, updateSettings } from "@/lib/bank.functions";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: Settings,
});

function Settings() {
  const { data } = useQuery(overviewQuery());
  const queryClient = useQueryClient();
  const { say } = useEcho();
  const [busy, setBusy] = useState(false);

  async function patch(update: Record<string, string | number | boolean>) {
    setBusy(true);
    try {
      await updateSettings({ data: update as never });
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="py-10 text-lg text-muted-foreground">Loading your preferences…</p>;

  return (
    <div className="space-y-8 py-4">
      <h1 className="font-display text-2xl font-extrabold text-foreground">Settings</h1>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <label htmlFor="rate" className="block text-base font-semibold text-foreground">
          Speaking speed
        </label>
        <input
          id="rate"
          type="range"
          min={0.6}
          max={1.8}
          step={0.1}
          defaultValue={data.profile.speechRate}
          onChange={(e) => void patch({ speech_rate: Number(e.target.value) })}
          className="w-full"
        />
        <button
          onClick={() => say("This is how fast EchoBank will speak to you.")}
          className="min-h-12 rounded-xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
        >
          Hear this speed
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        {[
          { key: "auto_speak" as const, label: "Speak my balance when I open the app", value: data.profile.autoSpeak },
          { key: "earcons_enabled" as const, label: "Play sound signatures", value: data.profile.earconsEnabled },
          { key: "haptics_enabled" as const, label: "Use vibration", value: data.profile.hapticsEnabled },
        ].map((row) => (
          <label key={row.key} className="flex min-h-12 items-center justify-between gap-4">
            <span className="text-base font-medium text-foreground">{row.label}</span>
            <input
              type="checkbox"
              checked={row.value}
              disabled={busy}
              onChange={(e) => void patch({ [row.key]: e.target.checked })}
              className="size-6"
            />
          </label>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl font-bold text-foreground">Card and payments</h2>
        <p className="mt-2 text-base text-muted-foreground">
          {data.account.frozen
            ? "Your card and payments are frozen. Nothing can leave your account."
            : "Your card and payments are active."}
        </p>
        <button
          onClick={async () => {
            const result = await setAccountFrozen({ data: { frozen: !data.account.frozen } });
            say(result.spoken);
            await queryClient.invalidateQueries();
          }}
          className="mt-4 min-h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground hover:bg-primary/90"
        >
          {data.account.frozen ? "Unfreeze my card" : "Freeze my card"}
        </button>
      </section>
    </div>
  );
}
