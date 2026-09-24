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

/** Formato antigo: valor mensal + interruptor "entra sozinho", com as entradas gravadas uma a uma. */
type LegacyFields = {
  monthlyPlan?: Record<string, number>;
  autoSavings?: Record<string, { startMonth: string; lastMonth: string | null }>;
};

/** Garante campos novos em dados guardados antes de existirem. */
export function migrate(d: AppData): AppData {
  const { monthlyPlan, autoSavings, ...rest } = d as AppData & LegacyFields;
  const out = { ...rest } as AppData;
  if (!out.bookings)
    out.bookings = out.trips.flatMap((t) => defaultBookings(t, (i) => `b-${t.id}-${i}`));
  if (!out.recurring) out.recurring = [];

  // Remove entradas repetidas (o interruptor antigo gravava o mesmo mês várias vezes).
  const seen = new Set<string>();
  out.savings = out.savings
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .map((s) => (s.kind ? s : { ...s, kind: "extra" }));

  // Depósitos automáticos antigos passam a depósitos mensais até ao prazo da meta.
  for (const [pid, cfg] of Object.entries(autoSavings ?? {})) {
    const amount = monthlyPlan?.[pid] ?? 0;
    if (amount <= 0) continue;
    out.savings = out.savings.filter((s) => !(s.personId === pid && s.id.startsWith("auto-")));
    out.recurring.push({
      id: `rec-${pid}-${cfg.startMonth}`,
      personId: pid,
      amount,
      startMonth: cfg.startMonth,
      endMonth: lastMonthBefore(out.savingsDeadline),
    });
  }
  return out;
}

export const monthOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};

/** Último mês cujo depósito (dia 1) ainda conta para um prazo. */
export const lastMonthBefore = (deadlineISO: string) => {
  const m = deadlineISO.slice(0, 7);
  return deadlineISO.slice(8, 10) === "01" ? addMonths(m, -1) : m;
};

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
      return migrate(parsed);
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
