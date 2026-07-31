# EchoBank — production MVP

## What I found in your prototype (honest critique)

Read: `app/page.tsx`, `components/phone-demo.tsx` (546 lines, single component), `components/pitch-sections.tsx`, `components/accessibility-bar.tsx`, `hooks/use-speech.ts`, `lib/bank.ts`, `lib/audio.ts`.

**Strong — keeping all of it:** the earcon engine (shared AudioContext, soft envelope — genuinely good), Web Speech hook with real error mapping, the typed-command fallback, Scam Shield, confirm-before-pay, `maximumScale: 5` / `userScalable: true`, the skip link, live-region announcements.

**Weak, and why:**

1. **It's a pitch page with a toy inside a phone bezel.** A sighted judge sees a poster. The product is 380px wide in a corner. Nothing here is what Gemma would actually open.
2. **The accessibility bar is theatre.** High-contrast and A/A+/A++ are low-vision affordances. The brief says *full* visual impairment — the customer never sees the bar. It's the wrong headline feature and a judge who knows accessibility will spot it.
3. **`parseCommand` is a regex ladder.** Five intents. "Did I pay the gas this month?" returns `unknown`. The whole thesis is natural language; the demo dies on the first unscripted Q&A question.
4. **The mic is a tap target on a screen.** Gemma finds her guide dog, her fridge shelf, her train platform — she does not hunt for a button. No gesture layer, no wake affordance, no keyboard-first path.
5. **`speakMoney`, screen text and the earcon are three parallel truths.** Nothing guarantees the spoken sentence matches the balance on screen. That's a compliance failure at a bank.
6. **Scam Shield is a modal with copy in it.** No signal, no reasoning, no escalation. Judges will ask "what actually detects it?"
7. **Zero state.** Refresh and the payment vanishes. Not technically believable.
8. **546-line component, all state in one file.** Not the code quality you asked for.

## The product

`/` **is the app** — full-bleed, mobile-first, no bezel, no marketing. Judges land inside EchoBank as Gemma. `/pitch` carries the narrative.

### Three ideas that are actually new (the innovation score)

- **Sound-first information architecture.** Every screen has a canonical *audio layout*: a spoken summary sentence, an earcon grammar, and an ordered focus ring — authored as data, not as an afterthought over visuals. The screen renders *from* the audio model. Balance shown and balance spoken cannot diverge because they're one source.
- **Confirm-by-repeat-back.** Before money moves, EchoBank speaks the payment and requires the user to *say the amount back*, or press-and-hold for a 3-second haptic countdown that can be aborted by lifting. No blind "OK" on a modal. This is the single most defensible fraud/error-prevention feature and it maps straight to Gemma's coin-by-touch verification.
- **Scam Shield with a visible signal ledger.** The AI returns *reasons* — new payee, urgency language, amount outside her pattern, out-of-hours — each spoken, each scored. Adds a 12-hour cooling-off on high-risk first payments and a "Ask someone I trust" path (Gemma's diary is full of trusted-human delegation; no fintech ships this).

### Screens

| Route | Purpose |
|---|---|
| `/` | Voice home: greeting, balance, one spoken summary, big mic |
| `/assistant` | Conversational banking, streamed, full transcript |
| `/pay` | Payee → amount → Scam Shield → repeat-back confirm |
| `/activity` | Transactions with earcons; "explain this" per row |
| `/activity/$id` | AI plain-English explanation of a transaction |
| `/inbox` | Letters & statements read aloud, plus AI summary |
| `/help` | Emergency: freeze card, call, trusted contact |
| `/settings` | Speech rate, verbosity, haptics, earcon volume, trusted contacts |
| `/onboarding` | Audio-first first-run, voiceprint enrolment |
| `/auth` | Sign in / demo entry |
| `/pitch` | Judges: 5-point checklist, architecture, business model, roadmap |

### Interaction model (works with zero vision)

- **Edge-swipe gestures** on the app shell: swipe right/left = next/previous section with an earcon per landmark; two-finger tap = repeat last announcement; long-press anywhere = mic.
- **Every action reachable by keyboard**, single tab ring, visible focus, roving tabindex in lists.
- **Haptics** via Vibration API: distinct patterns for confirm, warning, error, success (with graceful no-op).
- **Speech settings persist** and apply to every utterance.
- Text-scale/high-contrast controls **move to Settings** where they belong — the front door is voice.

## Design language

Not the current dark navy. A calm, near-black canvas with a single warm signal colour, one heavyweight display face for numbers, generous 56px+ targets, and motion used only to confirm state (Framer Motion, all respecting `prefers-reduced-motion`). Reference points: Monzo's directness, Apple's restraint, Linear's typography. All tokens in `src/styles.css` — no hardcoded colours.

## Technical

- **TanStack Start + React 19 + TS + Tailwind v4 + shadcn/ui + Framer Motion.**
- **Lovable Cloud** for auth + Postgres: `profiles`, `accounts`, `payees`, `transactions`, `scam_checks`, `letters`, `trusted_contacts`, `assistant_messages`. RLS scoped to `auth.uid()`, explicit GRANTs, seeded via migration with Gemma's data so `/` is populated on first load.
- **Auth:** email/password + Google. A prominent **"Enter demo"** button signs judges straight in — no cold-start wall on stage.
- **AI (hybrid):** `/api/chat` streams via AI SDK + Lovable AI Gateway with tools (`get_balance`, `list_transactions`, `explain_transaction`, `draft_payment` with `needsApproval`, `assess_scam_risk`). A deterministic intent matcher answers the six demo commands instantly with zero network; anything else goes to the model. If the gateway 429s/402s or is slow, the UI degrades to the deterministic layer and says so out loud rather than hanging.
- Money mutations in `createServerFn` with `requireSupabaseAuth`; balances computed server-side, never trusted from the client.
- Speech synthesis stays browser-native (offline, free, instant) with a documented roadmap to neural TTS.

## Build order

1. Enable Cloud; migration with schema, RLS, GRANTs and seeded demo data.
2. Design tokens + app shell (announcer, gesture layer, haptics, audio provider).
3. Port and extend `audio.ts` / `use-speech.ts` into `src/lib/audio` + `src/hooks`.
4. Home, Activity, Inbox.
5. Pay flow + Scam Shield + repeat-back confirm.
6. AI route, tools, assistant screen, transaction explanations.
7. Onboarding, Settings, Help.
8. `/pitch` — customer profile (Gemma), problems→solutions, architecture diagram, journey, business model, roadmap, accessibility rationale.
9. Verification pass: Playwright keyboard-only walkthrough, screen-reader semantics audit, contrast check, per-route `head()` metadata.

## What you get back in chat

Screen-by-screen weak/why/fixed notes, component hierarchy, the user journey, accessibility rationale mapped to WCAG 2.2 AA/AAA criteria, technical architecture, and a 3-horizon roadmap — written so you can lift them into the pitch deck.

## Deliberate omissions

No card-management CRUD, no budgeting charts, no investments. They add screens, not points — and every one is a surface Gemma can't use.
