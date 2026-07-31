import { createServerFn } from "@tanstack/react-start";

/**
 * One-tap demo access. Creates a throwaway, pre-confirmed account seeded with
 * Gemma's data so a reviewer can hear the product in ten seconds without
 * inventing a password. Demo accounts are marked `is_demo` in the database.
 */
export const createDemoSession = createServerFn({ method: "POST" }).handler(async () => {
  const { mintDemoUser } = await import("./demo.server");
  return mintDemoUser();
});
