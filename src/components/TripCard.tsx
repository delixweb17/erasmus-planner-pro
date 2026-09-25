import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Expense, Person, Trip } from "@/data/types";
import { tripCost } from "@/lib/finance";
import { fmtEur, fmtRange } from "@/lib/format";
import { tripDays } from "@/lib/semester";
import { AvatarStack, BudgetBar, StatusBadge, TripPeriodBadges, useTripConflicts } from "./bits";
import { cn } from "@/lib/utils";

export function TripCard({
  trip,
  expenses,
  people,
  index,
  compact,
}: {
  trip: Trip;
  expenses: Expense[];
  people: Person[];
  index?: number;
  compact?: boolean;
}) {
  const cost = tripCost(trip, expenses);
  const participants = people.filter((p) => trip.participants.includes(p.id));
  const conflict = useTripConflicts()(trip).length > 0;
  const days = tripDays(trip);

  return (
    <Link
      to="/viagens/$tripId"
      params={{ tripId: trip.id }}
      className={cn(
        "card-soft group relative block p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg",
        conflict && "border-l-4 border-l-exames/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-xs font-semibold text-muted-foreground">
            {index !== undefined && <span className="mr-2 text-primary">{String(index + 1).padStart(2, "0")}</span>}
            {fmtRange(trip.startDate, trip.endDate)} · {days} {days === 1 ? "dia" : "dias"}
          </p>
          <h3 className="mt-1 truncate text-xl font-semibold">{trip.name}</h3>
          {!compact && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{trip.cities.join(" · ")}</p>
          )}
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={trip.status} />
        <TripPeriodBadges trip={trip} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="tabular text-sm">
            <span className="font-semibold">{fmtEur(cost.spentPerPerson)}</span>
            <span className="text-muted-foreground"> / {fmtEur(trip.budgetPerPerson)} por pessoa</span>
          </p>
        </div>
        <AvatarStack people={participants} />
      </div>
      <BudgetBar ratio={cost.ratio} thin className="mt-2" />
    </Link>
  );
}
