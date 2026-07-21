// Route API : Génération des PDF Listes des Tables (simple et stylisée)
import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { SimpleTableListDocument } from "@/lib/pdf/table-lists/simpleTableList";
import { StylizedTableListDocument } from "@/lib/pdf/table-lists/stylizedTableList";
import type { TableListGuest } from "@/lib/pdf/table-lists/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const style = searchParams.get("style") ?? "simple";

  if (style !== "simple" && style !== "stylized") {
    return NextResponse.json(
      { error: 'Le paramètre style doit être "simple" ou "stylized"' },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      { error: "Événement introuvable" },
      { status: 404 }
    );
  }

  // Vérification des droits : propriétaire ou staff admin
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

  // Récupération des tables avec leur zone
  const { data: tables } = await supabase
    .from("tables")
    .select("id, name, capacity, zone_id, is_locked, sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  // Récupération des zones
  const { data: zones } = await supabase
    .from("zones")
    .select("id, name")
    .eq("event_id", eventId);

  if (!tables || tables.length === 0) {
    return NextResponse.json(
      { error: "Aucune table disponible pour cet événement." },
      { status: 404 }
    );
  }

  // Récupération des invités placés (avec table_id non null)
  const { data: guests } = await supabase
    .from("guests")
    .select("first_name, last_name, group_id, table_id")
    .eq("event_id", eventId)
    .not("table_id", "is", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  // Regroupement des invités par table
  const zoneMap = new Map((zones ?? []).map((z) => [z.id, z.name]));
  const tablesWithGuests = tables.map((t) => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    zone_name: t.zone_id ? zoneMap.get(t.zone_id) ?? "—" : "—",
    is_locked: t.is_locked,
    guests: (guests ?? [])
      .filter((g) => g.table_id === t.id)
      .map((g) => ({
        first_name: g.first_name,
        last_name: g.last_name,
        group_id: g.group_id,
      })),
  }));

  const totalGuests = (guests ?? []).length;
  const sanitizedName = event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const dateStr = new Date().toISOString().split("T")[0];

  // Génération du PDF selon le style demandé
  let stream: ReadableStream;

  if (style === "simple") {
    stream = (await renderToStream(
      <SimpleTableListDocument
        eventName={event.name}
        eventDate={event.event_date}
        location={event.location}
        tables={tablesWithGuests}
        totalGuests={totalGuests}
      />
    )) as unknown as ReadableStream;
  } else {
    stream = (await renderToStream(
      <StylizedTableListDocument
        eventName={event.name}
        eventDate={event.event_date}
        location={event.location}
        tables={tablesWithGuests}
        organizerContact={undefined}
      />
    )) as unknown as ReadableStream;
  }

  const filename =
    style === "simple"
      ? `liste_tables_simple_${sanitizedName}_${dateStr}.pdf`
      : `liste_tables_stylisee_${sanitizedName}_${dateStr}.pdf`;

  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
