// Helpers de formatage pour les rapports PDF
import type { Database } from "@/types/database.types";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Table = Database["public"]["Tables"]["tables"]["Row"];
type Zone = Database["public"]["Tables"]["zones"]["Row"];

export interface GuestWithTable extends Guest {
  tables?: { name: string } | null;
}

export interface TableWithGuests extends Table {
  guests: GuestWithTable[];
  zone_name?: string;
}

const AGE_LABELS: Record<string, string> = {
  adult: "Adulte",
  child: "Enfant",
  baby: "Bébé",
};

// Formate une date pour les rapports
export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Formate une heure pour les rapports
export function formatTime(date: string | Date | null) {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Retourne le libellé français pour un type d'âge
export function getAgeLabel(ageType: string): string {
  return AGE_LABELS[ageType] ?? ageType;
}

// Regroupe les invités par table pour les rapports
export function groupGuestsByTable(
  guests: GuestWithTable[],
  tables: Table[],
  zones: Zone[]
): TableWithGuests[] {
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
  return tables
    .map((t) => ({
      ...t,
      zone_name: t.zone_id ? zoneMap.get(t.zone_id) ?? "—" : "—",
      guests: guests.filter((g) => g.table_id === t.id),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

// Extrait les régimes alimentaires uniques avec leur décompte
export function extractDietarySummary(guests: GuestWithTable[]): { type: string; count: number }[] {
  const diets = new Map<string, number>();
  for (const g of guests) {
    if (g.dietary_notes) {
      const types = g.dietary_notes.split(",").map((d) => d.trim().toLowerCase());
      for (const t of types) {
        diets.set(t, (diets.get(t) ?? 0) + 1);
      }
    }
  }
  return Array.from(diets.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

// Compte les invités par tranche d'âge
export function countByAge(guests: GuestWithTable[]) {
  return {
    adults: guests.filter((g) => g.age_type === "adult").length,
    children: guests.filter((g) => g.age_type === "child").length,
    babies: guests.filter((g) => g.age_type === "baby").length,
  };
}

export { AGE_LABELS };
