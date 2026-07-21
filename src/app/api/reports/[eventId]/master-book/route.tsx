import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { MasterBookDocument } from "@/lib/pdf/templates/master-book";
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

    const { data: guests } = await supabase
      .from("guests")
      .select("first_name, last_name, group_id, table_id, tables!inner(name)")
      .eq("event_id", parsedId.data)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    const guestsList = (guests ?? []).map((g) => ({
      first_name: g.first_name,
      last_name: g.last_name,
      table_name: (g.tables as unknown as { name: string } | null)?.name ?? null,
      group_id: g.group_id,
    }));

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
  } catch (error) {
    return handleAuthError(error);
  }
}
