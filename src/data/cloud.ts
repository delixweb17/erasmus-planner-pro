import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AppData, PersonId } from "./types";
import { migrate } from "./repository";
import { supabase } from "./supabase";

/**
 * Sincronização com o Supabase.
 * Cada viagem, despesa, aula… é uma linha em `shared_items` (o grupo todo vê);
 * cada registo de poupança é uma linha em `private_items` (só a própria pessoa vê).
 * As alterações locais viram operações por linha (diff), por isso duas pessoas
 * a editar coisas diferentes ao mesmo tempo não se apagam uma à outra.
 */

type Row = { kind: string; id: string; data: unknown };

const SHARED = [
  { key: "people", kind: "person" },
  { key: "trips", kind: "trip" },
  { key: "expenses", kind: "expense" },
  { key: "settlements", kind: "settlement" },
  { key: "bookings", kind: "booking" },
  { key: "timetable", kind: "class" },
  { key: "exams", kind: "exam" },
] as const;

const PRIVATE = [
  { key: "savings", kind: "saving" },
  { key: "recurring", kind: "recurring" },
] as const;

type SharedKey = (typeof SHARED)[number]["key"];
type PrivateKey = (typeof PRIVATE)[number]["key"];
type Item = { id: string; personId?: string };

const SETTINGS_ID = "main";

export type Op =
  | { table: "shared_items"; action: "upsert"; kind: string; id: string; data: unknown }
  | { table: "private_items"; action: "upsert"; kind: string; id: string; data: unknown; person_id: string }
  | { table: "shared_items" | "private_items"; action: "delete"; kind: string; id: string };

const settingsOf = (d: Partial<AppData>) => ({
  savingsGoal: d.savingsGoal,
  savingsDeadline: d.savingsDeadline,
});

/** Operações para passar de `prev` a `next` (só o que mudou). */
export function diff(prev: Partial<AppData>, next: AppData): Op[] {
  const ops: Op[] = [];
  const collections = [
    ...SHARED.map((c) => ({ ...c, table: "shared_items" as const })),
    ...PRIVATE.map((c) => ({ ...c, table: "private_items" as const })),
  ];
  for (const { key, kind, table } of collections) {
    const before = (prev[key] ?? []) as Item[];
    const after = next[key] as Item[];
    if (before === after) continue;
    const old = new Map(before.map((i) => [i.id, i]));
    for (const item of after) {
      const was = old.get(item.id);
      old.delete(item.id);
      if (was === item || (was && JSON.stringify(was) === JSON.stringify(item))) continue;
      if (table === "private_items")
        ops.push({ table, action: "upsert", kind, id: item.id, data: item, person_id: item.personId! });
      else ops.push({ table, action: "upsert", kind, id: item.id, data: item });
    }
    for (const id of old.keys()) ops.push({ table, action: "delete", kind, id });
  }
  if (JSON.stringify(settingsOf(prev)) !== JSON.stringify(settingsOf(next)))
    ops.push({ table: "shared_items", action: "upsert", kind: "settings", id: SETTINGS_ID, data: settingsOf(next) });
  return ops;
}

/** Envia as operações para o Supabase. */
export async function pushOps(ops: Op[], userId: string) {
  if (ops.length === 0) return;
  const db = supabase();
  const now = new Date().toISOString();
  const tasks: PromiseLike<{ error: unknown }>[] = [];
  for (const table of ["shared_items", "private_items"] as const) {
    const upserts = ops.filter((o) => o.table === table && o.action === "upsert");
    if (upserts.length)
      tasks.push(
        db.from(table).upsert(
          upserts.map((o) => {
            const { table: _t, action: _a, ...row } = o as Op & { data: unknown };
            return table === "shared_items" ? { ...row, updated_at: now, updated_by: userId } : { ...row, updated_at: now };
          }),
        ),
      );
    const deletes = ops.filter((o) => o.table === table && o.action === "delete");
    for (const kind of new Set(deletes.map((o) => o.kind)))
      tasks.push(
        db
          .from(table)
          .delete()
          .eq("kind", kind)
          .in(
            "id",
            deletes.filter((o) => o.kind === kind).map((o) => o.id),
          ),
      );
  }
  const results = await Promise.all(tasks);
  const failed = results.find((r) => r.error);
  if (failed) throw failed.error;
}

