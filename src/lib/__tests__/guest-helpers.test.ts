import { describe, it, expect } from "vitest";
import {
  guestDisplayName,
  guestPersonCount,
  groupByGroupId,
  isCoupleGroup,
  getCoupleGroups,
  getCouplePersonCount,
  dedupeCoupleSecondaries,
} from "@/lib/guest-helpers";

// Petit helper pour construire un invité minimal typé
const g = (
  id: string,
  first: string,
  last: string,
  groupId?: string | null,
  count?: number | null
) => ({
  id,
  first_name: first,
  last_name: last,
  guest_count: count ?? 1,
  group_id: groupId ?? null,
  group_name: groupId ? `Groupe ${groupId}` : null,
});

describe("guestDisplayName", () => {
  it("affiche prénom nom quand les deux sont remplis", () => {
    expect(guestDisplayName(g("1", "Jean", "Dupont"))).toBe("Jean Dupont");
  });

  it("affiche uniquement le prénom quand le nom est vide", () => {
    expect(guestDisplayName(g("1", "Sophie", ""))).toBe("Sophie");
  });

  it("affiche uniquement le nom quand le prénom est vide", () => {
    expect(guestDisplayName(g("1", "", "M. Dupont"))).toBe("M. Dupont");
  });

  it("retourne un tiret quand tout est vide", () => {
    expect(guestDisplayName(g("1", "", ""))).toBe("—");
  });
});

describe("guestPersonCount", () => {
  it("utilise guest_count s'il est renseigné", () => {
    expect(guestPersonCount(g("1", "A", "B", null, 5))).toBe(5);
  });

  it("retourne 1 par défaut", () => {
    expect(guestPersonCount(g("1", "A", "B", null, null))).toBe(1);
  });
});

describe("groupByGroupId", () => {
  it("ne renvoie que les invités ayant un group_id", () => {
    const guests = [g("1", "A", "B", "grp-1"), g("2", "C", "D"), g("3", "E", "F", "grp-1")];
    const groups = groupByGroupId(guests);
    expect(groups.size).toBe(1);
    expect(groups.get("grp-1")?.map((x) => x.id)).toEqual(["1", "3"]);
  });
});

describe("isCoupleGroup", () => {
  it("détecte un couple : 2+ membres anonymes", () => {
    expect(
      isCoupleGroup([g("1", "", "Couple X", "grp"), g("2", "", "Couple X", "grp")])
    ).toBe(true);
  });

  it("rejette un groupe dont un membre a un prénom", () => {
    expect(
      isCoupleGroup([g("1", "Jean", "Dupont", "grp"), g("2", "", "Dupont", "grp")])
    ).toBe(false);
  });

  it("rejette un groupe de moins de 2 membres", () => {
    expect(isCoupleGroup([g("1", "", "Solo", "grp")])).toBe(false);
  });
});

describe("getCoupleGroups / getCouplePersonCount", () => {
  it("liste uniquement les couples", () => {
    const guests = [
      g("1", "", "Couple A", "grp-a"),
      g("2", "", "Couple A", "grp-a"),
      g("3", "Jean", "Dupont"),
      g("4", "", "Couple B", "grp-b"),
      g("5", "", "Couple B", "grp-b"),
    ];
    const couples = getCoupleGroups(guests);
    expect(couples.size).toBe(2);
    expect(getCouplePersonCount(couples.get("grp-a")!)).toBe(2);
  });

  it("compte la somme des guest_count des conjoints", () => {
    const guests = [g("1", "", "Couple", "grp", 1), g("2", "", "Couple", "grp", 3)];
    const couples = getCoupleGroups(guests);
    expect(getCouplePersonCount(couples.get("grp")!)).toBe(4);
  });
});

describe("dedupeCoupleSecondaries", () => {
  it("ne conserve qu'un seul conjoint par couple", () => {
    const guests = [
      g("1", "", "Couple A", "grp-a"),
      g("2", "", "Couple A", "grp-a"),
      g("3", "Jean", "Dupont"),
      g("4", "", "Couple B", "grp-b"),
      g("5", "", "Couple B", "grp-b"),
    ];
    const deduped = dedupeCoupleSecondaries(guests);
    expect(deduped.map((x) => x.id)).toEqual(["1", "3", "4"]);
  });

  it("laisse les singletons et groupes nommés intacts", () => {
    const guests = [g("1", "Jean", "Dupont"), g("2", "A", "B", "grp-named")];
    expect(dedupeCoupleSecondaries(guests).map((x) => x.id)).toEqual(["1", "2"]);
  });
});