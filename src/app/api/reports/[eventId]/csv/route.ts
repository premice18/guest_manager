// Route API : Export CSV des invités
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

  const supabase = await createClient();

  // Vérification de l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Récupération de l'événement
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });
  }

  // Vérification des droits
  const isOwner = event.owner_id === user.id;

  if (!isOwner) {
    const { data: staff } = await supabase
      .from("event_staff")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!staff || staff.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  // Récupération des invités avec leur table
  const { data: guests } = await supabase
    .from("guests")
    .select("id, first_name, last_name, category, age_type, dietary_notes, needs_accessibility, is_present, checked_in_at, group_id, group_name, notes, table_id, tables!inner(name)")
    .eq("event_id", eventId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  // En-têtes CSV (séparateur point-virgule)
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

  // Construction des lignes
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

  // Construction du CSV avec BOM UTF-8 et séparateur point-virgule
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")),
  ].join("\r\n");

  // BOM UTF-8 pour Excel
  const bom = "\uFEFF";
  const csv = bom + csvContent;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invites-${eventId}.csv"`,
    },
  });
}
