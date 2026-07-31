import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOverview } = await import("./bank.queries.server");
    return loadOverview(context.supabase, context.userId);
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadTransactions } = await import("./bank.queries.server");
    return loadTransactions(context.supabase, context.userId);
  });

export const getTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { loadTransaction } = await import("./bank.queries.server");
    return loadTransaction(context.supabase, context.userId, data.id);
  });

export const explainTransactionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { buildExplanation } = await import("./bank.queries.server");
    return buildExplanation(context.supabase, context.userId, data.id);
  });

export const listPayees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadPayees } = await import("./bank.queries.server");
    return loadPayees(context.supabase, context.userId);
  });

export const listLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadLetters } = await import("./bank.queries.server");
    return loadLetters(context.supabase, context.userId);
  });

export const markLetterRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { markRead } = await import("./bank.queries.server");
    return markRead(context.supabase, context.userId, data.id);
  });

export const runScamCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        payeeName: z.string().min(1).max(80),
        amountPence: z.number().int().min(0).max(100_000_00),
        context: z.string().max(1200).optional(),
        useAi: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { performScamCheck } = await import("./bank.queries.server");
    return performScamCheck(context.supabase, context.userId, data);
  });

export const sendPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        payeeName: z.string().min(1).max(80),
        amountPence: z.number().int().min(1).max(100_000_00),
        reference: z.string().max(120).optional(),
        scamCheckId: z.string().uuid().optional(),
        confirmation: z.enum(["spoken", "held"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { performPayment } = await import("./bank.queries.server");
    return performPayment(context.supabase, context.userId, data);
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        display_name: z.string().min(1).max(60).optional(),
        speech_rate: z.number().min(0.5).max(2).optional(),
        verbosity: z.enum(["brief", "standard", "detailed"]).optional(),
        haptics_enabled: z.boolean().optional(),
        earcons_enabled: z.boolean().optional(),
        auto_speak: z.boolean().optional(),
        onboarded: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { saveSettings } = await import("./bank.queries.server");
    return saveSettings(context.supabase, context.userId, data);
  });

export const setAccountFrozen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ frozen: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { freezeAccount } = await import("./bank.queries.server");
    return freezeAccount(context.supabase, context.userId, data.frozen);
  });

export const getSpendingSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildSpendingSummary } = await import("./bank.queries.server");
    return buildSpendingSummary(context.supabase, context.userId);
  });

export const savePayeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(80),
        relationship: z.string().max(60).optional(),
        sortCode: z.string().max(12).optional(),
        accountNumber: z.string().max(12).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { savePayee } = await import("./bank.queries.server");
    return savePayee(context.supabase, context.userId, data);
  });
