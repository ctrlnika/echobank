/**
 * Every database read and write the app performs, as plain server-only
 * functions. The `.functions.ts` wrappers stay thin; all logic lives here.
 *
 * Two invariants hold throughout:
 *  1. Balances are computed and written server-side. A client never sends one.
 *  2. Every response carries the exact sentence to speak, generated from the
 *     same numbers the screen renders.
 */
import type { Db } from "./bank.server";
import { assessRisk, composeHomeSummary, provisionAccount } from "./bank.server";
import { enrichRisk, explainTransaction, summariseSpending } from "./ai.server";

function unwrap<T>(data: T | null, error: { message: string } | null, what: string): NonNullable<T> {
  if (error) throw new Error(`${what}: ${error.message}`);
  if (data === null || data === undefined) throw new Error(`${what}: not found`);
  return data as NonNullable<T>;
}



async function ensureReady(db: Db, userId: string) {
  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) {
    await provisionAccount(db, userId, "there", false);
    const created = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
    return created.data;
  }
  const { data: account } = await db.from("accounts").select("id").eq("user_id", userId).limit(1);
  if (!account || account.length === 0) {
    await provisionAccount(db, userId, profile.display_name, profile.is_demo);
  }
  return profile;
}

export async function loadOverview(db: Db, userId: string) {
  const profile = await ensureReady(db, userId);
  const accountResult = await db
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const account = unwrap(accountResult.data, accountResult.error, "Reading your account");

  const { data: transactions } = await db
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(6);
  const { count: unreadLetters } = await db
    .from("letters")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  const recent = transactions ?? [];
  const latest = recent[0] ?? null;

  return {
    profile: {
      displayName: profile?.display_name ?? "there",
      speechRate: Number(profile?.speech_rate ?? 1),
      verbosity: profile?.verbosity ?? "standard",
      hapticsEnabled: profile?.haptics_enabled ?? true,
      earconsEnabled: profile?.earcons_enabled ?? true,
      autoSpeak: profile?.auto_speak ?? false,
      onboarded: profile?.onboarded ?? false,
    },
    account: {
      id: account.id,
      name: account.name,
      sortCode: account.sort_code,
      last4: account.last4,
      accountNumber: account.account_number,
      balancePence: Number(account.balance_pence),
      frozen: account.frozen,
    },
    recent: recent.map((t) => ({
      id: t.id,
      counterparty: t.counterparty,
      category: t.category,
      amountPence: Number(t.amount_pence),
      occurredAt: t.occurred_at,
      note: t.note,
    })),
    unreadLetters: unreadLetters ?? 0,
    spokenSummary: composeHomeSummary({
      displayName: profile?.display_name ?? "there",
      balancePence: Number(account.balance_pence),
      lastCounterparty: latest?.counterparty ?? null,
      lastAmountPence: latest ? Number(latest.amount_pence) : null,
      unreadLetters: unreadLetters ?? 0,
    }),
  };
}

export async function loadTransactions(db: Db, userId: string) {
  await ensureReady(db, userId);
  const { data, error } = await db
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`Reading your activity: ${error.message}`);
  return (data ?? []).map((t) => ({
    id: t.id,
    counterparty: t.counterparty,
    category: t.category,
    amountPence: Number(t.amount_pence),
    occurredAt: t.occurred_at,
    note: t.note,
    explanation: t.explanation,
  }));
}

export async function loadTransaction(db: Db, userId: string, id: string) {
  const result = await db.from("transactions").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  const row = unwrap(result.data, result.error, "Reading that payment");

  return {
    id: row.id,
    counterparty: row.counterparty,
    category: row.category,
    amountPence: Number(row.amount_pence),
    occurredAt: row.occurred_at,
    note: row.note,
    explanation: row.explanation,
  };
}

export async function buildExplanation(db: Db, userId: string, id: string) {
  const result = await db.from("transactions").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  const row = unwrap(result.data, result.error, "Reading that payment");

  if (row.explanation) return { explanation: row.explanation, fromCache: true, aiUnavailable: false };

  const { data: history } = await db
    .from("transactions")
    .select("counterparty, amount_pence, occurred_at")
    .eq("user_id", userId)
    .eq("counterparty", row.counterparty)
    .neq("id", id)
    .order("occurred_at", { ascending: false })
    .limit(4);

  const explanation = await explainTransaction({
    counterparty: row.counterparty,
    category: row.category,
    amountPence: Number(row.amount_pence),
    occurredAt: row.occurred_at,
    note: row.note,
    history: (history ?? []).map((h) => ({
      counterparty: h.counterparty,
      amountPence: Number(h.amount_pence),
      occurredAt: h.occurred_at,
    })),
  });

  if (!explanation) {
    // Deterministic fallback: still a complete, honest sentence.
    const direction = Number(row.amount_pence) < 0 ? "went out to" : "came in from";
    const seen = history?.length ?? 0;
    const fallback =
      `£${(Math.abs(Number(row.amount_pence)) / 100).toFixed(2)} ${direction} ${row.counterparty} on ` +
      `${new Date(row.occurred_at).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.` +
      (seen > 0 ? ` You have paid ${row.counterparty} ${seen} other time${seen === 1 ? "" : "s"} recently.` : "");
    return { explanation: fallback, fromCache: false, aiUnavailable: true };
  }

  await db.from("transactions").update({ explanation }).eq("id", id).eq("user_id", userId);
  return { explanation, fromCache: false, aiUnavailable: false };
}

