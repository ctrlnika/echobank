/**
 * Server-only banking helpers: account provisioning, the deterministic Scam
 * Shield risk engine, and the spoken-summary composer.
 *
 * Nothing in here is importable from the browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Gemma's world, drawn straight from the customer diary in the brief:
 * a working mum, a guide dog, a school run, a cleaner, energy bills,
 * and family who read her post.
 */
export async function provisionAccount(db: Db, userId: string, displayName: string, isDemo: boolean) {
  const { data: existing } = await db.from("accounts").select("id").eq("user_id", userId).limit(1);
  if (existing && existing.length > 0) return;

  await db.from("profiles").upsert({ id: userId, display_name: displayName, is_demo: isDemo });

  const { data: account, error: accountError } = await db
    .from("accounts")
    .insert({
      user_id: userId,
      name: "Everyday Current",
      kind: "current",
      sort_code: "20-45-90",
      last4: "4417",
      account_number: "31204417",
      balance_pence: 128450,
    })
    .select("id")
    .single();
  if (accountError || !account) throw new Error(accountError?.message ?? "Could not open the account");

  const payees = [
    { name: "Sam", relationship: "Brother", trusted: true, times_paid: 14, last4: "8821", account_number: "60418821", last_paid_at: ago(3 * DAY) },
    { name: "Mum", relationship: "Mother", trusted: true, times_paid: 31, last4: "1190", account_number: "72301190", last_paid_at: ago(9 * DAY) },
    { name: "Jess", relationship: "Cleaner", trusted: true, times_paid: 22, last4: "4402", account_number: "19884402", last_paid_at: ago(6 * DAY) },
    { name: "Priya", relationship: "Piano teacher", trusted: true, times_paid: 8, last4: "7734", account_number: "40567734", last_paid_at: ago(11 * DAY) },
    { name: "Landlord", relationship: "Housing", trusted: true, times_paid: 19, last4: "0056", account_number: "83120056", last_paid_at: ago(21 * DAY) },
  ];
  await db.from("payees").insert(payees.map((p) => ({ ...p, user_id: userId })));

  const transactions = [
    { counterparty: "Salary — Northfield Trust", category: "income", amount_pence: 218400, occurred_at: ago(1 * DAY), note: "Monthly pay" },
    { counterparty: "Tesco Express", category: "groceries", amount_pence: -3210, occurred_at: ago(4 * HOUR), note: "Contactless" },
    { counterparty: "Transport for London", category: "transport", amount_pence: -490, occurred_at: ago(6 * HOUR), note: "Daily cap" },
    { counterparty: "British Gas", category: "bills", amount_pence: -8420, occurred_at: ago(2 * DAY), note: "Direct debit" },
    { counterparty: "Jess", category: "transfer", amount_pence: -6000, occurred_at: ago(6 * DAY), note: "Cleaning, 4 hours" },
    { counterparty: "Guide Dogs UK", category: "other", amount_pence: -1000, occurred_at: ago(7 * DAY), note: "Monthly donation" },
    { counterparty: "Sam", category: "transfer", amount_pence: -2000, occurred_at: ago(3 * DAY), note: "Cinema tickets" },
    { counterparty: "Thames Water", category: "bills", amount_pence: -3150, occurred_at: ago(8 * DAY), note: "Direct debit" },
    { counterparty: "Sainsbury's", category: "groceries", amount_pence: -5477, occurred_at: ago(9 * DAY), note: "Weekly shop" },
    { counterparty: "Priya", category: "transfer", amount_pence: -3000, occurred_at: ago(11 * DAY), note: "Piano lesson" },
    { counterparty: "Northern Rail", category: "transport", amount_pence: -1840, occurred_at: ago(13 * DAY), note: "Return ticket" },
    { counterparty: "British Gas", category: "bills", amount_pence: -8420, occurred_at: ago(32 * DAY), note: "Direct debit" },
  ];
  await db
    .from("transactions")
    .insert(transactions.map((t) => ({ ...t, user_id: userId, account_id: account.id })));

  await db.from("letters").insert([
    {
      user_id: userId,
      sender: "Northfield Bank",
      subject: "Your annual interest summary",
      kind: "statement",
      received_at: ago(2 * DAY),
      body: "Between April last year and April this year, you were paid twelve pounds and forty pence in interest on your savings. No action is needed. This figure has already been reported to HM Revenue and Customs on your behalf. If you would like this summary in braille or large print, you can change your format preference at any time.",
    },
    {
      user_id: userId,
      sender: "British Gas",
      subject: "Your direct debit is going up",
      kind: "letter",
      received_at: ago(5 * DAY),
      body: "From the first of next month your monthly direct debit will rise from eighty-four pounds and twenty pence to ninety-one pounds and sixty pence. This is because your usage over the winter was higher than the estimate we held. You do not need to do anything. If you would like to spread the difference over a longer period, you can ask us to review it.",
    },
    {
      user_id: userId,
      sender: "Oakfield Primary School",
      subject: "Trip payment reminder",
      kind: "letter",
      received_at: ago(8 * DAY),
      body: "This is a reminder that the payment of twelve pounds and fifty pence for the museum trip is due by the end of this month. Payments can be made through the school portal or by bank transfer to the school account.",
    },
  ]);

  await db.from("trusted_contacts").insert([
    { user_id: userId, name: "Sam", relationship: "Brother", phone: "07700 900118", can_verify_payments: true },
    { user_id: userId, name: "Mum", relationship: "Mother", phone: "07700 900204", can_verify_payments: true },
    { user_id: userId, name: "Northfield Bank — accessible line", relationship: "Bank", phone: "0800 400 100", can_verify_payments: false },
  ]);
}

