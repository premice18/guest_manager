// Interface d'invité simplifiée pour les exports DOCX (4 colonnes : N°, Noms, Nombres, Table)
export interface DocxGuest {
  id: string;
  first_name: string;
  last_name: string;
  group_id: string | null;
}

// Interface d'une table avec ses invités pour les exports DOCX
export interface DocxTableWithGuests {
  id: string;
  name: string;
  capacity: number;
  zone_name: string;
  is_locked: boolean;
  guests: DocxGuest[];
}

// Calcule la taille d'un groupe pour chaque invité
export function getGroupSizeMap(
  guests: DocxGuest[]
): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const g of guests) {
    const key = g.group_id ?? `__singleton__${g.first_name}_${g.last_name}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

// Retourne la taille du groupe pour un invité donné
export function getGroupSize(
  guest: DocxGuest,
  groupSizeMap: Map<string | null, number>
): number {
  if (!guest.group_id) return 1;
  return groupSizeMap.get(guest.group_id) ?? 1;
}

// Couleurs du design system Guest Manager
export const COLORS = {
  gold: "C9A96E",
  goldRgb: { red: 201, green: 169, blue: 110 },
  deepBlack: "1A1A1A",
  anthracite: "2D2D2D",
  offWhite: "F8F6F0",
  lightGray: "F3F4F6",
  borderGray: "D1D5DB",
  white: "FFFFFF",
};
