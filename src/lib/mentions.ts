import type { AppData, PersonId } from "@/data/types";
import { fmtEurCents, fmtRange, fmtShort } from "@/lib/format";

/**
 * Menções no chat. No texto guardado ficam como referências:
 *   #[trip:t04|Roma]   #[expense:id|Jantar]   #[booking:id|Hostel]   #[exam:id|Física]   @[p2]
 * O nome entre | é só para quando a coisa já foi apagada; enquanto existir, mostra-se o nome atual.
 */

export type EntityKind = "trip" | "expense" | "booking" | "exam";

export interface EntityRef {
  kind: EntityKind;
  id: string;
}

export type Segment =
  | { type: "text"; text: string }
  | { type: "entity"; kind: EntityKind; id: string; label: string }
  | { type: "person"; id: PersonId };

const TOKEN = /#\[(trip|expense|booking|exam):([^|\]]+)\|([^\]]*)\]|@\[(p\d+)\]/g;

export const KIND_LABEL: Record<EntityKind, string> = {
  trip: "Viagem",
  expense: "Despesa",
  booking: "Reserva",
  exam: "Exame",
};

export const cleanLabel = (s: string) => s.replace(/[[\]|]/g, "").trim();

export const entityToken = (kind: EntityKind, id: string, label: string) => `#[${kind}:${id}|${cleanLabel(label)}]`;
export const personToken = (id: PersonId) => `@[${id}]`;

export function parseMessage(body: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(TOKEN)) {
    if (m.index! > last) out.push({ type: "text", text: body.slice(last, m.index) });
    if (m[4]) out.push({ type: "person", id: m[4] });
    else out.push({ type: "entity", kind: m[1] as EntityKind, id: m[2]!, label: m[3] ?? "" });
    last = m.index! + m[0].length;
  }
  if (last < body.length) out.push({ type: "text", text: body.slice(last) });
  return out;
}

/** Coisas mencionadas numa mensagem (sem repetir). */
export function mentionedEntities(body: string): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const s of parseMessage(body)) {
    if (s.type !== "entity" || seen.has(`${s.kind}:${s.id}`)) continue;
    seen.add(`${s.kind}:${s.id}`);
    out.push({ kind: s.kind, id: s.id });
  }
  return out;
}

export const mentionsPerson = (body: string, person: PersonId) => body.includes(personToken(person));

/** Texto simples (para notificações e citações). */
export function plainText(body: string, data: AppData | null) {
  return parseMessage(body)
    .map((s) =>
      s.type === "text"
        ? s.text
        : s.type === "person"
          ? `@${data?.people.find((p) => p.id === s.id)?.name ?? s.id}`
          : `#${resolveEntity(data, s)?.title ?? s.label}`,
    )
    .join("");
}

export interface ResolvedEntity {
  kind: EntityKind;
  id: string;
  title: string;
  subtitle: string;
  /** Viagem a que pertence (para filtrar o chat por viagem) */
  tripId: string | null;
}

/** Procura a coisa mencionada nos dados atuais (null se já foi apagada). */
export function resolveEntity(data: AppData | null, ref: EntityRef): ResolvedEntity | null {
  if (!data) return null;
  const tripName = (id: string | null | undefined) => data.trips.find((t) => t.id === id)?.name;
  switch (ref.kind) {
    case "trip": {
      const t = data.trips.find((x) => x.id === ref.id);
      return t
        ? {
            kind: "trip",
            id: t.id,
            title: t.name,
            subtitle: `${fmtRange(t.startDate, t.endDate)} · ${fmtEurCents(t.budgetPerPerson)}/pessoa`,
            tripId: t.id,
          }
        : null;
    }
    case "expense": {
      const e = data.expenses.find((x) => x.id === ref.id);
      if (!e) return null;
      const payer = data.people.find((p) => p.id === e.paidBy)?.name ?? "";
      return {
        kind: "expense",
        id: e.id,
        title: e.description,
        subtitle: `${fmtEurCents(e.amount)} · ${payer} pagou${e.closedAt ? " · acertada" : ""}`,
        tripId: e.tripId,
      };
    }
    case "booking": {
      const b = data.bookings.find((x) => x.id === ref.id);
      return b
        ? {
            kind: "booking",
            id: b.id,
            title: b.title,
            subtitle: [tripName(b.tripId), fmtEurCents(b.actual ?? b.estimated), b.status].filter(Boolean).join(" · "),
            tripId: b.tripId,
          }
        : null;
    }
    case "exam": {
      const x = data.exams.find((e) => e.id === ref.id);
      return x
        ? {
            kind: "exam",
            id: x.id,
            title: x.subject,
            subtitle: `${fmtShort(x.date)}${x.time ? ` · ${x.time}` : ""}`,
            tripId: null,
          }
        : null;
    }
  }
}

/** Tudo o que se pode mencionar com # (nunca a poupança, que é privada). */
export function mentionables(data: AppData): ResolvedEntity[] {
  const refs: EntityRef[] = [
    ...[...data.trips].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((t) => ({ kind: "trip" as const, id: t.id })),
    ...[...data.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => ({ kind: "expense" as const, id: e.id })),
    ...data.bookings.filter((b) => b.title).map((b) => ({ kind: "booking" as const, id: b.id })),
    ...[...data.exams].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ kind: "exam" as const, id: e.id })),
  ];
  return refs.map((r) => resolveEntity(data, r)).filter((r): r is ResolvedEntity => !!r);
}

/** Para procurar sem acentos nem maiúsculas. */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** A mensagem fala desta viagem (diretamente ou através de uma despesa/reserva dela)? */
export function messageAboutTrip(body: string, tripId: string, data: AppData | null) {
  return mentionedEntities(body).some((r) => {
    if (r.kind === "trip") return r.id === tripId;
    return resolveEntity(data, r)?.tripId === tripId;
  });
}
