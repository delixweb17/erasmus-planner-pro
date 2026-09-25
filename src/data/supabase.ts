import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Projeto Supabase da app. A chave "publishable" foi feita para estar no browser:
 * o que protege os dados são as regras (RLS) em `supabase/migrations`.
 * Podem ser trocadas por VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
 */
const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ?? "https://aqjvpnxpecxnwfsdblvu.supabase.co";
const SUPABASE_KEY =
  (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) ??
  "sb_publishable_QbDlMjSoAmf5p1k0yb_7Nw_aMenv0ZW";

let client: SupabaseClient | null = null;

/** Cliente do Supabase (só no browser). */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "erasmus-pisa:auth" },
    });
  }
  return client;
}