const sortBy = <T>(arr: T[], key: (t: T) => string) => [...arr].sort((a, b) => key(a).localeCompare(key(b)));

/** Monta os dados da app a partir das linhas; null se a nuvem ainda estiver vazia. */
export function fromRows(shared: Row[], priv: Row[]): AppData | null {
  const settings = shared.find((r) => r.kind === "settings")?.data as ReturnType<typeof settingsOf> | undefined;
  if (!settings) return null;
  const pick = (rows: Row[], kind: string) => rows.filter((r) => r.kind === kind).map((r) => r.data);
  const d = {
    version: 1,
    savingsGoal: settings.savingsGoal ?? 3000,
    savingsDeadline: settings.savingsDeadline ?? "2027-09-01",
  } as AppData;
  const target = d as unknown as Record<string, unknown>;
  for (const { key, kind } of SHARED) target[key] = pick(shared, kind);
  for (const { key, kind } of PRIVATE) target[key] = pick(priv, kind);
  d.people = sortBy(d.people, (p) => p.id);
  d.trips = sortBy(d.trips, (t) => t.startDate);
  d.expenses = sortBy(d.expenses, (e) => e.date);
  return migrate(d);
}

export async function loadCloud(): Promise<AppData | null> {
  const db = supabase();
  const [shared, priv] = await Promise.all([
    db.from("shared_items").select("kind,id,data"),
    db.from("private_items").select("kind,id,data"),
  ]);
  if (shared.error) throw shared.error;
  if (priv.error) throw priv.error;
  return fromRows(shared.data as Row[], priv.data as Row[]);
}

/** Primeira vez na nuvem: envia os dados deste dispositivo (partilhados + a poupança da própria pessoa). */
export function initialOps(local: AppData, personId: PersonId, cloudHasShared: boolean): Op[] {
  const mine = {
    ...local,
    savings: local.savings.filter((s) => s.personId === personId),
    recurring: local.recurring.filter((r) => r.personId === personId),
  };
  const ops = diff({}, mine);
  return cloudHasShared ? ops.filter((o) => o.table === "private_items") : ops;
}

/** Aplica uma alteração que chegou em tempo real de outra pessoa. */
export function applyRemote(
  d: AppData,
  table: "shared_items" | "private_items",
  change: { eventType: "INSERT" | "UPDATE" | "DELETE"; kind: string; id: string; data?: unknown },
): AppData {
  if (change.kind === "settings") {
    if (change.eventType === "DELETE" || !change.data) return d;
    return { ...d, ...(change.data as object) };
  }
  const coll = [...SHARED, ...PRIVATE].find((c) => c.kind === change.kind);
  if (!coll || (table === "private_items") !== PRIVATE.some((c) => c.kind === change.kind)) return d;
  const key = coll.key as SharedKey | PrivateKey;
  const list = d[key] as Item[];
  const rest = list.filter((i) => i.id !== change.id);
  if (change.eventType === "DELETE") return rest.length === list.length ? d : { ...d, [key]: rest };
  const idx = list.findIndex((i) => i.id === change.id);
  const next = idx >= 0 ? list.map((i, j) => (j === idx ? (change.data as Item) : i)) : [...list, change.data as Item];
  return { ...d, [key]: next };
}

/** Ouve as alterações dos outros. Devolve a função para deixar de ouvir. */
export function subscribeCloud(
  userId: string,
  onChange: (
    table: "shared_items" | "private_items",
    change: { eventType: "INSERT" | "UPDATE" | "DELETE"; kind: string; id: string; data?: unknown },
  ) => void,
) {
  const db = supabase();
  const channel: RealtimeChannel = db.channel("erasmus-data");
  for (const table of ["shared_items", "private_items"] as const) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Row & { updated_by?: string };
      if (!row?.kind || !row.id) return;
      // O eco das nossas próprias alterações já está aplicado.
      if (payload.eventType !== "DELETE" && table === "shared_items" && row.updated_by === userId) return;
      onChange(table, { eventType: payload.eventType, kind: row.kind, id: row.id, data: row.data });
    });
  }
  channel.subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

export async function fetchGroupTotal(): Promise<number> {
  const { data, error } = await supabase().rpc("group_savings_total");
  if (error) throw error;
  return Number(data) || 0;
}
