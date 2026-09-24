import type { AppData } from "./types";
import { createSeedData, defaultBookings } from "./seed";

/**
 * Camada de persistência isolada.
 * Para migrar para Supabase basta implementar esta interface
 * e trocar o repositório em `store.tsx`.
 */
export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  reset(): Promise<AppData>;
  /** Perfil ativo neste dispositivo (fica fora dos dados partilhados) */
  getActiveProfile(): string | null;
  setActiveProfile(id: string | null): void;
}

/** Garante campos novos em dados guardados antes de existirem. */
export function migrate(d: AppData): AppData {
  const out = { ...d } as AppData;
  if (!out.monthlyPlan) out.monthlyPlan = {};
  if (!out.autoSavings) out.autoSavings = {};
  if (!out.bookings)
    out.bookings = out.trips.flatMap((t) => defaultBookings(t, (i) => `b-${t.id}-${i}`));
  out.savings = out.savings.map((s) => (s.kind ? s : { ...s, kind: "extra" }));
  return out;
}

const PROFILE_KEY = "erasmus-pisa:profile";

const STORAGE_KEY = "erasmus-pisa:data";

export class LocalStorageRepository implements DataRepository {
  async load(): Promise<AppData> {
    if (typeof window === "undefined") return createSeedData();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = createSeedData();
        await this.save(seed);
        return seed;
      }
      const parsed = JSON.parse(raw) as AppData;
      if (parsed.version !== 1) return createSeedData();
      return applyAutoSavings(migrate(parsed));
    } catch {
      return createSeedData();
    }
  }

  async save(data: AppData): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async reset(): Promise<AppData> {
    const seed = createSeedData();
    await this.save(seed);
    return seed;
  }

  getActiveProfile(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(PROFILE_KEY);
  }

  setActiveProfile(id: string | null): void {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(PROFILE_KEY, id);
    else window.localStorage.removeItem(PROFILE_KEY);
  }
}

export const repository: DataRepository = new LocalStorageRepository();

const nextMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** Cria os depósitos automáticos em falta até ao mês atual (inclusive). */
export function applyAutoSavings(d: AppData, now = new Date()): AppData {
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let changed = false;
  const savings = [...d.savings];
  const auto = { ...d.autoSavings };
  for (const [pid, cfg] of Object.entries(d.autoSavings ?? {})) {
    const amount = d.monthlyPlan[pid] ?? 0;
    if (amount <= 0) continue;
    let m = cfg.lastMonth ? nextMonth(cfg.lastMonth) : cfg.startMonth;
    let last = cfg.lastMonth;
    while (m <= current) {
      savings.push({
        id: `auto-${pid}-${m}`,
        personId: pid,
        amount,
        date: `${m}-01`,
        kind: "mensal",
        month: m,
        note: "Automático",
      });
      last = m;
      m = nextMonth(m);
      changed = true;
    }
    auto[pid] = { ...cfg, lastMonth: last };
  }
  return changed ? { ...d, savings, autoSavings: auto } : d;
}
