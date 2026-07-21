import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateSimpleTableListDocx } from "@/lib/docx/simpleTableList";
import { generateStylizedTableListDocx } from "@/lib/docx/stylizedTableList";
import { requireEventAccess, uuidSchema, handleAuthError } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const parsedId = uuidSchema.safeParse(eventId);
    if (!parsedId.success) {
      return NextResponse.json({ error: "ID d'événement invalide" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const style = searchParams.get("style") ?? "simple";

    if (style !== "simple" && style !== "stylized") {
      return NextResponse.json(
        { error: 'Le paramètre style doit être "simple" ou "stylized"' },
        { status: 400 }
      );
    }

    const { event } = await requireEventAccess(parsedId.data);

    const supabase = await createClient();

    const [tablesResult, zonesResult, guestsResult] = await Promise.all([
      supabase
        .from("tables")
        .select("id, name, capacity, zone_id, is_locked, sort_order")
        .eq("event_id", parsedId.data)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("zones")
        .select("id, name")
        .eq("event_id", parsedId.data),
      supabase
        .from("guests")
        .select("first_name, last_name, group_id, table_id")
        .eq("event_id", parsedId.data)
        .not("table_id", "is", null)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true }),
    ]);

    const tables = tablesResult.data ?? [];
    const zones = zonesResult.data ?? [];
    const guests = guestsResult.data ?? [];

    if (tables.length === 0) {
      return NextResponse.json(
        { error: "Aucune table disponible pour cet événement." },
        { status: 404 }
      );
    }

    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
    const tablesWithGuests = tables.map((t) => ({
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      zone_name: t.zone_id ? zoneMap.get(t.zone_id) ?? "—" : "—",
      is_locked: t.is_locked,
      guests: guests
        .filter((g) => g.table_id === t.id)
        .map((g) => ({
          id: t.id + g.first_name + g.last_name,
          first_name: g.first_name,
          last_name: g.last_name,
          group_id: g.group_id,
        })),
    }));

    const totalGuests = guests.length;
    const sanitizedName = event.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const dateStr = new Date().toISOString().split("T")[0];

    let buffer: Buffer;

    if (style === "simple") {
      buffer = await generateSimpleTableListDocx(
        event.name,
        event.event_date,
        event.location,
        tablesWithGuests,
        totalGuests
      );
    } else {
      buffer = await generateStylizedTableListDocx(
        event.name,
        event.event_date,
        event.location,
        tablesWithGuests
      );
    }

    const filename =
      style === "simple"
        ? `liste_tables_simple_${sanitizedName}_${dateStr}.docx`
        : `liste_tables_stylisee_${sanitizedName}_${dateStr}.docx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
