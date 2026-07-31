import { provisionAccount } from "./bank.server";

const DEMO_NAMES = ["Gemma", "Gemma", "Gemma"];

export async function mintDemoUser() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const id = crypto.randomUUID().slice(0, 8);
  const email = `demo-${id}@echobank.demo`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const displayName = DEMO_NAMES[0] ?? "Gemma";

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, is_demo: true },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not start the demo");

  await provisionAccount(supabaseAdmin, data.user.id, displayName, true);

  return { email, password, displayName };
}