export async function loadPayees(db: Db, userId: string) {
  await ensureReady(db, userId);
  const { data, error } = await db
    .from("payees")
    .select("*")
    .eq("user_id", userId)
    .order("times_paid", { ascending: false });
  if (error) throw new Error(`Reading your people: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    relationship: p.relationship,
    last4: p.last4,
    accountNumber: p.account_number,
    sortCode: p.sort_code,
    trusted: p.trusted,
    timesPaid: p.times_paid,
    lastPaidAt: p.last_paid_at,
  }));
}

export async function loadLetters(db: Db, userId: string) {
  await ensureReady(db, userId);
  const { data, error } = await db
    .from("letters")
    .select("*")
    .eq("user_id", userId)
    .order("received_at", { ascending: false });
  if (error) throw new Error(`Reading your post: ${error.message}`);
  return (data ?? []).map((l) => ({
    id: l.id,
    sender: l.sender,
    subject: l.subject,
    body: l.body,
    kind: l.kind,
    receivedAt: l.received_at,
    readAt: l.read_at,
  }));
}

export async function markRead(db: Db, userId: string, id: string) {
  const { error } = await db
    .from("letters")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Marking that letter as read: ${error.message}`);
  return { ok: true };
}

export async function loadContacts(db: Db, userId: string) {
  await ensureReady(db, userId);
  const { data } = await db.from("trusted_contacts").select("*").eq("user_id", userId).order("created_at");
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    relationship: c.relationship,
    phone: c.phone,
    canVerifyPayments: c.can_verify_payments,
  }));
}

export async function performScamCheck(
  db: Db,
  userId: string,
  input: { payeeName: string; amountPence: number; context?: string | undefined; useAi?: boolean | undefined },
) {
  await ensureReady(db, userId);
  const { data: payees } = await db.from("payees").select("name, trusted, times_paid").eq("user_id", userId);
  const { data: recent } = await db
    .from("transactions")
    .select("amount_pence")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(30);

  let assessment = assessRisk({
    payeeName: input.payeeName,
    amountPence: input.amountPence,
    context: input.context ?? null,
    knownPayees: (payees ?? []).map((p) => ({ name: p.name, trusted: p.trusted, times_paid: p.times_paid })),
    recentAmountsPence: (recent ?? []).map((r) => Number(r.amount_pence)),
  });

  let aiUnavailable = false;
  if (input.useAi !== false && input.context?.trim()) {
    const before = assessment.signals.length;
    assessment = await enrichRisk(assessment, {
      payeeName: input.payeeName,
      amountPence: input.amountPence,
      context: input.context,
    });
    aiUnavailable = assessment.signals.length === before;
  }

  const { data: saved } = await db
    .from("scam_checks")
    .insert({
      user_id: userId,
      payee_name: input.payeeName,
      amount_pence: input.amountPence,
      context: input.context ?? null,
      risk_score: assessment.score,
      risk_level: assessment.level,
      signals: assessment.signals,
      summary: assessment.summary,
      decision: "pending",
    })
    .select("id")
    .single();

  return { id: saved?.id ?? null, ...assessment, aiUnavailable };
}

