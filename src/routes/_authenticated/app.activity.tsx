import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEcho } from "@/components/echo-context";
import { spendingQuery, transactionsQuery } from "@/lib/queries";
import { formatMoney, formatWhen } from "@/lib/money";
import { asCategory, CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import { playEarcon } from "@/lib/audio";

export const Route = createFileRoute("/_authenticated/app/activity")({
  component: Activity,
});

function Activity() {
  const { data: transactions } = useQuery(transactionsQuery());
  const { data: spending } = useQuery(spendingQuery());
  const { say } = useEcho();

  return (
    <div className="space-y-8 py-4">
      <section>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Activity</h1>
        {spending ? (
          <>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{spending.spoken}</p>
            <button
              onClick={() => say(spending.spoken)}
              className="mt-3 min-h-12 rounded-xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
            >
              Read my month aloud
            </button>
          </>
        ) : null}
      </section>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(transactions ?? []).map((t) => {
          const category = asCategory(t.category);
          return (
            <li key={t.id}>
              <button
                onClick={() => {
                  playEarcon(category);
                  say(`${t.counterparty}. ${formatMoney(t.amountPence, { signed: true })}. ${formatWhen(t.occurredAt)}.`);
                }}
                className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent"
              >
                <span>
                  <span className="block text-lg font-semibold text-foreground">{t.counterparty}</span>
                  <span className={`block text-sm font-medium ${CATEGORY_COLOR[category]}`}>
                    {CATEGORY_LABEL[category]} · {formatWhen(t.occurredAt)}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
                  {formatMoney(t.amountPence, { signed: true })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