/* ------------------------------------------------------------------ */
/* Scam Shield                                                         */
/* ------------------------------------------------------------------ */

export type RiskSignal = {
  code: string;
  label: string;
  detail: string;
  weight: number;
};

export type RiskAssessment = {
  score: number;
  level: "low" | "medium" | "high";
  signals: RiskSignal[];
  summary: string;
  requiresCoolingOff: boolean;
};

const URGENCY_PATTERNS: Array<[RegExp, string]> = [
  [/\b(urgent|immediately|right now|straight away|last chance|final notice)\b/i, "urgency language"],
  [/\b(don'?t tell|keep this between|secret|confidential)\b/i, "secrecy language"],
  [/\b(police|fraud team|safe account|security team|hmrc|refund)\b/i, "impersonation of an authority"],
  [/\b(gift card|crypto|bitcoin|voucher)\b/i, "an irreversible payment method"],
  [/\b(prize|won|lottery|inheritance|compensation)\b/i, "a windfall promise"],
];

type KnownPayee = { name: string; trusted: boolean; times_paid: number };

/**
 * The deterministic half of Scam Shield. It runs in single-digit milliseconds,
 * always returns reasons rather than a verdict, and works with no network. The
 * language model can only *add* signals on top of this — never remove them.
 */
export function assessRisk(input: {
  payeeName: string;
  amountPence: number;
  context?: string | null;
  knownPayees: KnownPayee[];
  recentAmountsPence: number[];
  now?: Date;
}): RiskAssessment {
  const now = input.now ?? new Date();
  const signals: RiskSignal[] = [];
  const normalised = input.payeeName.trim().toLowerCase();
  const match = input.knownPayees.find((p) => p.name.trim().toLowerCase() === normalised);

  if (!match) {
    signals.push({
      code: "new_payee",
      label: "Someone you have never paid",
      detail: `${input.payeeName} is not in your list of people you've paid before.`,
      weight: 35,
    });
  } else if (!match.trusted) {
    signals.push({
      code: "untrusted_payee",
      label: "Not yet a trusted payee",
      detail: `You have paid ${match.name} ${match.times_paid} time${match.times_paid === 1 ? "" : "s"}, but they aren't marked as trusted.`,
      weight: 15,
    });
  }

  const outgoing = input.recentAmountsPence.filter((a) => a < 0).map((a) => Math.abs(a));
  const typical = outgoing.length
    ? outgoing.slice().sort((a, b) => a - b)[Math.floor(outgoing.length / 2)] ?? 0
    : 0;
  if (typical > 0 && input.amountPence > typical * 4) {
    signals.push({
      code: "unusual_amount",
      label: "Much larger than usual",
      detail: `This is more than four times your typical payment of about £${(typical / 100).toFixed(0)}.`,
      weight: 25,
    });
  }
  if (input.amountPence >= 50000) {
    signals.push({
      code: "large_amount",
      label: "A large amount",
      detail: "Payments of £500 or more get an extra check as standard.",
      weight: 15,
    });
  }

  const hour = now.getHours();
  if (hour >= 23 || hour < 6) {
    signals.push({
      code: "out_of_hours",
      label: "Outside your normal hours",
      detail: "You almost never move money between eleven at night and six in the morning.",
      weight: 12,
    });
  }

  const context = input.context ?? "";
  for (const [pattern, description] of URGENCY_PATTERNS) {
    if (pattern.test(context)) {
      signals.push({
        code: "pressure_language",
        label: "Pressure in the request",
        detail: `The request you described contains ${description}. Genuine organisations never rush you.`,
        weight: 30,
      });
      break;
    }
  }

  const score = Math.min(100, signals.reduce((total, s) => total + s.weight, 0));
  const level: RiskAssessment["level"] = score >= 55 ? "high" : score >= 25 ? "medium" : "low";

  const summary =
    level === "high"
      ? `I would not send this yet. There ${signals.length === 1 ? "is one reason" : `are ${signals.length} reasons`} to stop and check.`
      : level === "medium"
        ? "This looks mostly normal, but there is something worth hearing first."
        : "Nothing about this payment looks unusual.";

  return { score, level, signals, summary, requiresCoolingOff: level === "high" && !match };
}

/** One sentence a person can act on, spoken the moment a screen opens. */
export function composeHomeSummary(input: {
  displayName: string;
  balancePence: number;
  lastCounterparty: string | null;
  lastAmountPence: number | null;
  unreadLetters: number;
}): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const balance = `£${(input.balancePence / 100).toFixed(2)}`;
  const parts = [`${greeting}, ${input.displayName}. You have ${balance} available.`];
  if (input.lastCounterparty && input.lastAmountPence !== null) {
    const direction = input.lastAmountPence < 0 ? "out to" : "in from";
    parts.push(
      `Your most recent activity was £${(Math.abs(input.lastAmountPence) / 100).toFixed(2)} ${direction} ${input.lastCounterparty}.`,
    );
  }
  if (input.unreadLetters > 0) {
    parts.push(
      `You have ${input.unreadLetters} unread letter${input.unreadLetters === 1 ? "" : "s"} waiting to be read to you.`,
    );
  }
  return parts.join(" ");
}
