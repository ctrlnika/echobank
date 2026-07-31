/**
 * Server-only AI helpers built on Lovable AI through the AI SDK.
 *
 * Every function here is *additive*: if the gateway is slow, rate-limited or
 * out of credit, the caller still has a complete, deterministic answer. The
 * model never gates a payment and never removes a risk signal.
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { RiskAssessment, RiskSignal } from "./bank.server";

export const ECHOBANK_MODEL = "google/gemini-3.6-flash";

function gatewayOrNull() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  return createLovableAiGatewayProvider(key);
}

export type AiFailure = { kind: "unavailable" | "rate_limited" | "no_credit" | "error"; message: string };

export function describeAiError(error: unknown): AiFailure {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate.?limit/i.test(message)) {
    return { kind: "rate_limited", message: "The assistant is busy right now. Everything else still works." };
  }
  if (/402|credit/i.test(message)) {
    return { kind: "no_credit", message: "The assistant is out of credit. Everything else still works." };
  }
  return { kind: "error", message: "The assistant couldn't answer just now. Everything else still works." };
}

/**
 * Turn a bank-statement line into a sentence a person would actually say.
 * Spoken aloud, so: no markdown, no lists, no jargon, two sentences maximum.
 */
export async function explainTransaction(input: {
  counterparty: string;
  category: string;
  amountPence: number;
  occurredAt: string;
  note: string | null;
  history: Array<{ counterparty: string; amountPence: number; occurredAt: string }>;
}): Promise<string | null> {
  const gateway = gatewayOrNull();
  if (!gateway) return null;

  const direction = input.amountPence < 0 ? "money out" : "money in";
  const history = input.history
    .map((h) => `${h.counterparty}: £${(Math.abs(h.amountPence) / 100).toFixed(2)} on ${h.occurredAt.slice(0, 10)}`)
    .join("; ");

  try {
    const { text } = await generateText({
      model: gateway(ECHOBANK_MODEL),
      system:
        "You explain UK bank transactions to a customer who is completely blind and is listening, not reading. " +
        "Write at most two short sentences of plain spoken English. No markdown, no bullet points, no headings, no emoji. " +
        "Say amounts as words a screen reader handles well, e.g. 'thirty-two pounds and ten pence'. " +
        "If the same payee appears in the recent history at a similar amount, say that it looks like a regular payment. " +
        "Never speculate about fraud; a separate system handles that.",
      prompt:
        `Transaction: ${input.counterparty}, ${direction}, £${(Math.abs(input.amountPence) / 100).toFixed(2)}, ` +
        `category ${input.category}, on ${input.occurredAt}. Note: ${input.note ?? "none"}.\n` +
        `Recent payments to similar payees: ${history || "none"}.`,
    });
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Ask the model to read the customer's own description of *how they were
 * asked* for money, and add signals the rule engine cannot see — tone,
 * story shape, impersonation. It can only append to the signal list.
 */
export async function enrichRisk(
  base: RiskAssessment,
  input: { payeeName: string; amountPence: number; context: string },
): Promise<RiskAssessment> {
  const gateway = gatewayOrNull();
  if (!gateway || !input.context.trim()) return base;

  try {
    const { text } = await generateText({
      model: gateway(ECHOBANK_MODEL),
      system:
        "You are a UK bank's authorised-push-payment fraud analyst. The customer will describe how they were asked " +
        "for money. Identify concrete manipulation tactics present in the description. " +
        "Reply with one line per tactic in the exact form: LABEL | one spoken sentence explaining it | weight " +
        "where weight is an integer from 5 to 40. Reply with the single word NONE if the description shows no tactics. " +
        "Never add a tactic that is not clearly present in the text.",
      prompt: `Payee: ${input.payeeName}. Amount: £${(input.amountPence / 100).toFixed(2)}.\nWhat happened: ${input.context}`,
    });

    if (/^\s*none\s*$/i.test(text)) return base;

    const extra: RiskSignal[] = [];
    for (const line of text.split("\n")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 3) continue;
      const [label, detail, weightRaw] = parts;
      if (!label || !detail) continue;
      const weight = Math.min(40, Math.max(5, Number.parseInt(weightRaw ?? "10", 10) || 10));
      extra.push({ code: "ai_tactic", label: label.slice(0, 80), detail: detail.slice(0, 220), weight });
    }
    if (extra.length === 0) return base;

    const signals = [...base.signals, ...extra.slice(0, 3)];
    const score = Math.min(100, signals.reduce((total, s) => total + s.weight, 0));
    const level: RiskAssessment["level"] = score >= 55 ? "high" : score >= 25 ? "medium" : "low";
    return {
      ...base,
      signals,
      score,
      level,
      summary:
        level === "high"
          ? `I would not send this yet. There are ${signals.length} reasons to stop and check.`
          : level === "medium"
            ? "This looks mostly normal, but there is something worth hearing first."
            : base.summary,
      requiresCoolingOff: base.requiresCoolingOff || level === "high",
    };
  } catch {
    return base;
  }
}

/** A short spoken digest of the month's spending, grouped the way people think. */
export async function summariseSpending(input: {
  displayName: string;
  totals: Array<{ category: string; pence: number }>;
  incomePence: number;
}): Promise<string | null> {
  const gateway = gatewayOrNull();
  if (!gateway) return null;
  const totals = input.totals.map((t) => `${t.category}: £${(t.pence / 100).toFixed(2)}`).join(", ");
  try {
    const { text } = await generateText({
      model: gateway(ECHOBANK_MODEL),
      system:
        "You summarise a month of UK bank spending for a customer who is completely blind and is listening. " +
        "Three short spoken sentences maximum. No markdown, no lists, no headings. " +
        "Lead with the single most useful fact. Be warm but never patronising. Never give financial advice.",
      prompt: `Customer: ${input.displayName}. Money in: £${(input.incomePence / 100).toFixed(2)}. Spending by category: ${totals}.`,
    });
    return text.trim() || null;
  } catch {
    return null;
  }
}
