import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { COMMAND_EXAMPLES } from "@/lib/commands";

type Search = { q?: string | undefined };

export const Route = createFileRoute("/_authenticated/app/assistant")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
  }),
  component: Assistant,
});

function Assistant() {
  const { q } = Route.useSearch();
  return (
    <div className="space-y-6 py-4">
      <h1 className="font-display text-2xl font-extrabold text-foreground">Ask EchoBank</h1>
      {q ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-base text-foreground">
          I heard “{q}”, but I don't handle that one yet.
        </p>
      ) : null}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-foreground">Things you can say</h2>
        <ul className="mt-3 space-y-2 text-base text-muted-foreground">
          {COMMAND_EXAMPLES.map((example) => (
            <li key={example}>“{example}”</li>
          ))}
        </ul>
      </div>
      <Link
        to="/app"
        className="inline-flex min-h-12 items-center rounded-xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
      >
        Back to my account
      </Link>
    </div>
  );
}
