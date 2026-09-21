import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Loaded, PersonAvatar, Section, Stat } from "@/components/bits";
import { CATEGORY_LABEL, ExpenseFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData, useStore } from "@/data/store";
import type { Expense } from "@/data/types";
import { netBalances, simplifyDebts } from "@/lib/finance";
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
  const { removeExpense, addSettlement, removeSettlement } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();

  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  const tripById = Object.fromEntries(trips.map((t) => [t.id, t]));
  const net = netBalances(people, expenses, settlements);
  const transfers = simplifyDebts(net);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));

  const settle = (from: string, to: string, amount: number) => {
    addSettlement({ from, to, amount, date: todayISO() });
    toast.success(`${byId[from]?.name} pagou ${fmtEur(amount)} a ${byId[to]?.name}.`);
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
        <Stat tone="primary" label="Total partilhado" value={fmtEur(total)} hint={`${expenses.length} despesas`} />
        <Stat label="Acertos pendentes" value={transfers.length} hint={transfers.length === 0 ? "Tudo em dia" : "transferências para ficar quite"} />
        <Stat label="Acertos feitos" value={settlements.length} hint={`${fmtEur(settlements.reduce((s, x) => s + x.amount, 0))} já transferidos`} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-10">
          <Section title="Saldos">
            <div className="card-soft divide-y">
              {people.map((p) => {
                const v = net[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <PersonAvatar person={p} />
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span
                      className={cn(
                        "tabular text-sm font-semibold",
                        v > 0.005 && "text-success",
                        v < -0.005 && "text-destructive",
                        Math.abs(v) <= 0.005 && "text-muted-foreground",
                      )}
                    >
                      {v > 0.005 ? `recebe ${fmtEurCents(v)}` : v < -0.005 ? `deve ${fmtEurCents(-v)}` : "quite"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Como ficar quites">
            {transfers.length === 0 ? (
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

          {settlements.length > 0 && (
            <Section title="Acertos registados">
              <ul className="card-soft divide-y">
                {[...settlements].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
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

        <Section title="Todas as despesas">
          {sorted.length === 0 ? (
            <EmptyState
              title="Ainda não há despesas."
              hint="Regista a primeira: quem pagou, quanto, e entre quem se divide."
              action={<Button onClick={() => setOpen(true)}><Plus /> Nova despesa</Button>}
            />
          ) : (
            <ul className="card-soft divide-y">
              {sorted.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
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
                      {" · "}÷{e.splitBetween.length}
                    </p>
                  </div>
                  <span className="tabular text-sm font-semibold">{fmtEurCents(e.amount)}</span>
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
                    onClick={() => { removeExpense(e.id); toast.success("Despesa apagada."); }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <ExpenseFormDialog open={open} onOpenChange={setOpen} expense={editing} />
    </>
  );
}
