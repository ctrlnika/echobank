import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEcho } from "@/components/echo-context";
import { lettersQuery } from "@/lib/queries";
import { markLetterRead } from "@/lib/bank.functions";
import { formatWhen } from "@/lib/money";
import { playEarcon } from "@/lib/audio";

export const Route = createFileRoute("/_authenticated/app/letters")({
  component: Letters,
});

function Letters() {
  const { data: letters } = useQuery(lettersQuery());
  const queryClient = useQueryClient();
  const { say } = useEcho();

  return (
    <div className="space-y-6 py-4">
      <h1 className="font-display text-2xl font-extrabold text-foreground">My post</h1>
      <ul className="space-y-4">
        {(letters ?? []).map((letter) => (
          <li key={letter.id} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {letter.sender} · {formatWhen(letter.receivedAt)}
              {letter.readAt ? "" : " · new"}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-foreground">{letter.subject}</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{letter.body}</p>
            <button
              onClick={async () => {
                playEarcon("navigate");
                say(`${letter.sender}. ${letter.subject}. ${letter.body}`);
                if (!letter.readAt) {
                  await markLetterRead({ data: { id: letter.id } });
                  await queryClient.invalidateQueries();
                }
              }}
              className="mt-4 min-h-12 rounded-xl border border-border px-5 text-base font-semibold text-foreground hover:bg-accent"
            >
              Read this to me
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
