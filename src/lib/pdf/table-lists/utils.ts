// Interface d'invité simplifiée (4 colonnes : N°, Noms, Nombres, Table)
export interface TableListGuest {
  first_name: string;
  last_name: string;
  group_id: string | null;
}

// Interface d'une table avec ses invités groupés
export interface TableWithGuestsExport {
  id: string;
  name: string;
  capacity: number;
  zone_name: string;
  is_locked: boolean;
  guests: TableListGuest[];
}

// Calcule la taille d'un groupe pour chaque invité à partir de tous les invités des tables
export function getGroupSizeMap(
  guests: TableListGuest[]
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
  guest: TableListGuest,
  groupSizeMap: Map<string | null, number>
): number {
  if (!guest.group_id) return 1;
  return groupSizeMap.get(guest.group_id) ?? 1;
}
