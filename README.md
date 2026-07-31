# EchoBank

**Banking that works with your ears, not your eyes.**

EchoBank is a voice-first, audio-native banking MVP built for customers with complete visual impairment. It was designed for a banking innovation challenge around "Gemma" — a customer who is totally blind, banks independently, and is repeatedly failed by apps that assume sight.

Live app: https://echobankapp.app · Pitch page: https://echobankapp.app/pitch

---

## Table of contents

- [The problem](#the-problem)
- [What makes it different](#what-makes-it-different)
- [Screens](#screens)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [AI layer](#ai-layer)
- [Accessibility rationale](#accessibility-rationale)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Environment variables](#environment-variables)
- [Roadmap](#roadmap)

---

## The problem

Mainstream banking apps treat accessibility as a screen-reader retrofit: labels bolted onto a visual layout. The result is a customer who cannot confirm a payment amount without trusting a modal they can't see, can't scan a transaction list by shape, and has no way to sanity-check a suspicious request without asking a sighted person.

EchoBank inverts the design order. **The audio layout is authored first; the screen renders from it.** What is spoken and what is displayed come from one source, so they cannot diverge — which matters when the number in question is a bank balance.

## What makes it different

**1. Sound-first information architecture**
Every screen has a canonical spoken summary, an earcon grammar, and an ordered focus ring. Money is formatted once (`src/lib/money.ts`) and reused for both the DOM and the utterance, so the spoken balance and the rendered balance are guaranteed identical.

**2. Confirm-by-repeat-back**
Before money moves, EchoBank speaks the payment aloud and requires either the amount said back, or a press-and-hold with a haptic countdown that aborts on lift (`src/components/hold-to-confirm.tsx`). No blind "OK" on a modal — a direct analogue of verifying coins by touch.

**3. Scam Shield with a spoken signal ledger**
Risk is scored deterministically first (new payee, urgency language, amount outside pattern, out-of-hours), then optionally enriched by AI with the manipulation tactic in plain English. Every signal is spoken and scored, high-risk first payments get a cooling-off, and there's an "ask someone I trust" escalation path.

**4. Earcon engine**
A shared `AudioContext` synthesises short, soft-enveloped tones per transaction category (`src/lib/audio.ts`), so activity can be scanned by ear at speed rather than read row by row.

**5. Graceful degradation everywhere**
Speech recognition unsupported? Type the command. AI gateway rate-limited or down? A deterministic intent matcher (`src/lib/commands.ts`) answers the core commands with zero network, and the app says so out loud instead of hanging.

## Screens

| Route | Purpose |
|---|---|
| `/` | Landing — high contrast, one-tap demo entry |
| `/auth` | Email/password + Continue with Google |
| `/app` | Voice home: greeting, balance, spoken summary, mic |
| `/app/assistant` | Conversational banking with streamed responses and full transcript |
| `/app/pay` | Payee → amount → Scam Shield → repeat-back confirm |
| `/app/activity` | Transactions with per-category earcons and "explain this" |
| `/app/letters` | Statements and letters read aloud with AI summaries |
| `/app/settings` | Speech rate, verbosity, haptics, earcons, theme, text size |
| `/pitch` | Judge-facing narrative: problem, architecture, business model, roadmap |

## Tech stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| **React** | 19 | UI runtime |
| **TypeScript** | 5.8 (strict) | `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` all on |
| **TanStack Start** | 1.x | Full-stack React framework — SSR, file routing, server functions |
| **TanStack Router** | 1.x | Type-safe file-based routing (`src/routes`) |
| **TanStack Query** | 5.x | Server-state cache, loader prefetch + `useSuspenseQuery` |
| **Tailwind CSS** | 4.x | Styling via `@theme` tokens in `src/styles.css` — no `tailwind.config.js` |
| **shadcn/ui + Radix** | latest | Accessible primitives (dialog, select, switch, slider…) |
| **Motion** (Framer Motion) | 12.x | State-confirming animation, all gated on `prefers-reduced-motion` |
| **Lucide** | — | Icon set |
| **Sonner** | 2.x | Toasts, mirrored into the live region |
| **Zod** | 3.x | Runtime validation on every server-function input |

### Backend
| Technology | Role |
|---|---|
| **Lovable Cloud (Supabase / Postgres)** | Database, auth, row-level security |
| **TanStack `createServerFn`** | Typed RPC for all money and data operations |
| **Supabase Auth** | Email/password, Google OAuth, throwaway demo accounts |
| **Row Level Security** | Every table scoped to `auth.uid()` with explicit `GRANT`s |

### AI
| Technology | Role |
|---|---|
| **Lovable AI Gateway** | Model access, no user-supplied key |
| **Vercel AI SDK** (`ai` 7.x, `@ai-sdk/react`) | Streaming chat + tool calling |
| **`google/gemini-3.6-flash`** | Transaction explanations, scam enrichment, spending digests |

### Browser platform APIs
`SpeechSynthesis` · `SpeechRecognition` · `Web Audio API` (earcons) · `Vibration API` (haptics) · ARIA live regions

### Build & tooling
**Vite 8** · **Nitro** (Cloudflare Workers target) · **ESLint 9** + **typescript-eslint** · **Prettier** · **Bun**

## Architecture

```text
  Browser
  ┌───────────────────────────────────────────────────────┐
  │  React 19 / TanStack Router                           │
  │                                                       │
  │  EchoContext ── say() · listen() · lastSpoken         │
  │      ├── use-speech.ts   → SpeechSynthesis / Recognition
  │      ├── audio.ts        → Web Audio earcon engine    │
  │      ├── haptics.ts      → Vibration patterns         │
  │      └── commands.ts     → deterministic intent match │
  │                                                       │
  │  TanStack Query cache ── useSuspenseQuery             │
  └──────────────────────┬────────────────────────────────┘
                         │ typed RPC (createServerFn)
  Server (Cloudflare Worker)
  ┌──────────────────────┴────────────────────────────────┐
  │  bank.functions.ts   ← requireSupabaseAuth middleware │
  │      └── bank.queries.server.ts  (balances, payments) │
  │      └── bank.server.ts          (seed, assessRisk)   │
  │  ai.server.ts / ai-gateway.server.ts                  │
  └──────────────────────┬────────────────────────────────┘
                         │
  Lovable Cloud ── Postgres + RLS + Auth
```

Balances are always computed server-side and never trusted from the client. `*.server.ts` modules are blocked from the client bundle by filename; components import only `*.functions.ts`.

## Data model

| Table | Contents |
|---|---|
| `profiles` | Display name, speech rate, verbosity, haptics, earcons, `auto_speak`, onboarding state |
| `accounts` | Sort code, account number, balance in pence |
| `payees` | Saved recipients, first-payment flag, trust status |
| `transactions` | Amount, direction, category (drives the earcon), merchant, timestamp |
| `scam_checks` | Risk score, individual signals, decision, linked payment |
| `letters` | Bank correspondence, body text, read state, AI summary |
| `trusted_contacts` | Delegation targets for "ask someone I trust" |
| `assistant_messages` | Persisted conversation history |

Every table has RLS enabled with policies scoped to `auth.uid()` and explicit `GRANT`s to `authenticated` / `service_role`.

## AI layer

Hybrid by design:

1. **Deterministic first.** `commands.ts` resolves core intents (balance, recent activity, pay X, unread letters) instantly, offline, with no token spend.
2. **Model second.** Anything unscripted goes to the gateway with tools for balance lookup, transaction listing, transaction explanation, payment drafting (`needsApproval`), and scam assessment.
3. **Fallback always.** On `429`/`402`/timeout the UI drops back to the deterministic layer and announces the degradation rather than stalling — an important property for a demo on stage and for a bank in production.

## Accessibility rationale

Targeting **WCAG 2.2 AA**, with AAA on contrast and target size where practical.

- **Perceivable** — every state change is announced through a polite live region; earcons carry redundant non-speech meaning; contrast exceeds 7:1 in both themes.
- **Operable** — 56px+ targets (2.5.8 AAA), full keyboard path with a single visible focus ring, roving tabindex in lists, skip link, no timing-dependent interactions except the abortable hold-to-confirm.
- **Understandable** — one primary action per screen, consistent spoken sentence structure, plain-English AI explanations, no jargon.
- **Robust** — semantic landmarks and headings, correct roles on custom controls, `maximumScale: 5` with `userScalable: true`, honoured `prefers-reduced-motion`.
- **Error prevention (3.3.4/3.3.6)** — repeat-back confirmation, reversible drafts, cooling-off on high-risk first payments.

Theme and text scale (Normal / Large / Extra Large) live in Settings, applied before paint via an inline boot script so there is no flash.

## Project structure

```text
src/
├── components/
│   ├── appearance.tsx        theme + text-scale provider
│   ├── echo-context.ts       speech/listening context contract
│   ├── hold-to-confirm.tsx   haptic press-and-hold confirmation
│   └── ui/                   shadcn primitives
├── hooks/
│   └── use-speech.ts         synthesis + recognition with error mapping
├── lib/
│   ├── audio.ts              Web Audio earcon engine
│   ├── haptics.ts            vibration patterns
│   ├── money.ts              single source for shown + spoken money
│   ├── commands.ts           deterministic intent matcher
│   ├── categories.ts         category → earcon/label mapping
│   ├── bank.functions.ts     client-callable server RPCs
│   ├── bank.queries.server.ts  database operations
│   ├── bank.server.ts        seeding + deterministic risk engine
│   ├── ai.server.ts          explanations, risk enrichment, digests
│   ├── ai-gateway.server.ts  streaming gateway client
│   ├── demo.functions.ts     one-tap demo account provisioning
│   └── queries.ts            TanStack Query option factories
├── integrations/supabase/    generated client + auth middleware
├── routes/                   file-based routes (see table above)
└── styles.css                Tailwind v4 theme tokens, light + dark
```

## Running locally

Requires Node 20+ (or Bun) and npm.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev          # http://localhost:8080
```

Other scripts:

```sh
npm run build        # production build (Nitro → Cloudflare Workers)
npm run build:dev    # development-mode build
npm run preview      # serve the production build
npm run lint         # ESLint
npm run format       # Prettier
```

Voice input needs a Chromium-based browser (`SpeechRecognition`); speech output and every other feature work everywhere. Without a mic, use the typed command bar.

## Environment variables

Provisioned automatically by Lovable Cloud into `.env`:

| Variable | Scope |
|---|---|
| `VITE_SUPABASE_URL` | client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client |
| `VITE_SUPABASE_PROJECT_ID` | client |
| `LOVABLE_API_KEY` | server only — AI gateway |

Server-only values are read inside server-function handlers, never at module scope.

## Roadmap

**Horizon 1 — pilot**
Neural TTS with a consistent bank voice, voiceprint enrolment at onboarding, offline balance cache, Open Banking read/write via a real core-banking adapter.

**Horizon 2 — scale**
Trusted-contact co-signing for high-risk payments, cross-device continuity (start on phone, confirm on smart speaker), scam-signal telemetry feeding a shared bank-wide model, BSL video support for deafblind users on a braille display.

**Horizon 3 — platform**
EchoBank as an accessibility SDK any UK bank can embed: audio layout schema, earcon grammar, repeat-back confirmation, and Scam Shield packaged as drop-in components with certified WCAG conformance.

---

Built with [Lovable](https://lovable.dev). Continue developing in the [Lovable editor](https://lovable.dev/projects/d9055675-ab1d-4097-9d32-80b0ab4af1bc) — changes sync both ways with GitHub.
