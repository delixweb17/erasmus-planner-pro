import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { PersonId } from "./types";

type Status = "loading" | "signedOut" | "needsProfile" | "ready";

interface AuthValue {
  status: Status;
  session: Session | null;
  userId: string | null;
  email: string | null;
  /** Pessoa (p1–p4) desta conta */
  personId: PersonId | null;
  /** Perfis já escolhidos por outras contas */
  takenPeople: PersonId[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  claim: (personId: PersonId, name?: string) => Promise<void>;
  /** Nome escrito ao escolher o perfil, para aplicar quando os dados carregarem */
  pendingName: string | null;
  clearPendingName: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Traduz os erros mais comuns do Supabase. */
function explain(error: { message?: string } | null | undefined): Error {
  const msg = error?.message ?? "Erro desconhecido";
  if (/invalid login credentials/i.test(msg)) return new Error("Email ou password errados.");
  if (/email not confirmed/i.test(msg)) return new Error("Ainda não confirmaste o email — vê a tua caixa de correio.");
  if (/already registered|already been registered/i.test(msg)) return new Error("Já existe uma conta com este email. Entra em vez de criar.");
  if (/password should be at least/i.test(msg)) return new Error("A password tem de ter pelo menos 6 caracteres.");
  if (/rate limit/i.test(msg)) return new Error("Demasiadas tentativas. Espera um bocadinho e tenta outra vez.");
  if (/failed to fetch|network/i.test(msg)) return new Error("Sem ligação ao servidor. Verifica a internet.");
  return new Error(msg);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [personId, setPersonId] = useState<PersonId | null>(null);
  const [takenPeople, setTaken] = useState<PersonId[]>([]);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const loadMembership = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setPersonId(null);
      setStatus("signedOut");
      return;
    }
    const { data, error } = await supabase().from("members").select("user_id,person_id");
    if (error) {
      console.error(error);
      setStatus("needsProfile");
      return;
    }
    const rows = (data ?? []) as { user_id: string; person_id: PersonId }[];
    const mine = rows.find((r) => r.user_id === s.user.id);
    setTaken(rows.filter((r) => r.user_id !== s.user.id).map((r) => r.person_id));
    setPersonId(mine?.person_id ?? null);
    setStatus(mine ? "ready" : "needsProfile");
  }, []);

  useEffect(() => {
    const auth = supabase().auth;
    void auth.getSession().then(({ data }) => loadMembership(data.session));
    const { data: sub } = auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED")
        void loadMembership(s);
      else setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadMembership]);

  const value: AuthValue = {
    status,
    session,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    personId,
    takenPeople,
    signIn: async (email, password) => {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw explain(error);
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw explain(error);
      return { needsConfirmation: !data.session };
    },
    signOut: async () => {
      await supabase().auth.signOut();
    },
    pendingName,
    clearPendingName: () => setPendingName(null),
    claim: async (p, name) => {
      const { error } = await supabase().rpc("claim_person", { p });
      if (error) {
        await loadMembership(session);
        throw explain(error);
      }
      if (name?.trim()) setPendingName(name.trim());
      await loadMembership(session);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth tem de ser usado dentro de AuthProvider");
  return ctx;
}
