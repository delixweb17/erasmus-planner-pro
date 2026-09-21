import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { EmptyState, Loaded } from "@/components/bits";
import { TripCard } from "@/components/TripCard";
import { TripFormDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useData } from "@/data/store";
import { totalBudgetPerPerson } from "@/lib/finance";
import { fmtEur } from "@/lib/format";
import { tripDays } from "@/lib/semester";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/viagens/")({
  head: () => ({
    meta: [
      { title: "Viagens — Erasmus em Pisa 27/28" },
      { name: "description", content: "As quinze viagens do semestre, com datas, orçamento por pessoa e sobreposição com aulas e exames." },
      { property: "og:title", content: "Viagens — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "As quinze viagens do semestre, com datas, orçamento por pessoa e sobreposição com aulas e exames." },
    ],
  }),
  component: () => <Loaded>{() => <TripsPage />}</Loaded>,
});

type Filter = "todas" | "futuras" | "concluidas";

function TripsPage() {
  const { trips, expenses, people } = useData();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("todas");

  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const visible = sorted.filter((t) =>
    filter === "todas" ? true : filter === "concluidas" ? t.status === "concluida" : t.status !== "concluida",
  );
  const totalDays = trips.reduce((s, t) => s + tripDays(t), 0);

  return (
    <>
      <PageHeader
        eyebrow="Setembro 2027 – Fevereiro 2028"
        title="Viagens"
        description={`${trips.length} viagens, ${totalDays} dias fora de Pisa, ${fmtEur(totalBudgetPerPerson(trips))} de orçamento por pessoa.`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Nova viagem
          </Button>
        }
      />

      <div className="mb-6 flex gap-1 rounded-full bg-muted p-1 text-sm w-fit">
        {(["todas", "futuras", "concluidas"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "cursor-pointer rounded-full px-4 py-1.5 font-medium capitalize transition-colors",
              filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "concluidas" ? "Concluídas" : f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Sem viagens aqui." hint="Muda o filtro ou adiciona uma nova viagem." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <TripCard key={t.id} trip={t} expenses={expenses} people={people} index={sorted.indexOf(t)} />
          ))}
        </div>
      )}

      <TripFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
