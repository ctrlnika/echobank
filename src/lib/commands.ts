/**
 * Plain-English command parser.
 *
 * This is the deterministic floor under the AI assistant: it runs offline, in
 * under a millisecond, and covers the handful of things people do every day.
 * If it doesn't recognise a phrase, the assistant takes over.
 */
import { poundsToPence } from "./money";

export type Command =
  | { kind: "balance" }
  | { kind: "activity" }
  | { kind: "letters" }
  | { kind: "people" }
  | { kind: "settings" }
  | { kind: "help" }
  | { kind: "freeze"; frozen: boolean }
  | { kind: "spending" }
  | { kind: "pay"; payee: string; amountPence: number }
  | { kind: "unknown"; text: string };

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function parseAmount(text: string): number | null {
  const digits = text.match(/£?\s*(\d+(?:\.\d{1,2})?)/);
  if (digits?.[1]) return poundsToPence(digits[1]);
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return value * 100;
  }
  return null;
}

/**
 * Speech recognition regularly hears "play"/"pei"/"bay" for "pay", and
 * "sent"/"sand" for "send". Rewrite those to the intended verb before parsing,
 * but only when they lead the phrase or are followed by a name or amount.
 */
const PAY_HOMOPHONES =
  /\b(play|plays|played|playing|pray|prey|pey|pei|pai|pae|bay|bae|spay|pays|paid|paypal)\b(?=\s+(?:£|\d|[a-z]))/g;
const SEND_HOMOPHONES = /\b(sent|sand|sen|send it|cent)\b(?=\s+(?:£|\d|[a-z]))/g;

function normaliseVerbs(text: string): string {
  return text.replace(PAY_HOMOPHONES, "pay").replace(SEND_HOMOPHONES, "send");
}

export function parseCommand(input: string): Command {
  const text = input.trim().toLowerCase();
  if (!text) return { kind: "unknown", text: input };


  if (/\b(balance|how much|what have i got|money left|funds)\b/.test(text)) return { kind: "balance" };
  if (/\b(activity|transactions|recent|what did i spend|statement|history)\b/.test(text)) {
    return { kind: "activity" };
  }
  if (/\b(post|letters?|mail|statements?)\b/.test(text)) return { kind: "letters" };
  if (/\b(people|payees?|contacts?)\b/.test(text)) return { kind: "people" };
  if (/\b(settings?|preferences|voice speed|slower|faster)\b/.test(text)) return { kind: "settings" };
  if (/\b(spending|where did my money go|breakdown|summary of my month)\b/.test(text)) {
    return { kind: "spending" };
  }
  if (/\b(unfreeze|unlock)\b.*\b(card|account)\b|\b(card|account)\b.*\bunfreeze\b/.test(text)) {
    return { kind: "freeze", frozen: false };
  }
  if (/\b(freeze|lock|block)\b.*\b(card|account|payments?)\b/.test(text)) {
    return { kind: "freeze", frozen: true };
  }
  if (/\b(help|what can (i|you) (say|do)|commands?)\b/.test(text)) return { kind: "help" };

  const normalised = normaliseVerbs(text);
  const pay = normalised.match(
    /\b(?:pay|send|transfer|give)\s+(?:£?\s*[\d.]+\s*(?:pounds?|quid)?\s*(?:to)?\s*)?([a-z][a-z '’-]{0,40}?)(?:\s+(?:£?\s*[\d.]+.*))?$/,
  );

  if (pay) {
    const amountPence = parseAmount(text);
    const numberWords = Object.keys(NUMBER_WORDS).join("|");
    const payee = (pay[1] ?? "")
      .replace(/\b(pounds?|quid|please|now|to|for)\b/g, " ")
      .replace(new RegExp(`\\s*\\b(?:${numberWords})\\b.*$`), " ")
      .replace(/\s+/g, " ")
      .trim();

    if (payee && amountPence && amountPence > 0) {
      return {
        kind: "pay",
        payee: payee.replace(/\b\w/g, (c) => c.toUpperCase()),
        amountPence,
      };
    }
  }

  return { kind: "unknown", text: input };
}

export const COMMAND_EXAMPLES = [
  "What's my balance?",
  "Pay Sam twenty pounds",
  "What did I spend this month?",
  "Read my post",
  "Freeze my card",
];
