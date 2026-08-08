import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { CateringSummaryDocument } from "@/lib/pdf/templates/catering-summary";
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

    const { event } = await requireEventAccess(parsedId.data);

    const supabase = await createClient();

    const [guestsResult, tablesResult] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name, last_name, age_type, dietary_notes, needs_accessibility, is_present, table_id, tables(name)")
        .eq("event_id", parsedId.data),
      supabase
        .from("tables")
        .select("id, name")
        .eq("event_id", parsedId.data)
        .order("sort_order", { ascending: true }),
    ]);

    // Une erreur RLS/réseau ne doit jamais produire un PDF vide (HTTP 200)
    if (guestsResult.error || tablesResult.error) {
      return NextResponse.json(
        { error: "Impossible de charger les données pour l'export" },
        { status: 500 }
      );
    }

    const guestsList = guestsResult.data ?? [];
    const tables = tablesResult.data ?? [];

    const totalGuests = guestsList.length;

    const presentCount = guestsList.filter((g) => g.is_present).length;

    const ageBreakdown = {
      adults: guestsList.filter((g) => g.age_type === "adult").length,
      children: guestsList.filter((g) => g.age_type === "child").length,
      babies: guestsList.filter((g) => g.age_type === "baby").length,
    };

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

    const tableNameMap = new Map(tables.map((t) => [t.id, t.name]));

    const tablesWithGuests = tables.map((table) => ({
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

    const accessibilityGuests = guestsList
      .filter((g) => g.needs_accessibility)
      .map((g) => ({
        first_name: g.first_name,
        last_name: g.last_name,
        table_name: g.table_id ? tableNameMap.get(g.table_id) ?? "—" : "—",
      }));

    const stream = await renderToStream(
      <CateringSummaryDocument
        eventName={event.name}
        eventDate={event.event_date}
        totalGuests={totalGuests}
        presentCount={presentCount}
        ageBreakdown={ageBreakdown}
        dietarySummary={dietarySummary}
        tables={tablesWithGuests}
        accessibilityGuests={accessibilityGuests}
      />
    );

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="catering-summary-${parsedId.data}.pdf"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
