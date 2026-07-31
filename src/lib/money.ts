/**
 * Money is stored and moved as integer pence, everywhere.
 *
 * `formatMoney` and `speakMoney` are the ONLY two renderers, and both take the
 * same pence value — so what a sighted user reads and what a screen reader or
 * our own speech engine says can never drift apart. That single-source rule is
 * the reason the audio layer is trustworthy at a bank.
 */

export function formatMoney(pence: number, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(pence);
  const body = `£${(abs / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  if (opts.signed) return `${pence < 0 ? "−" : "+"}${body}`;
  return pence < 0 ? `−${body}` : body;
}

/** Plain amount with no direction, e.g. "twenty pounds and fifty pence". */
export function speakAmount(pence: number): string {
  const abs = Math.abs(pence);
  const pounds = Math.floor(abs / 100);
  const pennies = abs % 100;
  const poundPart = `${pounds} pound${pounds === 1 ? "" : "s"}`;
  if (pennies === 0) return poundPart;
  return `${poundPart} and ${pennies} pence`;
}

/** Amount with direction, e.g. "thirty-two pounds and ten pence, out". */
export function speakMoney(pence: number): string {
  return `${speakAmount(pence)}, ${pence < 0 ? "out" : "in"}`;
}

export function poundsToPence(value: string | number): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** "Today at 9:12am", "Yesterday", "Mon 14 July" — short and speakable. */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
}
