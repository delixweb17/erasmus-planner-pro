import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { BudgetBar, Loaded, PersonAvatar, Section, Stat, useTripConflicts } from "@/components/bits";
import { TripCard } from "@/components/TripCard";
import { ExpenseFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import { netBalances, savingsByPerson, simplifyDebts, totalBudgetPerPerson, tripCost } from "@/lib/finance";
import { fmtEur, fmtLong, fmtShort } from "@/lib/format";
import { daysBetween, todayISO } from "@/lib/semester";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Erasmus em Pisa 27/28" },
      { name: "description", content: "Resumo do semestre: próxima viagem, orçamento, saldos e poupança do grupo." },
      { property: "og:title", content: "Painel — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "Resumo do semestre: próxima viagem, orçamento, saldos e poupança do grupo." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Loaded>{() => <Dashboard />}</Loaded>;
}

function Dashboard() {
  const conflictsOf = useTripConflicts();
  const data = useData();
  const { people, trips, expenses, settlements, savingsGoal, savingsDeadline } = data;
  const [expenseOpen, setExpenseOpen] = useState(false);
  const { activeProfile } = useStore();
  const me = people.find((p) => p.id === activeProfile);
  const today = todayISO();

  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const upcoming = sorted.filter((t) => t.endDate >= today);
  const next = upcoming[0];
  const daysToNext = next ? daysBetween(today, next.startDate) : null;

  const budgetPerPerson = totalBudgetPerPerson(trips);
  const spentTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const budgetTotal = trips.reduce((s, t) => s + tripCost(t, expenses).budgetTotal, 0);
  const conflicts = trips.filter((t) => conflictsOf(t).length > 0).length;

  const net = netBalances(people, expenses, settlements);
  const transfers = simplifyDebts(net);
  const savings = savingsByPerson(data);
  const savingsTotal = Object.values(savings).reduce((s, v) => s + v, 0);
  const savingsTarget = savingsGoal * people.length;
  const daysToDeadline = daysBetween(today, savingsDeadline);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Bom dia" : h < 20 ? "Boa tarde" : "Boa noite";
  })();

  return (
    <>
      <PageHeader
        eyebrow={fmtLong(today)}
        title={`${greeting}. Pisa espera.`}
        description={
          next
            ? daysToNext! > 0
              ? `Faltam ${daysToNext} dias para ${next.name}.`
              : `${next.name} está a decorrer.`
            : "Não há viagens futuras — hora de planear."
        }
        actions={
          <Button onClick={() => setExpenseOpen(true)}>
            <Plus /> Despesa
          </Button>
        }
      />

      <div className="fade-up grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          tone="primary"
          label="Viagens no semestre"
          value={trips.length}
          hint={conflicts > 0 ? `${conflicts} em cima de aulas ou exames` : "Nenhuma em cima de aulas"}
        />
        <Stat
          label="Orçamento por pessoa"
          value={fmtEur(budgetPerPerson)}
          hint={`${fmtEur(budgetTotal)} para os ${people.length}`}
        />
        <Stat
          label="Gasto até agora"
          value={fmtEur(spentTotal)}
          hint={budgetTotal > 0 ? `${Math.round((spentTotal / budgetTotal) * 100)}% do orçamento total` : undefined}
        />
        <Stat
          label="Poupado em conjunto"
          value={fmtEur(savingsTotal)}
          hint={`de ${fmtEur(savingsTarget)} · ${daysToDeadline > 0 ? `${daysToDeadline} dias até ${fmtShort(savingsDeadline)}` : "prazo passou"}`}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <Section
            title="Próximas viagens"
            action={
              <Link to="/viagens" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Ver todas <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(upcoming.length ? upcoming : sorted).slice(0, 4).map((t) => (
                <TripCard key={t.id} trip={t} expenses={expenses} people={people} index={sorted.indexOf(t)} compact />
              ))}
            </div>
          </Section>

          <Section title="Orçamento por viagem">
            <div className="card-soft divide-y">
              {sorted.map((t) => {
                const c = tripCost(t, expenses);
                return (
                  <Link
                    key={t.id}
                    to="/viagens/$tripId"
                    params={{ tripId: t.id }}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-accent/50 sm:grid-cols-[110px_1fr_auto]"
                  >
                    <span className="tabular hidden text-xs text-muted-foreground sm:block">{fmtShort(t.startDate)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.name}</span>
                      <BudgetBar ratio={c.ratio} thin className="mt-1.5 max-w-xs" />
                    </span>
                    <span className="tabular text-right text-sm">
                      <span className="font-semibold">{fmtEur(c.spentPerPerson)}</span>
                      <span className="text-muted-foreground"> / {fmtEur(t.budgetPerPerson)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="space-y-10">
          <Section
            title="Quem deve a quem"
            action={
              <Link to="/despesas" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Despesas <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <div className="card-soft p-5">
              {transfers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Contas em dia. Ninguém deve nada a ninguém.</p>
              ) : (
                <ul className="space-y-3">
                  {transfers.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <PersonAvatar person={byId[t.from]} size="sm" />
                      <span className="font-medium">{byId[t.from]?.name}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      <PersonAvatar person={byId[t.to]} size="sm" />
                      <span className="font-medium">{byId[t.to]?.name}</span>
                      <span className="tabular ml-auto font-semibold">{fmtEur(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section
            title="Poupança"
            action={
              <Link to="/poupanca" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Detalhe <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            <div className="card-soft space-y-4 p-5">
              {me ? (
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <PersonAvatar person={me} size="sm" /> A tua poupança
                    </span>
                    <span className="tabular">
                      <span className="font-semibold">{fmtEur(savings[me.id] ?? 0)}</span>
                      <span className="text-muted-foreground"> / {fmtEur(savingsGoal)}</span>
                    </span>
                  </div>
                  <BudgetBar ratio={savingsGoal > 0 ? (savings[me.id] ?? 0) / savingsGoal : 0} thin className="mt-1.5 [&>div]:bg-success" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link to="/poupanca" className="font-medium text-primary hover:underline">Escolhe quem és</Link> para veres a tua poupança.
                </p>
              )}
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Grupo</span>
                  <span className="tabular text-muted-foreground">{savingsTarget > 0 ? Math.round((savingsTotal / savingsTarget) * 100) : 0}%</span>
                </div>
                <BudgetBar ratio={savingsTarget > 0 ? savingsTotal / savingsTarget : 0} thin className="mt-1.5 [&>div]:bg-success" />
              </div>
            </div>
          </Section>
        </div>
      </div>

      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
    </>
  );
}
