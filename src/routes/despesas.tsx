import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Archive, Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Loaded, PersonAvatar, Section, Stat } from "@/components/bits";
import { CATEGORY_LABEL, ExpenseFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import type { Expense, Person, Trip } from "@/data/types";
import { canCloseAccounts, isSettled, netBalances, simplifyDebts } from "@/lib/finance";
import { fmtEur, fmtEurCents, fmtShort } from "@/lib/format";
import { todayISO } from "@/lib/semester";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas partilhadas — Erasmus em Pisa 27/28" },
      { name: "description", content: "Registo de despesas partilhadas e quem deve o quê a quem, com acertos simplificados." },
      { property: "og:title", content: "Despesas partilhadas — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "Registo de despesas partilhadas e quem deve o quê a quem, com acertos simplificados." },
    ],
  }),
  component: () => <Loaded>{() => <ExpensesPage />}</Loaded>,
});

function ExpensesPage() {
  const { people, trips, expenses, settlements } = useData();
  const { removeExpense, addSettlement, removeSettlement, closeAccounts, removeClosed } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();

  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const tripById = Object.fromEntries(trips.map((t) => [t.id, t]));
  const net = netBalances(people, expenses, settlements);
  const transfers = simplifyDebts(net);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const openExpenses = expenses.filter((e) => !e.closedAt).sort((a, b) => b.date.localeCompare(a.date));
  const openSettlements = settlements.filter((s) => !s.closedAt);
  const readyToClose = canCloseAccounts({ people, expenses, settlements });

  // Histórico: despesas e acertos fechados, agrupados pela data do fecho.
  const closedDates = [
    ...new Set([...expenses, ...settlements].map((x) => x.closedAt).filter((d): d is string => !!d)),
  ].sort((a, b) => b.localeCompare(a));

  const settle = (from: string, to: string, amount: number) => {
    const date = todayISO();
    const willClose = canCloseAccounts({
      people,
      expenses,
      settlements: [...settlements, { id: "", from, to, amount, date }],
    });
    addSettlement({ from, to, amount, date });
    toast.success(
      willClose
        ? "Contas em dia! As despesas acertadas passaram para “Contas fechadas”."
        : `${byId[from]?.name} pagou ${fmtEurCents(amount)} a ${byId[to]?.name}.`,
    );
  };

  const remove = (e: Expense) => {
    const msg =
      openSettlements.length > 0
        ? `Apagar "${e.description}"?\n\nJá há acertos registados. Se esta despesa já foi paga, não a apagues: quando toda a gente ficar quite, ela passa sozinha para "Contas fechadas". Apagá-la agora muda as contas de toda a gente.`
        : `Apagar "${e.description}"?`;
    if (!confirm(msg)) return;
    removeExpense(e.id);
    toast.success("Despesa apagada.");
  };

  return (
    <>
      <PageHeader
        eyebrow="Contas do grupo"
        title="Despesas"
        description="Cada despesa divide-se entre quem escolheres. Os saldos são calculados ao cêntimo."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus /> Nova despesa
          </Button>
        }
      />

      <div className="fade-up grid gap-4 sm:grid-cols-3">
        <Stat
          tone="primary"
          label="Total partilhado"
          value={fmtEur(total)}
          hint={`${expenses.length} ${expenses.length === 1 ? "despesa" : "despesas"} · ${openExpenses.length} por acertar`}
        />
        <Stat label="Acertos pendentes" value={transfers.length} hint={transfers.length === 0 ? "Tudo em dia" : "transferências para ficar quite"} />
        <Stat
          label="Acertos feitos"
          value={settlements.length}
          hint={`${fmtEurCents(settlements.reduce((s, x) => s + x.amount, 0))} já transferidos`}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="min-w-0 space-y-10">
          <Section title="Saldos">
            <div className="card-soft divide-y">
              {people.map((p) => {
                const v = net[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <PersonAvatar person={p} />
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span
                      title={isSettled(v) && v !== 0 ? `Diferença de arredondamento de ${fmtEurCents(Math.abs(v))} — não precisa de transferência.` : undefined}
                      className={cn(
                        "tabular text-sm font-semibold",
                        isSettled(v) ? "text-muted-foreground" : v > 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {isSettled(v) ? "quite" : v > 0 ? `recebe ${fmtEurCents(v)}` : `deve ${fmtEurCents(-v)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Como ficar quites">
            {readyToClose ? (
              <div className="card-soft flex flex-wrap items-center gap-3 p-4 text-sm">
                <Check className="size-4 text-success" />
                <span className="flex-1">Está tudo pago. Passa estas despesas para o histórico.</span>
                <Button size="sm" variant="outline" onClick={() => { closeAccounts(); toast.success("Contas fechadas."); }}>
                  <Archive /> Fechar contas
                </Button>
              </div>
            ) : transfers.length === 0 ? (
              <EmptyState title="Ninguém deve nada." hint="Quando registarem despesas, aparecem aqui as transferências mínimas." />
            ) : (
              <ul className="space-y-2">
                {transfers.map((t, i) => (
                  <li key={i} className="card-soft flex items-center gap-3 p-4 text-sm">
                    <PersonAvatar person={byId[t.from]} size="sm" />
                    <span className="font-medium">{byId[t.from]?.name}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <PersonAvatar person={byId[t.to]} size="sm" />
                    <span className="font-medium">{byId[t.to]?.name}</span>
                    <span className="tabular ml-auto font-semibold">{fmtEurCents(t.amount)}</span>
                    <Button size="sm" variant="outline" onClick={() => settle(t.from, t.to, t.amount)}>
                      <Check /> Pago
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {openSettlements.length > 0 && (
            <Section title="Acertos registados">
              <ul className="card-soft divide-y">
                {[...openSettlements].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                  <li key={s.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <span className="text-xs text-muted-foreground w-14">{fmtShort(s.date)}</span>
                    <span className="flex-1">
                      {byId[s.from]?.name} → {byId[s.to]?.name}
                    </span>
                    <span className="tabular font-semibold">{fmtEurCents(s.amount)}</span>
                    <button
                      type="button"
                      aria-label="Anular acerto"
                      className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => removeSettlement(s.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="min-w-0 space-y-10">
          <Section title="Por acertar">
            {openExpenses.length === 0 ? (
              <EmptyState
                title={expenses.length === 0 ? "Ainda não há despesas." : "Nada por acertar."}
                hint={
                  expenses.length === 0
                    ? "Regista a primeira: quem pagou, quanto, e entre quem se divide."
                    : "As despesas já pagas estão em “Contas fechadas”, aqui em baixo."
                }
                action={<Button onClick={() => { setEditing(undefined); setOpen(true); }}><Plus /> Nova despesa</Button>}
              />
            ) : (
              <ul className="card-soft divide-y">
                {openExpenses.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <ExpenseLine e={e} byId={byId} tripById={tripById} />
                    <button
                      type="button"
                      aria-label="Editar despesa"
                      className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                      onClick={() => { setEditing(e); setOpen(true); }}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Apagar despesa"
                      className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => remove(e)}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {closedDates.length > 0 && (
            <Section title="Contas fechadas">
              <div className="space-y-2">
                {closedDates.map((date) => {
                  const exps = expenses.filter((e) => e.closedAt === date).sort((a, b) => b.date.localeCompare(a.date));
                  const sets = settlements.filter((x) => x.closedAt === date);
                  const sum = exps.reduce((a, e) => a + e.amount, 0);
                  return (
                    <details key={date} className="card-soft group overflow-hidden">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                        <Check className="size-4 shrink-0 text-success" />
                        <span className="flex-1">
                          <span className="font-medium">Fechadas a {fmtShort(date)}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {exps.length} {exps.length === 1 ? "despesa" : "despesas"} · {sets.length}{" "}
                            {sets.length === 1 ? "acerto" : "acertos"}
                          </span>
                        </span>
                        <span className="tabular font-semibold">{fmtEurCents(sum)}</span>
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="divide-y border-t">
                        {exps.map((e) => (
                          <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 opacity-80">
                            <ExpenseLine e={e} byId={byId} tripById={tripById} />
                          </li>
                        ))}
                        {sets.map((x) => (
                          <li key={x.id} className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                            <ArrowRight className="size-3" />
                            <span className="flex-1">
                              {fmtShort(x.date)} · {byId[x.from]?.name} pagou a {byId[x.to]?.name}
                            </span>
                            <span className="tabular">{fmtEurCents(x.amount)}</span>
                          </li>
                        ))}
                        <li className="flex justify-end px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              const trips = exps.some((e) => e.tripId);
                              if (
                                !confirm(
                                  `Apagar de vez as contas fechadas a ${fmtShort(date)}?\n\n${exps.length} ${exps.length === 1 ? "despesa" : "despesas"} e ${sets.length} ${sets.length === 1 ? "acerto" : "acertos"} desaparecem para toda a gente. Os saldos não mudam.${trips ? " As despesas deixam de contar para o custo das viagens." : ""}`,
                                )
                              )
                                return;
                              removeClosed(date);
                              toast.success("Contas fechadas apagadas.");
                            }}
                          >
                            <Trash2 /> Apagar estas contas
                          </Button>
                        </li>
                      </ul>
                    </details>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>

      <ExpenseFormDialog open={open} onOpenChange={setOpen} expense={editing} />
    </>
  );
}

function ExpenseLine({
  e,
  byId,
  tripById,
}: {
  e: Expense;
  byId: Record<string, Person>;
  tripById: Record<string, Trip>;
}) {
  return (
    <>
      <PersonAvatar person={byId[e.paidBy]} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{e.description}</p>
        <p className="truncate text-xs text-muted-foreground">
          {fmtShort(e.date)} · {CATEGORY_LABEL[e.category]}
          {e.tripId && tripById[e.tripId] && (
            <>
              {" · "}
              <Link to="/viagens/$tripId" params={{ tripId: e.tripId }} className="hover:underline">
                {tripById[e.tripId]?.name}
              </Link>
            </>
          )}
          {" · "}
          {byId[e.paidBy]?.name} pagou · ÷{e.splitBetween.length}
        </p>
      </div>
      <span className="tabular text-sm font-semibold">{fmtEurCents(e.amount)}</span>
    </>
  );
}
