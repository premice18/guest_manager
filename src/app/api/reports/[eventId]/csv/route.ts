import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEventAccess, uuidSchema, handleAuthError } from "@/lib/auth";
import {
  getCoupleGroups,
  getCouplePersonCount,
  guestPersonCount,
  dedupeCoupleSecondaries,
} from "@/lib/guest-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const parsedId = uuidSchema.safeParse(eventId);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID d'événement invalide" }, { status: 400 });
    }

    await requireEventAccess(parsedId.data);

    const supabase = await createClient();

    const { data: guests, error } = await supabase
      .from("guests")
      .select("id, first_name, last_name, category, needs_accessibility, is_present, checked_in_at, group_id, group_name, guest_count, notes, table_id, tables(name)")
      .eq("event_id", parsedId.data)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    // Une erreur RLS/réseau ne doit JAMAIS produire un CSV vide (HTTP 200) :
    // on propage une erreur explicite côté client.
    if (error) {
      return NextResponse.json(
        { error: "Impossible de charger les invités pour l'export" },
        { status: 500 }
      );
    }

    // Sécurise une cellule CSV : échappe les guillemets ET neutralise
    // l'injection de formule Excel (cellules débutant par = + - @ etc.)
    function escapeCsvCell(value: unknown): string {
      let str = String(value ?? "");
      // Prévient l'injection de formule (OWASP CSV Injection)
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    }

    // Les couples (2 conjoints anonymes liés par un group_id) apparaissent sur
    // UNE seule ligne avec le nom du couple et le décompte de personnes.
    const guestRows = dedupeCoupleSecondaries(guests ?? []);
    const coupleGroups = getCoupleGroups(guests ?? []);

    const headers = [
      "ID",
      "Noms",
      "Prénom",
      "Catégorie",
      "Nombres",
      "Groupe",
      "Table",
      "Accessibilité",
      "Présent",
      "Heure arrivée",
      "Notes",
    ];

    const rows = guestRows.map((g) => {
      const members = g.group_id ? coupleGroups.get(g.group_id) : undefined;
      const personCount = members
        ? getCouplePersonCount(members)
        : guestPersonCount(g);
      const displayName = members
        ? g.group_name ?? g.last_name
        : [g.last_name, g.first_name].filter(Boolean).join(" ").trim();
      return [
        g.id,
        displayName,
        members ? "" : g.first_name,
        g.category ?? "",
        String(personCount),
        g.group_name ?? "",
        (g.tables as unknown as { name: string } | null)?.name ?? "",
        g.needs_accessibility ? "Oui" : "Non",
        g.is_present ? "Oui" : "Non",
        g.checked_in_at
          ? new Date(g.checked_in_at).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        g.notes ?? "",
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(";")),
    ].join("\r\n");

    const bom = "\uFEFF";
    const csv = bom + csvContent;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="invites-${parsedId.data}.csv"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
