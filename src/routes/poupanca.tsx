import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { BudgetBar, EmptyState, Loaded, PersonAvatar, Section, Stat } from "@/components/bits";
import { SavingsFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import { monthsUntil, savingsByPerson, totalBudgetPerPerson } from "@/lib/finance";
import { fmtEur, fmtEurCents, fmtLong, fmtShort } from "@/lib/format";
import { daysBetween, todayISO } from "@/lib/semester";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/poupanca")({
  head: () => ({
    meta: [
      { title: "Poupança — Erasmus em Pisa 27/28" },
      { name: "description", content: "Progresso de cada um até aos 3000 € por pessoa, a atingir até 1 de setembro de 2027." },
      { property: "og:title", content: "Poupança — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "Progresso de cada um até aos 3000 € por pessoa, a atingir até 1 de setembro de 2027." },
    ],
  }),
  component: () => <Loaded>{() => <SavingsPage />}</Loaded>,
});

function SavingsPage() {
  const data = useData();
  const { people, savings: entries, savingsGoal, savingsDeadline, trips } = data;
  const { removeSavings } = useStore();
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState<string | undefined>();

  const today = todayISO();
  const saved = savingsByPerson(data);
  const total = Object.values(saved).reduce((s, v) => s + v, 0);
  const target = savingsGoal * people.length;
  const months = monthsUntil(today, savingsDeadline);
  const days = daysBetween(today, savingsDeadline);
  const budgetNeeded = totalBudgetPerPerson(trips);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const history = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader
        eyebrow={`Meta: ${fmtEur(savingsGoal)} por pessoa até ${fmtLong(savingsDeadline)}`}
        title="Poupança"
        description={
          savingsGoal - budgetNeeded >= 0
            ? `As viagens somam ${fmtEur(budgetNeeded)} por pessoa. A meta deixa ${fmtEur(savingsGoal - budgetNeeded)} de folga para o dia a dia.`
            : `As viagens somam ${fmtEur(budgetNeeded)} por pessoa — ${fmtEur(budgetNeeded - savingsGoal)} acima da meta. Ou se poupa mais, ou se corta numa viagem.`
        }
        actions={
          <Button onClick={() => { setPersonId(undefined); setOpen(true); }}>
            <Plus /> Registar
          </Button>
        }
      />

      <div className="fade-up grid gap-4 sm:grid-cols-3">
        <Stat tone="primary" label="Poupado em conjunto" value={fmtEur(total)} hint={`${Math.round((total / target) * 100)}% de ${fmtEur(target)}`} />
        <Stat label="Tempo até à meta" value={days > 0 ? `${days} dias` : "Chegou"} hint={days > 0 ? `≈ ${months.toFixed(1)} meses` : fmtShort(savingsDeadline)} />
        <Stat
          label="Ritmo necessário / pessoa"
          value={months > 0 ? `${fmtEur(Math.max(0, (savingsGoal - total / people.length) / months))}/mês` : "—"}
          hint="média para chegar a tempo"
        />
      </div>

      <Section title="Por pessoa" className="mt-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {people.map((p) => {
            const v = saved[p.id] ?? 0;
            const ratio = savingsGoal > 0 ? v / savingsGoal : 0;
            const remaining = Math.max(0, savingsGoal - v);
            const perMonth = months > 0 ? remaining / months : 0;
            const done = remaining <= 0;
            return (
              <div key={p.id} className={cn("card-soft p-5", done && "border-success/50")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PersonAvatar person={p} size="lg" />
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {done ? "Meta atingida" : `Faltam ${fmtEur(remaining)} · ${fmtEur(perMonth)}/mês`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setPersonId(p.id); setOpen(true); }}>
                    <Plus /> Registar
                  </Button>
                </div>
                <p className="tabular mt-5 font-display text-3xl font-semibold">
                  {fmtEur(v)} <span className="text-base font-normal text-muted-foreground">/ {fmtEur(savingsGoal)}</span>
                </p>
                <BudgetBar ratio={ratio} className="mt-2 [&>div]:bg-success" />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Histórico" className="mt-10">
        {history.length === 0 ? (
          <EmptyState title="Ainda sem registos." hint="Cada vez que alguém puser dinheiro de lado, regista aqui." />
        ) : (
          <ul className="card-soft divide-y">
            {history.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <PersonAvatar person={byId[s.personId]} size="sm" />
                <span className="w-14 text-xs text-muted-foreground">{fmtShort(s.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {byId[s.personId]?.name}
                  {s.note && <span className="text-muted-foreground"> · {s.note}</span>}
                </span>
                <span className={cn("tabular font-semibold", s.amount < 0 && "text-destructive")}>
                  {s.amount > 0 ? "+" : ""}
                  {fmtEurCents(s.amount)}
                </span>
                <button
                  type="button"
                  aria-label="Apagar registo"
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  onClick={() => removeSavings(s.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <SavingsFormDialog open={open} onOpenChange={setOpen} personId={personId} />
    </>
  );
}
