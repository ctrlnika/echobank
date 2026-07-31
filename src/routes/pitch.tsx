import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pitch")({
  head: () => ({
    meta: [
      { title: "The case for EchoBank — audio-first banking" },
      {
        name: "description",
        content:
          "Why a UK bank should build an audio-first current account: two million people with sight loss, APP fraud losses, and an interface everyone benefits from.",
      },
      { property: "og:title", content: "The case for EchoBank — audio-first banking" },
      {
        property: "og:description",
        content: "The business case for audio-first banking: accessibility, fraud prevention, and reach.",
      },
    ],
  }),
  component: Pitch,
});

const POINTS = [
  {
    heading: "Two million people, one bad experience",
    body: "More than two million people in the UK live with sight loss. Today they use apps designed for eyes, translated after the fact by a screen reader. Menus read out of order, amounts split across elements, and confirmations that give no feedback at all.",
  },
  {
    heading: "Sound is faster than speech",
    body: "A spoken sentence takes seconds. A chord takes a quarter of one. EchoBank gives each category its own sound signature, so a customer knows what a payment is before the words arrive — the audio equivalent of glanceability.",
  },
  {
    heading: "Scam Shield pays for itself",
    body: "Authorised push payment fraud costs UK banks hundreds of millions a year, and reimbursement rules now put more of that on the bank. EchoBank explains the reasons a payment looks wrong, out loud, before the money moves — and makes the customer hold to confirm.",
  },
  {
    heading: "Built for one, used by everyone",
    body: "Hands full, eyes on the road, a cracked screen, a bad connection. The audio-first path is the fastest path for every customer, which is why this is a product investment rather than a compliance line item.",
  },
];

function Pitch() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-6">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-foreground">
          Echo<span className="text-primary">Bank</span>
        </Link>
        <Link
          to="/auth"
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-base font-semibold text-foreground hover:bg-accent"
        >
          Try the app
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 pb-24">
        <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
          The case for banking you can hear
        </h1>
        <div className="mt-10 space-y-10">
          {POINTS.map((point) => (
            <section key={point.heading}>
              <h2 className="font-display text-2xl font-bold text-foreground">{point.heading}</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{point.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
