import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const scanCardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        image: z
          .string()
          .min(100)
          .max(8_000_000)
          .refine((value) => value.startsWith("data:image/"), "Expected an image"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { readCardImage } = await import("./card.server");
    return readCardImage(data.image);
  });

export const listCardsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCards } = await import("./card.server");
    return loadCards(context.supabase, context.userId);
  });

export const saveCardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().min(1).max(60),
        brand: z.string().max(40).default("card"),
        last4: z.string().regex(/^\d{4}$/),
        bin6: z.string().regex(/^\d{6}$/).optional(),
        expiry: z.string().max(12).optional(),
        holderName: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { saveCard } = await import("./card.server");
    return saveCard(context.supabase, context.userId, data);
  });

export const deleteCardFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { deleteCard } = await import("./card.server");
    return deleteCard(context.supabase, context.userId, data.id);
  });
