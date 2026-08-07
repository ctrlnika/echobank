/**
 * Reading a bank card from a photo.
 *
 * A photo of the card is sent to the vision model, which returns the printed
 * digits. The image is never stored, and only the *recognition* fields
 * (brand, first six, last four, expiry, name) are ever written to the
 * database — the full card number stays in the browser for the length of the
 * scan so it can be read aloud, and is then dropped.
 */
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { ECHOBANK_MODEL } from "./ai.server";
import { brandFromNumber, luhnValid } from "./card-speech";
import type { Db } from "./bank.server";

export type CardScan = {
  ok: boolean;
  number: string | null;
  last4: string | null;
  bin6: string | null;
  expiry: string | null;
  holderName: string | null;
  brand: string;
  checksumOk: boolean;
  spokenHint: string;
};

const FAILED: CardScan = {
  ok: false,
  number: null,
  last4: null,
  bin6: null,
  expiry: null,
  holderName: null,
  brand: "card",
  checksumOk: false,
  spokenHint:
    "I couldn't read a card in that photo. Hold the card flat about twenty centimetres from the camera, in good light, and try again.",
};

export async function readCardImage(imageDataUrl: string): Promise<CardScan> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) {
    return { ...FAILED, spokenHint: "Card reading isn't available right now. You can type the card details instead." };
  }
  const gateway = createLovableAiGatewayProvider(key);

  let raw = "";
  try {
    const { text } = await generateText({
      model: gateway(ECHOBANK_MODEL),
      system:
        "You read the printed details from a photograph of a payment card. " +
        "Reply with plain lines only, no markdown, in exactly this form:\n" +
        "NUMBER: <digits only, or NONE>\n" +
        "EXPIRY: <MM/YY, or NONE>\n" +
        "NAME: <name printed on the card, or NONE>\n" +
        "Never invent digits. If any field is unreadable or the image is not a payment card, write NONE for it. " +
        "Never output the CVV or security code even if it is visible.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Read this payment card." },
            { type: "image", image: imageDataUrl },
          ],
        },
      ],
    });
    raw = text;
  } catch {
    return {
      ...FAILED,
      spokenHint: "The card reader is busy right now. Please try again in a moment, or type the details instead.",
    };
  }

  const field = (name: string) => {
    const match = raw.match(new RegExp(`${name}\\s*:\\s*(.+)`, "i"));
    const value = match?.[1]?.trim() ?? "";
    return !value || /^none$/i.test(value) ? null : value;
  };

  const digits = (field("NUMBER") ?? "").replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return FAILED;

  const expiry = field("EXPIRY");
  const holderName = field("NAME");
  const checksumOk = luhnValid(digits);

  return {
    ok: true,
    number: digits,
    last4: digits.slice(-4),
    bin6: digits.slice(0, 6),
    expiry,
    holderName,
    brand: brandFromNumber(digits),
    checksumOk,
    spokenHint: checksumOk
      ? "I've read your card."
      : "I've read your card, but the digits don't add up. Please check them before you rely on them.",
  };
}

export async function loadCards(db: Db, userId: string) {
  const { data, error } = await db
    .from("cards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Reading your cards: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    brand: row.brand as string,
    last4: row.last4 as string,
    bin6: (row.bin6 as string | null) ?? null,
    expiry: (row.expiry as string | null) ?? null,
    holderName: (row.holder_name as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function saveCard(
  db: Db,
  userId: string,
  input: { label: string; brand: string; last4: string; bin6?: string; expiry?: string; holderName?: string },
) {
  const { error } = await db.from("cards").insert({
    user_id: userId,
    label: input.label,
    brand: input.brand,
    last4: input.last4,
    bin6: input.bin6 ?? null,
    expiry: input.expiry ?? null,
    holder_name: input.holderName ?? null,
  });
  if (error) throw new Error(`Saving your card: ${error.message}`);
  return { saved: true, spoken: `Saved. ${input.label}, ending ${input.last4.split("").join(", ")}.` };
}

export async function deleteCard(db: Db, userId: string, id: string) {
  const { error } = await db.from("cards").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(`Removing that card: ${error.message}`);
  return { removed: true, spoken: "Card removed." };
}
