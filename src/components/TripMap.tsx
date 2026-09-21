import { Link } from "@tanstack/react-router";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { Trip } from "@/data/types";
import { PISA } from "@/data/seed";
import { fmtEur, fmtRange } from "@/lib/format";
import { hasConflict } from "./bits";

export default function TripMap({ trips, activeId }: { trips: Trip[]; activeId?: string | null }) {
  const sorted = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const route: [number, number][] = [
    [PISA.lat, PISA.lng],
    ...sorted.map((t) => [t.lat, t.lng] as [number, number]),
  ];

  return (
    <MapContainer
      center={[43.5, 11.5]}
      zoom={5}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: 420 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={route}
        pathOptions={{ color: "var(--color-primary)", weight: 1.5, dashArray: "4 6", opacity: 0.6 }}
      />
      <CircleMarker
        center={[PISA.lat, PISA.lng]}
        radius={9}
        pathOptions={{ color: "var(--color-foreground)", fillColor: "var(--color-background)", fillOpacity: 1, weight: 2.5 }}
      >
        <Tooltip permanent direction="right" offset={[10, 0]} className="font-semibold">
          Pisa · base
        </Tooltip>
      </CircleMarker>
      {sorted.map((t, i) => {
        const conflict = hasConflict(t);
        const active = t.id === activeId;
        return (
          <CircleMarker
            key={t.id}
            center={[t.lat, t.lng]}
            radius={active ? 11 : 8}
            pathOptions={{
              color: "var(--color-background)",
              fillColor: conflict ? "var(--color-exames)" : "var(--color-primary)",
              fillOpacity: active ? 1 : 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-semibold">
                {String(i + 1).padStart(2, "0")} · {t.name}
              </span>
            </Tooltip>
            <Popup>
              <div className="min-w-44 space-y-1">
                <p className="text-xs text-muted-foreground">{fmtRange(t.startDate, t.endDate)}</p>
                <p className="font-display text-base font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.cities.join(" · ")}</p>
                <p className="text-sm">{fmtEur(t.budgetPerPerson)} por pessoa</p>
                <Link to="/viagens/$tripId" params={{ tripId: t.id }} className="text-sm font-medium text-primary">
                  Abrir viagem →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
