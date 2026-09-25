import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms";
import { useAuth } from "@/data/auth";
import type { PersonId } from "@/data/types";
import { cn } from "@/lib/utils";

const PEOPLE: { id: PersonId; label: string; tone: string }[] = [
  { id: "p1", label: "Pessoa 1", tone: "bg-primary/15 text-primary" },
  { id: "p2", label: "Pessoa 2", tone: "bg-success/15 text-success" },
  { id: "p3", label: "Pessoa 3", tone: "bg-aulas/15 text-aulas" },
  { id: "p4", label: "Pessoa 4", tone: "bg-chart-5/15 text-chart-5" },
];

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="fade-up w-full max-w-sm">
        <p className="eyebrow">Erasmus · Pisa</p>
        <h1 className="mt-1 text-3xl font-semibold">Semestre 27/28</h1>
        <div className="card-soft mt-6 p-6">{children}</div>
      </div>
    </div>
  );
}

/** Mostra o login / escolha de perfil até haver sessão com perfil; depois mostra a app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading")
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (status === "signedOut") return <LoginScreen />;
  if (status === "needsProfile") return <ClaimScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError("Escreve o email e a password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "entrar") await signIn(email.trim(), password);
      else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setInfo("Conta criada. Confirma o email na tua caixa de correio e depois entra aqui.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border p-1">
        {(["entrar", "criar"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={cn(
              "cursor-pointer rounded-md py-1.5 text-sm font-medium",
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {m === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@exemplo.pt"
            autoFocus
          />
        </Field>
        <Field label="Password" {...(mode === "criar" ? { hint: "Pelo menos 6 caracteres." } : {})}>
          <Input
            type="password"
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {info && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{info}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {mode === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {mode === "entrar" ? "Primeira vez? Escolhe “Criar conta”." : "A tua poupança só é visível para ti."}
      </p>
    </Screen>
  );
}

function ClaimScreen() {
  const { claim, takenPeople, signOut, email } = useAuth();
  const [choice, setChoice] = useState<PersonId | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allTaken = PEOPLE.every((p) => takenPeople.includes(p.id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choice) {
      setError("Escolhe qual és.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claim(choice, name);
    } catch (err) {
      setError((err as Error).message);
      setChoice(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <p className="font-display text-xl font-semibold">Qual destes és tu?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Só se escolhe uma vez. A tua poupança fica ligada a esta conta e ninguém mais a vê.
      </p>
      {allTaken ? (
        <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Os quatro perfis já foram escolhidos. Se isto for um engano, fala com o grupo.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {PEOPLE.map((p) => {
              const taken = takenPeople.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={taken}
                  onClick={() => setChoice(p.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent",
                    choice === p.id && "border-primary bg-primary/10",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      p.tone,
                    )}
                  >
                    {p.id.toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{p.label}</span>
                    {taken && <span className="block text-[11px] text-muted-foreground">Já escolhido</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <Field label="Como te chamas?" hint="Opcional — aparece em vez de “Pessoa N”.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="O teu nome" />
          </Field>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !choice}>
            {busy && <Loader2 className="animate-spin" />}
            Continuar
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {email} ·{" "}
        <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => void signOut()}>
          Sair
        </button>
      </p>
    </Screen>
  );
}
