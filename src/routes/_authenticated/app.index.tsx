import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useEcho } from "@/components/echo-context";
import { overviewQuery } from "@/lib/queries";
import { formatMoney, formatWhen } from "@/lib/money";
import { asCategory, CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/categories";
import { playEarcon } from "@/lib/audio";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { data, isLoading } = useQuery(overviewQuery());
  const { say, prefs } = useEcho();
  const spoken = useRef(false);

  useEffect(() => {
    if (!data || spoken.current || !prefs.autoSpeak) return;
    spoken.current = true;
    say(data.spokenSummary);
  }, [data, prefs.autoSpeak, say]);

  if (isLoading || !data) {
    return <p className="py-10 text-lg text-muted-foreground">Getting your account…</p>;
  }

  return (
    <div className="space-y-8 py-4">
      <section aria-labelledby="balance">
        <h1 id="balance" className="text-base font-semibold uppercase tracking-widest text-muted-foreground">
          Available balance
        </h1>
        <p className="mt-2 font-display text-5xl font-extrabold tabular-nums tracking-tight text-foreground">
          {formatMoney(data.account.balancePence)}
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          {data.account.name} · {data.account.sortCode} · ends {data.account.last4}
          {data.account.frozen ? " · frozen" : ""}
        </p>
        <button
          onClick={() => say(data.spokenSummary)}
          className="mt-4 min-h-12 rounded-xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
        >
          Say that again
        </button>
      </section>

      <section aria-labelledby="recent">
        <div className="flex items-baseline justify-between">
          <h2 id="recent" className="font-display text-xl font-bold text-foreground">
            Latest activity
          </h2>
          <Link to="/app/activity" className="min-h-11 text-base font-semibold text-primary leading-[2.75rem]">
            See all
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {data.recent.map((t) => {
            const category = asCategory(t.category);
            return (
              <li key={t.id}>
                <button
                  onClick={() => {
                    playEarcon(category);
                    say(
                      `${t.counterparty}. ${formatMoney(t.amountPence, { signed: true })}. ${formatWhen(t.occurredAt)}.`,
                    );
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
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/app/pay"
          className="min-h-16 rounded-2xl bg-primary px-6 text-lg font-bold leading-[4rem] text-primary-foreground"
        >
          Send money
        </Link>
        <Link
          to="/app/letters"
          className="min-h-16 rounded-2xl border border-border bg-card px-6 text-lg font-semibold leading-[4rem] text-foreground"
        >
          My post{data.unreadLetters > 0 ? ` · ${data.unreadLetters} new` : ""}
        </Link>
      </section>
    </div>
  );
}
