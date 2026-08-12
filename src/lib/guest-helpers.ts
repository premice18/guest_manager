// Helpers partagés pour la gestion des invités : noms flexibles (prénom OU
// nom), et détection/regroupement des « couples » (deux lignes anonymes liées
// par un group_id, affichées comme une seule entrée dans la liste et les exports).

// Type minimal reflétant les champs nécessaires aux helpers
export interface GuestNameLike {
  id: string;
  first_name: string;
  last_name: string;
  guest_count?: number | null;
  group_id?: string | null;
  group_name?: string | null;
}

// Retourne le nom à afficher : prénom, nom, ou les deux — selon ce qui est
// rempli. Évite les espaces superflus (ex : «  Dupont » quand le prénom vide).
export function guestDisplayName(g: GuestNameLike): string {
  return [g.first_name, g.last_name].filter(Boolean).join(" ").trim() || "—";
}

// Nombre de personnes physiques représentées par une entrée.
export function guestPersonCount(g: GuestNameLike): number {
  return g.guest_count ?? 1;
}

// Regroupe les invités par group_id.
export function groupByGroupId<T extends { group_id?: string | null }>(
  guests: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const g of guests) {
    if (g.group_id) {
      const arr = map.get(g.group_id) ?? [];
      arr.push(g);
      map.set(g.group_id, arr);
    }
  }
  return map;
}

// Un « couple » est un groupe d'au moins 2 membres dont TOUS les prénoms sont
// vides (les conjoints sont créés automatiquement avec un nom générique).
export function isCoupleGroup<T extends GuestNameLike>(members: T[]): boolean {
  return (
    members.length >= 2 &&
    members.every((m) => (m.first_name ?? "").trim() === "")
  );
}

// Construit la liste des groupes qui sont des « couples » : group_id -> membres.
export function getCoupleGroups<T extends GuestNameLike>(
  guests: T[]
): Map<string, T[]> {
  const couples = new Map<string, T[]>();
  for (const [groupId, members] of groupByGroupId(guests)) {
    if (isCoupleGroup(members)) couples.set(groupId, members);
  }
  return couples;
}

// Nombre de personnes représentées par un couple (somme des guest_count des
// conjoints — en pratique 2 pour un couple standard).
export function getCouplePersonCount<T extends GuestNameLike>(
  members: T[]
): number {
  return members.reduce((acc, m) => acc + (m.guest_count ?? 1), 0);
}

// Exclut les membres « secondaires » des couples : seul le premier conjoint de
// chaque couple est conservé afin qu'un couple n'apparaisse qu'UNE fois dans
// les exports et les listes. Les singletons et les groupes nommés passent tels
// quels.
export function dedupeCoupleSecondaries<T extends GuestNameLike>(
  guests: T[]
): T[] {
  // Retient l'ID du conjoint « principal » (premier du groupe) de chaque couple,
  // ainsi que l'ID du groupe lui-même.
  const keptPrimaryIds = new Set<string>();
  const coupleGroupIds = new Set<string>();
  for (const [groupId, members] of groupByGroupId(guests)) {
    if (isCoupleGroup(members)) {
      const primary = members[0];
      keptPrimaryIds.add(primary.id);
      coupleGroupIds.add(groupId);
    }
  }
  // Conserve le conjoint principal, et tout invité n'appartenant PAS à un
  // couple (singletons et groupes nommés passent tels quels). Les conjoints
  // secondaires des couples sont exclus pour ne jamais les compter deux fois.
  return guests.filter(
    (g) =>
      keptPrimaryIds.has(g.id) ||
      !(g.group_id && coupleGroupIds.has(g.group_id))
  );
}