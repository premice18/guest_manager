import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { TableSheetsDocument } from "@/lib/pdf/templates/table-sheets";
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

    const [zonesResult, tablesResult, guestsResult] = await Promise.all([
      supabase.from("zones").select("id, name").eq("event_id", parsedId.data),
      supabase.from("tables").select("id, name, capacity, zone_id").eq("event_id", parsedId.data).order("sort_order", { ascending: true }),
      supabase
        .from("guests")
        .select("first_name, last_name, category, age_type, dietary_notes, needs_accessibility, table_id, tables(name)")
        .eq("event_id", parsedId.data),
    ]);

    const zones = zonesResult.data ?? [];
    const tables = tablesResult.data ?? [];
    const guests = guestsResult.data ?? [];

    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));

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

    const stream = await renderToStream(
      <TableSheetsDocument
        eventName={event.name}
        tables={tablesWithGuests}
      />
    );

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="table-sheets-${parsedId.data}.pdf"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
