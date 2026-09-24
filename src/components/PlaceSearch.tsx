import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Place {
  name: string;
  /** Ex.: "Nice, França" */
  label: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: { country?: string };
}

/**
 * Pesquisa de lugares no OpenStreetMap (Nominatim) — sem chave de API.
 * Regras de uso: no máximo 1 pedido por segundo, por isso os pedidos esperam que se pare de escrever.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    addressdetails: "1",
    "accept-language": "pt-PT,pt",
  }).toString();
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = (await res.json()) as NominatimResult[];
  return rows.map((r) => {
    const name = r.name || r.display_name.split(",")[0]!.trim();
    const country = r.address?.country;
    return {
      name,
      label: country && country !== name ? `${name}, ${country}` : r.display_name,
      lat: Math.round(Number(r.lat) * 10000) / 10000,
      lng: Math.round(Number(r.lon) * 10000) / 10000,
    };
  });
}

export function PlaceSearch({
  onSelect,
  placeholder = "Procurar cidade ou lugar…",
}: {
  onSelect: (place: Place) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setState("loading");
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setActive(0);
          setState(r.length ? "idle" : "empty");
        })
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setState("error");
        });
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (p: Place) => {
    onSelect(p);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const showList = open && query.trim().length >= 2 && (results.length > 0 || state !== "idle");

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label="Procurar lugar"
        className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {state === "loading" && (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {results.length > 0 ? (
            <ul role="listbox" className="py-1">
              {results.map((p, i) => (
                <li key={`${p.lat},${p.lng},${i}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(p)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm",
                      i === active && "bg-accent text-accent-foreground",
                    )}
                  >
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{p.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              {state === "loading"
                ? "A procurar…"
                : state === "error"
                  ? "Sem ligação ao mapa. Tenta outra vez daqui a pouco."
                  : "Nenhum lugar encontrado."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
