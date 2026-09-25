import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Loaded, useTripConflicts } from "@/components/bits";
import { useData } from "@/data/store";
import { fmtEur, fmtRange } from "@/lib/format";
import { cn } from "@/lib/utils";

const TripMap = lazy(() => import("@/components/TripMap"));

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa das viagens — Erasmus em Pisa 27/28" },
      { name: "description", content: "As viagens do semestre no mapa da Europa, com Pisa como base e o percurso por ordem cronológica." },
      { property: "og:title", content: "Mapa das viagens — Erasmus em Pisa 27/28" },
      { property: "og:description", content: "As viagens do semestre no mapa da Europa, com Pisa como base e o percurso por ordem cronológica." },
    ],
  }),
  component: () => <Loaded>{() => <MapPage />}</Loaded>,
});

function MapSkeleton() {
  return <div className="h-full min-h-[420px] w-full animate-pulse rounded-xl bg-muted" />;
}

function MapPage() {
  const conflictsOf = useTripConflicts();
  const { trips } = useData();
  const [active, setActive] = useState<string | null>(null);
  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <>
      <PageHeader
        eyebrow="Europa, a partir de Pisa"
        title="Mapa"
        description="Pontos a terracota são viagens; a vermelho, as que caem em cima de aulas ou exames."
      />
      <div className="fade-up grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="card-soft h-[60vh] min-h-[420px] overflow-hidden p-0">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <TripMap trips={trips} activeId={active} />
            </Suspense>
          </ClientOnly>
        </div>
        <ol className="card-soft max-h-[60vh] divide-y overflow-y-auto">
          {sorted.map((t, i) => (
            <li key={t.id}>
              <Link
                to="/viagens/$tripId"
                params={{ tripId: t.id }}
                onMouseEnter={() => setActive(t.id)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50",
                  active === t.id && "bg-accent/50",
                )}
              >
                <span
                  className={cn(
                    "tabular flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground",
                    conflictsOf(t).length > 0 ? "bg-exames" : "bg-primary",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{fmtRange(t.startDate, t.endDate)}</span>
                </span>
                <span className="tabular text-xs text-muted-foreground">{fmtEur(t.budgetPerPerson)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
