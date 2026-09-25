import { createFileRoute } from "@tanstack/react-router";
import { Download, LogOut, RotateCcw, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Loaded, NumberStepper, PersonAvatar, Section } from "@/components/bits";
import { Field } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData, useStore } from "@/data/store";
import { useAuth } from "@/data/auth";
import { useConfirm } from "@/components/Confirm";
import type { AppData } from "@/data/types";

export const Route = createFileRoute("/definicoes")({
  head: () => ({
    meta: [
      { title: "Definições — Erasmus em Pisa 27/28" },
      { name: "description", content: "Nomes das quatro pessoas, meta de poupança e cópia de segurança dos dados." },
      { property: "og:title", content: "Definições — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "Nomes das quatro pessoas, meta de poupança e cópia de segurança dos dados." },
    ],
  }),
  component: () => <Loaded>{() => <SettingsPage />}</Loaded>,
});

function SettingsPage() {
  const data = useData();
  const { updatePerson, setSavingsGoal, importData, resetData, activeProfile } = useStore();
  const { email, signOut } = useAuth();
  const confirm = useConfirm();
  const me = data.people.find((p) => p.id === activeProfile);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erasmus-pisa-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AppData;
      if (parsed.version !== 1 || !Array.isArray(parsed.trips)) throw new Error("formato");
      importData(parsed);
      toast.success("Dados importados.");
    } catch {
      toast.error("Ficheiro inválido.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Grupo" title="Definições" description="Os dados ficam na nuvem e são partilhados pelo grupo. A poupança de cada um só é visível para o próprio." />

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Pessoas">
          <div className="card-soft divide-y">
            {data.people.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <PersonAvatar person={p} />
                <Input
                  value={p.name}
                  onChange={(e) => updatePerson(p.id, { name: e.target.value })}
                  aria-label={`Nome de ${p.name}`}
                  className="max-w-xs"
                />
              </div>
            ))}
          </div>
        </Section>

        <div className="space-y-10">
          <Section title="A tua conta">
            <div className="card-soft flex flex-wrap items-center gap-3 p-5">
              <PersonAvatar person={me} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{me?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut /> Sair
              </Button>
            </div>
          </Section>

          <Section title="Poupança">
            <div className="card-soft p-5">
              <Field label="Meta por pessoa" hint="Prazo: 1 de setembro de 2027.">
                <NumberStepper
                  step={100}
                  unit="€"
                  aria-label="Meta por pessoa"
                  value={data.savingsGoal}
                  onChange={setSavingsGoal}
                  className="w-44"
                />
              </Field>
            </div>
          </Section>

          <Section title="Dados">
            <div className="card-soft flex flex-wrap gap-2 p-5">
              <Button variant="outline" onClick={exportJson}>
                <Download /> Exportar
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload /> Importar
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => onImport(e.target.files?.[0])}
              />
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (
                    !(await confirm({
                      title: "Repor os dados iniciais para todo o grupo?",
                      description:
                        "Apagam-se viagens, despesas, horário e exames de toda a gente, e a tua poupança. Não dá para desfazer.",
                      confirmLabel: "Repor tudo",
                      destructive: true,
                    }))
                  )
                    return;
                  await resetData();
                  toast.success("Dados repostos.");
                }}
              >
                <RotateCcw /> Repor seed
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
