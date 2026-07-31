import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useEcho } from "@/components/echo-context";
import { HoldToConfirm } from "@/components/hold-to-confirm";
import { payeesQuery } from "@/lib/queries";
import { runScamCheck, sendPayment } from "@/lib/bank.functions";
import { formatMoney, poundsToPence, speakAmount } from "@/lib/money";
import { playEarcon } from "@/lib/audio";

type Search = { payee?: string | undefined; amount?: number | undefined };

export const Route = createFileRoute("/_authenticated/app/pay")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    payee: typeof search["payee"] === "string" ? search["payee"] : undefined,
    amount: typeof search["amount"] === "number" ? search["amount"] : undefined,
  }),
  component: Pay,
});

type Check = Awaited<ReturnType<typeof runScamCheck>>;

function Pay() {
  const search = Route.useSearch();
  const { data: payees } = useQuery(payeesQuery());
  const queryClient = useQueryClient();
  const { say } = useEcho();

  const [payee, setPayee] = useState(search.payee ?? "");
  const [amount, setAmount] = useState(search.amount ? (search.amount / 100).toFixed(2) : "");
  const [context, setContext] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSortCode, setNewSortCode] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");

  const amountPence = poundsToPence(amount);
  const selectedPayee =
    (payees ?? []).find((p) => p.name.toLowerCase() === payee.trim().toLowerCase()) ?? null;

  async function review() {
    if (!payee.trim() || amountPence <= 0) {
      toast.error("Say who you're paying and how much.");
      return;
    }
    setBusy(true);
    try {
      const result = await runScamCheck({
        data: { payeeName: payee.trim(), amountPence, context: context.trim() || undefined },
      });
      setCheck(result);
      playEarcon(result.level === "high" ? "scam" : result.level === "medium" ? "warning" : "success");
      say(
        `${result.summary} Paying ${payee.trim()}, ${speakAmount(amountPence)}. ` +
          result.signals.map((s) => s.detail).join(" "),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check that payment");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const result = await sendPayment({
        data: {
          payeeName: payee.trim(),
          amountPence,
          confirmation: "held",
          ...(check?.id ? { scamCheckId: check.id } : {}),
        },
      });
      if (!result.ok) {
        playEarcon("error");
        say(result.reason);
        toast.error(result.reason);
        return;
      }
      playEarcon("success");
      say(result.spoken);
      toast.success(result.spoken);
      setCheck(null);
      setAmount("");
      setContext("");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 py-4">
      <h1 className="font-display text-2xl font-extrabold text-foreground">Send money</h1>

      <div className="space-y-5">
        <div>
          <label htmlFor="payee" className="text-base font-semibold text-foreground">
            Who are you paying?
          </label>
          <input
            id="payee"
            value={payee}
            onChange={(e) => {
              setPayee(e.target.value);
              setCheck(null);
            }}
            list="payee-list"
            className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <datalist id="payee-list">
            {(payees ?? []).map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>

          <ul aria-label="Saved people" className="mt-3 space-y-2">
            {(payees ?? []).map((p) => {
              const selected = p.name.toLowerCase() === payee.trim().toLowerCase();
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setPayee(p.name);
                      setCheck(null);
                      say(
                        `${p.name}. Sort code ${speakSortCode(p.sortCode)}. Account number ending ${p.last4
                          .split("")
                          .join(" ")}.`,
                      );
                    }}
                    className={[
                      "min-h-16 w-full rounded-xl border px-4 py-3 text-left transition",
                      selected
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:bg-accent",
                    ].join(" ")}
                  >
                    <span className="block text-lg font-semibold text-foreground">
                      {p.name}
                      {p.relationship ? (
                        <span className="text-base font-normal text-muted-foreground"> · {p.relationship}</span>
                      ) : null}
                    </span>
                    <span className="block text-base tabular-nums text-muted-foreground">
                      Sort code {p.sortCode} · Account ending {p.last4}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selectedPayee ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">Account details</h2>
            <dl className="mt-2 space-y-1 text-base text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>Sort code</dt>
                <dd className="tabular-nums text-foreground">{selectedPayee.sortCode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Account number</dt>
                <dd className="tabular-nums text-foreground">•••• {selectedPayee.last4}</dd>
              </div>
            </dl>
          </div>
        ) : payee.trim() ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sortCode" className="text-base font-semibold text-foreground">
                Sort code
              </label>
              <input
                id="sortCode"
                inputMode="numeric"
                placeholder="00-00-00"
                value={newSortCode}
                onChange={(e) => setNewSortCode(e.target.value)}
                className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="accountNumber" className="text-base font-semibold text-foreground">
                Account number
              </label>
              <input
                id="accountNumber"
                inputMode="numeric"
                maxLength={8}
                placeholder="12345678"
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value.replace(/\D/g, ""))}
                className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="amount" className="text-base font-semibold text-foreground">
            How much, in pounds?
          </label>
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setCheck(null);
            }}
            className="mt-2 min-h-14 w-full rounded-xl border border-border bg-card px-4 text-lg tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="context" className="text-base font-semibold text-foreground">
            How were you asked for this money? (optional, but it powers Scam Shield)
          </label>
          <textarea
            id="context"
            rows={3}
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              setCheck(null);
            }}
            className="mt-2 w-full rounded-xl border border-border bg-card p-4 text-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          onClick={review}
          disabled={busy}
          className="min-h-14 w-full rounded-2xl border border-border bg-card text-lg font-bold text-foreground hover:bg-accent disabled:opacity-60"
        >
          {busy ? "Checking…" : "Check this payment"}
        </button>
      </div>

      {check ? (
        <section
          aria-live="assertive"
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="font-display text-xl font-bold text-foreground">
            {check.level === "high"
              ? "Stop and check this"
              : check.level === "medium"
                ? "Worth hearing first"
                : "This looks normal"}
          </h2>
          <p className="mt-2 text-base text-muted-foreground">{check.summary}</p>
          <ul className="mt-4 space-y-3">
            {check.signals.map((signal, index) => (
              <li key={`${signal.code}-${index}`}>
                <p className="text-base font-semibold text-foreground">{signal.label}</p>
                <p className="text-base text-muted-foreground">{signal.detail}</p>
              </li>
            ))}
            {check.signals.length === 0 ? (
              <li className="text-base text-muted-foreground">Nothing unusual came up.</li>
            ) : null}
          </ul>

          <p className="mt-6 text-lg font-semibold text-foreground">
            Paying {payee.trim()} {formatMoney(amountPence)}
          </p>
          {selectedPayee || newSortCode || newAccountNumber ? (
            <p className="mt-1 text-base tabular-nums text-muted-foreground">
              Sort code {selectedPayee ? selectedPayee.sortCode : newSortCode || "not given"} · Account{" "}
              {selectedPayee ? `ending ${selectedPayee.last4}` : newAccountNumber || "not given"}
            </p>
          ) : null}
          <div className="mt-3">
            <HoldToConfirm
              label={`Hold to send ${formatMoney(amountPence)}`}
              onConfirm={confirm}
              disabled={busy}
              durationMs={check.level === "high" ? 2600 : 1600}
              tone={check.level === "high" ? "danger" : "primary"}
            />
          </div>
          <button
            onClick={() => setCheck(null)}
            className="mt-3 min-h-12 w-full rounded-xl border border-border text-base font-semibold text-foreground hover:bg-accent"
          >
            Cancel this payment
          </button>
        </section>
      ) : null}
    </div>
  );
}

/** Reads "20-45-90" as "two zero, four five, nine zero" so it can't be misheard. */
function speakSortCode(sortCode: string): string {
  return sortCode
    .split("-")
    .map((pair) => pair.split("").join(" "))
    .join(", ");
}
