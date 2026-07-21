// Route API : Génération du PDF Fiches par table (Table Sheets)
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { TableSheetsDocument } from "@/lib/pdf/templates/table-sheets";

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

  // Récupération des zones, tables et invités
  const [zonesResult, tablesResult, guestsResult] = await Promise.all([
    supabase.from("zones").select("id, name").eq("event_id", eventId),
    supabase.from("tables").select("*").eq("event_id", eventId).order("sort_order", { ascending: true }),
    supabase
      .from("guests")
      .select("first_name, last_name, category, age_type, dietary_notes, needs_accessibility, table_id, tables!inner(name)")
      .eq("event_id", eventId),
  ]);

  const zones = zonesResult.data ?? [];
  const tables = tablesResult.data ?? [];
  const guests = guestsResult.data ?? [];

  // Construction du map zone_id → nom
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));

  // Regroupement des invités par table
  const tablesWithGuests = tables.map((table) => ({
    name: table.name,
    capacity: table.capacity,
    zone_name: table.zone_id ? zoneMap.get(table.zone_id) ?? "—" : "—",
    guests: guests
      .filter((g) => g.table_id === table.id)
      .map((g) => ({
        first_name: g.first_name,
        last_name: g.last_name,
        category: g.category,
        age_type: g.age_type,
        dietary_notes: g.dietary_notes,
        needs_accessibility: g.needs_accessibility,
      })),
  }));

  // Génération du PDF
  const stream = await renderToStream(
    <TableSheetsDocument
      eventName={event.name}
      tables={tablesWithGuests}
    />
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="table-sheets-${eventId}.pdf"`,
    },
  });
}