export async function savePayee(
  db: Db,
  userId: string,
  input: {
    name: string;
    relationship?: string | undefined;
    sortCode?: string | undefined;
    accountNumber?: string | undefined;
  },
) {
  await ensureReady(db, userId);
  const existing = await db
    .from("payees")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", input.name)
    .maybeSingle();
  if (existing.data) {
    return { ok: false as const, reason: `${input.name} is already saved.` };
  }

  const { data, error } = await db
    .from("payees")
    .insert({
      user_id: userId,
      name: input.name,
      ...(input.relationship ? { relationship: input.relationship } : {}),
      ...(input.sortCode ? { sort_code: normaliseSortCode(input.sortCode) } : {}),
      ...(input.accountNumber
        ? { last4: input.accountNumber.slice(-4), account_number: input.accountNumber }
        : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(`Saving that person: ${error.message}`);
  return {
    ok: true as const,
    id: data.id,
    spoken: `${input.name} is now saved. You can pay them by name from now on.`,
  };
}

function normaliseSortCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) return value;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

export async function performPayment(
  db: Db,
  userId: string,
  input: {
    payeeName: string;
    amountPence: number;
    reference?: string | undefined;
    scamCheckId?: string | undefined;
    confirmation: "spoken" | "held";
  },
) {
  await ensureReady(db, userId);
  const accountResult = await db
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const account = unwrap(accountResult.data, accountResult.error, "Reading your account");


  if (account.frozen) {
    return { ok: false as const, reason: "Your card and payments are frozen. Unfreeze them first in Help." };
  }
  const balance = Number(account.balance_pence);
  if (input.amountPence > balance) {
    return {
      ok: false as const,
      reason: `You only have £${(balance / 100).toFixed(2)} available, so this payment can't be sent.`,
    };
  }

  const newBalance = balance - input.amountPence;
  const { error: balanceError } = await db
    .from("accounts")
    .update({ balance_pence: newBalance })
    .eq("id", account.id)
    .eq("user_id", userId);
  if (balanceError) throw new Error(`Moving the money: ${balanceError.message}`);

  const { data: created, error: txError } = await db
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: account.id,
      counterparty: input.payeeName,
      category: "transfer",
      amount_pence: -input.amountPence,
      note: input.reference ?? null,
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (txError) throw new Error(`Recording the payment: ${txError.message}`);

  const { data: payee } = await db
    .from("payees")
    .select("id, times_paid")
    .eq("user_id", userId)
    .ilike("name", input.payeeName)
    .maybeSingle();

  if (payee) {
    await db
      .from("payees")
      .update({ times_paid: payee.times_paid + 1, last_paid_at: new Date().toISOString() })
      .eq("id", payee.id);
  } else {
    await db.from("payees").insert({
      user_id: userId,
      name: input.payeeName,
      times_paid: 1,
      trusted: false,
      last_paid_at: new Date().toISOString(),
    });
  }

  if (input.scamCheckId) {
    await db
      .from("scam_checks")
      .update({ decision: "sent" })
      .eq("id", input.scamCheckId)
      .eq("user_id", userId);
  }

  return {
    ok: true as const,
    transactionId: created.id,
    newBalancePence: newBalance,
    spoken:
      `Payment sent. £${(input.amountPence / 100).toFixed(2)} to ${input.payeeName}. ` +
      `Your balance is now £${(newBalance / 100).toFixed(2)}.`,
  };
}

export async function saveSettings(
  db: Db,
  userId: string,
  patch: Record<string, string | number | boolean | undefined>,
) {
  await ensureReady(db, userId);
  const { error } = await db
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(`Saving your preferences: ${error.message}`);
  return { ok: true };
}

export async function freezeAccount(db: Db, userId: string, frozen: boolean) {
  await ensureReady(db, userId);
  const { error } = await db.from("accounts").update({ frozen }).eq("user_id", userId);
  if (error) throw new Error(`Changing your card: ${error.message}`);
  return {
    ok: true,
    frozen,
    spoken: frozen
      ? "Your card and payments are now frozen. Nothing can leave your account until you unfreeze it."
      : "Your card and payments are active again.",
  };
}

export async function buildSpendingSummary(db: Db, userId: string) {
  const profile = await ensureReady(db, userId);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from("transactions")
    .select("category, amount_pence")
    .eq("user_id", userId)
    .gte("occurred_at", since);

  const totals = new Map<string, number>();
  let incomePence = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount_pence);
    if (amount > 0) {
      incomePence += amount;
      continue;
    }
    totals.set(row.category, (totals.get(row.category) ?? 0) + Math.abs(amount));
  }

  const breakdown = [...totals.entries()]
    .map(([category, pence]) => ({ category, pence }))
    .sort((a, b) => b.pence - a.pence);
  const spentPence = breakdown.reduce((total, b) => total + b.pence, 0);

  const spoken = await summariseSpending({
    displayName: profile?.display_name ?? "there",
    totals: breakdown,
    incomePence,
  });

  const top = breakdown[0];
  const fallback =
    `Over the last thirty days £${(spentPence / 100).toFixed(2)} went out and £${(incomePence / 100).toFixed(2)} came in.` +
    (top ? ` Your biggest area was ${top.category}, at £${(top.pence / 100).toFixed(2)}.` : "");

  return {
    breakdown,
    spentPence,
    incomePence,
    spoken: spoken ?? fallback,
    aiUnavailable: spoken === null,
  };
}
