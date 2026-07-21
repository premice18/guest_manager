// Route API : Génération du PDF Synthèse logistique (Catering Summary)
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { CateringSummaryDocument } from "@/lib/pdf/templates/catering-summary";

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
    .select("first_name, last_name, age_type, dietary_notes, needs_accessibility, table_id, tables!inner(name)")
    .eq("event_id", eventId);

  const guestsList = guests ?? [];

  // Calculs pour le résumé
  const totalGuests = guestsList.length;

  const ageBreakdown = {
    adults: guestsList.filter((g) => g.age_type === "adult").length,
    children: guestsList.filter((g) => g.age_type === "child").length,
    babies: guestsList.filter((g) => g.age_type === "baby").length,
  };

  // Résumé des régimes alimentaires
  const dietMap = new Map<string, number>();
  for (const g of guestsList) {
    if (g.dietary_notes) {
      const types = g.dietary_notes.split(",").map((d) => d.trim().toLowerCase());
      for (const t of types) {
        dietMap.set(t, (dietMap.get(t) ?? 0) + 1);
      }
    }
  }
  const dietarySummary = Array.from(dietMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Regroupement par table
  const { data: tables } = await supabase
    .from("tables")
    .select("id, name")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  const tableNameMap = new Map((tables ?? []).map((t) => [t.id, t.name]));

  const tablesWithGuests = (tables ?? []).map((table) => ({
    name: table.name,
    guests: guestsList
      .filter((g) => g.table_id === table.id)
      .map((g) => ({
        first_name: g.first_name,
        last_name: g.last_name,
        dietary_notes: g.dietary_notes,
        needs_accessibility: g.needs_accessibility,
      })),
  }));

  // Liste des invités avec besoins d'accessibilité
  const accessibilityGuests = guestsList
    .filter((g) => g.needs_accessibility)
    .map((g) => ({
      first_name: g.first_name,
      last_name: g.last_name,
      table_name: g.table_id ? tableNameMap.get(g.table_id) ?? "—" : "—",
    }));

  // Génération du PDF
  const stream = await renderToStream(
    <CateringSummaryDocument
      eventName={event.name}
      eventDate={event.event_date}
      totalGuests={totalGuests}
      ageBreakdown={ageBreakdown}
      dietarySummary={dietarySummary}
      tables={tablesWithGuests}
      accessibilityGuests={accessibilityGuests}
    />
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="catering-summary-${eventId}.pdf"`,
    },
  });
}
