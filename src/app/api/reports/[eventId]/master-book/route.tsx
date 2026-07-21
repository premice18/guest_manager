// Route API : Génération du PDF Livre d'Or (Master Book)
import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { MasterBookDocument } from "@/lib/pdf/templates/master-book";

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

  // Récupération des invités avec leur table
  const { data: guests } = await supabase
    .from("guests")
    .select("first_name, last_name, group_id, table_id, tables!inner(name)")
    .eq("event_id", eventId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  const guestsList = (guests ?? []).map((g) => ({
    first_name: g.first_name,
    last_name: g.last_name,
    table_name: (g.tables as unknown as { name: string } | null)?.name ?? null,
    group_id: g.group_id,
  }));

  // Génération du PDF
  const stream = await renderToStream(
    <MasterBookDocument
      eventName={event.name}
      eventDate={event.event_date}
      location={event.location}
      guests={guestsList}
    />
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="master-book-${eventId}.pdf"`,
    },
  });
}
