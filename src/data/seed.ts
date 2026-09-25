import type { AppData, Booking, Trip } from "./types";

export function defaultBookings(trip: Pick<Trip, "id" | "startDate" | "endDate">, makeId: (i: number) => string): Booking[] {
  const out: Booking[] = [
    { id: makeId(0), tripId: trip.id, category: "transporte", title: "Transporte (ida e volta)", estimated: 0, status: "pendente" },
  ];
  if (trip.endDate > trip.startDate)
    out.push({ id: makeId(1), tripId: trip.id, category: "alojamento", title: "Alojamento", estimated: 0, status: "pendente" });
  return out;
}

const all = ["p1", "p2", "p3", "p4"];

const trip = (
  id: string,
  name: string,
  cities: string[],
  startDate: string,
  endDate: string,
  budgetPerPerson: number,
  lat: number,
  lng: number,
): Trip => ({
  id,
  name,
  cities,
  startDate,
  endDate,
  budgetPerPerson,
  participants: [...all],
  status: "planeada",
  lat,
  lng,
});

export const PISA = { lat: 43.7228, lng: 10.4017 };

export function createSeedData(): AppData {
  const data: AppData = {
    version: 1,
    people: [
      { id: "p1", name: "Pessoa 1", color: 0 },
      { id: "p2", name: "Pessoa 2", color: 1 },
      { id: "p3", name: "Pessoa 3", color: 2 },
      { id: "p4", name: "Pessoa 4", color: 3 },
    ],
    trips: [
      trip("t01", "Costa Azul", ["Nice", "Mónaco", "Sanremo"], "2027-09-04", "2027-09-09", 240, 43.7102, 7.262),
      trip("t02", "Sardenha", ["Cagliari"], "2027-09-10", "2027-09-14", 350, 39.2238, 9.1217),
      trip("t03", "Cinque Terre", ["Cinque Terre"], "2027-09-19", "2027-09-19", 30, 44.1461, 9.6539),
      trip("t04", "Dolomitas", ["Ortisei"], "2027-09-28", "2027-10-04", 240, 46.5748, 11.6717),
      trip("t05", "Toscana clássica", ["Florença", "Siena"], "2027-10-10", "2027-10-10", 45, 43.7696, 11.2558),
      trip("t06", "Costa Amalfitana", ["Nápoles", "Pompeia", "Amalfi", "Positano", "Capri"], "2027-10-14", "2027-10-18", 370, 40.8518, 14.2681),
      trip("t07", "Malta", ["Valletta"], "2027-10-24", "2027-10-27", 240, 35.8989, 14.5146),
      trip("t08", "Norte de Itália", ["Bolonha", "Modena", "Verona", "Veneza", "San Marino"], "2027-11-04", "2027-11-08", 260, 44.4949, 11.3426),
      trip("t09", "Roma", ["Roma"], "2027-11-13", "2027-11-15", 160, 41.9028, 12.4964),
      trip("t10", "Barcelona", ["Barcelona"], "2027-11-20", "2027-11-23", 220, 41.3874, 2.1686),
      trip("t11", "Toscana secreta", ["Lucca", "Pitigliano", "Sorano"], "2027-11-28", "2027-11-29", 90, 43.843, 10.5079),
      trip("t12", "Império austro-húngaro", ["Viena", "Bratislava", "Budapeste"], "2027-12-08", "2027-12-16", 380, 48.2082, 16.3738),
      trip("t13", "Cracóvia", ["Cracóvia"], "2027-12-17", "2027-12-22", 205, 50.0647, 19.945),
      trip("t14", "Lombardia e Piemonte", ["Milão", "Como", "Turim"], "2028-01-03", "2028-01-06", 285, 45.4642, 9.19),
      trip("t15", "Riviera ligure", ["Génova", "Portofino"], "2028-01-10", "2028-01-10", 45, 44.4056, 8.9463),
    ],
    expenses: [],
    savings: [],
    settlements: [],
    bookings: [],
    recurring: [],
    timetable: [],
    savingsGoal: 3000,
    savingsDeadline: "2027-09-01",
  };
  data.bookings = data.trips.flatMap((t) => defaultBookings(t, (i) => `b-${t.id}-${i}`));
  return data;
}
