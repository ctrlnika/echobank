/**
 * Speaking card details out loud.
 *
 * Card numbers must never be read as one enormous number ("four thousand five
 * hundred and thirty two…"). They are read digit by digit, in the four-digit
 * groups printed on the card, with a pause between groups so a listener can
 * write them down or repeat them back.
 */

export function groupCardNumber(digits: string): string[] {
  const clean = digits.replace(/\D/g, "");
  const groups: string[] = [];
  // 15-digit Amex is printed 4-6-5; everything else in fours.
  if (clean.length === 15) {
    return [clean.slice(0, 4), clean.slice(4, 10), clean.slice(10)];
  }
  for (let i = 0; i < clean.length; i += 4) groups.push(clean.slice(i, i + 4));
  return groups;
}

export function formatCardNumber(digits: string): string {
  return groupCardNumber(digits).join(" ");
}

/** "four, five, three, two — pause — one, two, …" */
export function speakDigits(digits: string): string {
  return groupCardNumber(digits)
    .map((group) => group.split("").join(", "))
    .join(". ");
}

export function speakExpiry(expiry: string | null): string {
  if (!expiry) return "";
  const match = expiry.match(/(\d{1,2})\s*[/\-.]\s*(\d{2,4})/);
  if (!match) return `Expiry ${expiry}.`;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthIndex = Number.parseInt(match[1] ?? "", 10) - 1;
  const month = months[monthIndex] ?? match[1];
  const year = (match[2] ?? "").length === 2 ? `20${match[2]}` : match[2];
  return `Expires end of ${month} ${year}.`;
}

export function speakCard(input: {
  brand: string;
  number: string | null;
  last4: string;
  expiry: string | null;
  holderName: string | null;
  includeFullNumber: boolean;
}): string {
  const parts: string[] = [];
  parts.push(`${input.brand === "card" ? "Bank card" : input.brand} ending ${input.last4.split("").join(", ")}.`);
  if (input.includeFullNumber && input.number) {
    parts.push(`The full number is ${speakDigits(input.number)}.`);
  }
  const expiry = speakExpiry(input.expiry);
  if (expiry) parts.push(expiry);
  if (input.holderName) parts.push(`Name on the card, ${input.holderName}.`);
  return parts.join(" ");
}

/** Luhn check — tells us whether the camera read the digits correctly. */
export function luhnValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  if (clean.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let value = Number(clean[i]);
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export function brandFromNumber(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "American Express";
  if (/^6/.test(clean)) return "Maestro";
  return "card";
}
