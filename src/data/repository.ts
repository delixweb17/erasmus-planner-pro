import type { AppData } from "./types";
import { createSeedData } from "./seed";

/**
 * Camada de persistência isolada.
 * Para migrar para Supabase basta implementar esta interface
 * e trocar o repositório em `store.tsx`.
 */
export interface DataRepository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  reset(): Promise<AppData>;
}

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
      return parsed;
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
}

export const repository: DataRepository = new LocalStorageRepository();
