import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireEventAccess, uuidSchema, handleAuthError } from "@/lib/auth";

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

    const { data: guests } = await supabase
      .from("guests")
      .select("id, first_name, last_name, category, age_type, dietary_notes, needs_accessibility, is_present, checked_in_at, group_id, group_name, notes, table_id, tables!inner(name)")
      .eq("event_id", parsedId.data)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    const headers = [
      "ID",
      "Nom",
      "Prénom",
      "Catégorie",
      "Âge",
      "Table",
      "Groupe",
      "Régimes",
      "Accessibilité",
      "Présent",
      "Heure arrivée",
      "Notes",
    ];

    const rows = (guests ?? []).map((g) => [
      g.id,
      g.last_name,
      g.first_name,
      g.category ?? "",
      g.age_type === "adult" ? "Adulte" : g.age_type === "child" ? "Enfant" : "Bébé",
      (g.tables as unknown as { name: string } | null)?.name ?? "",
      g.group_name ?? "",
      g.dietary_notes ?? "",
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
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
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
