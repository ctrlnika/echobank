export const CATEGORIES = [
  "groceries",
  "transport",
  "bills",
  "transfer",
  "income",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function asCategory(value: string): Category {
  return (CATEGORIES as readonly string[]).includes(value) ? (value as Category) : "other";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  groceries: "Groceries",
  transport: "Transport",
  bills: "Bills",
  transfer: "Transfer",
  income: "Income",
  other: "Other",
};

/** Tailwind text-colour token per category. Colour is never the only signal. */
export const CATEGORY_COLOR: Record<Category, string> = {
  groceries: "text-cat-groceries",
  transport: "text-cat-transport",
  bills: "text-cat-bills",
  transfer: "text-cat-transfer",
  income: "text-cat-income",
  other: "text-cat-other",
};
