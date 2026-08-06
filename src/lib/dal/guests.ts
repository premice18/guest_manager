import { createClient } from "@/lib/supabase/server";

export async function getGuestsByEvent(
  eventId: string,
  options?: { withTable?: boolean; placed?: boolean }
) {
  const supabase = await createClient();
  const selectCols = options?.withTable
    ? "id, event_id, table_id, first_name, last_name, group_id, group_name, is_present, checked_in_at, age_type, category, dietary_notes, needs_accessibility, notes, tables(name)"
    : "id, event_id, table_id, first_name, last_name, group_id, group_name, is_present, checked_in_at, age_type, category, dietary_notes, needs_accessibility, notes";

  let query = supabase.from("guests").select(selectCols).eq("event_id", eventId);

  if (options?.placed === true) query = query.not("table_id", "is", null);
  if (options?.placed === false) query = query.is("table_id", null);

  const { data, error } = await query.order("last_name").order("first_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGuestCountsByEvents(eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .select("event_id, id, is_present")
    .in("event_id", eventIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGuestsByTable(eventId: string, tableId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name, group_id, group_name, is_present, checked_in_at")
    .eq("event_id", eventId)
    .eq("table_id", tableId)
    .order("last_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGuestStats(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, is_present, table_id, age_type", { count: "exact", head: false })
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  const guests = data ?? [];
  return {
    total: guests.length,
    present: guests.filter((g) => g.is_present).length,
    placed: guests.filter((g) => g.table_id).length,
    adults: guests.filter((g) => g.age_type === "adult").length,
    children: guests.filter((g) => g.age_type === "child" || g.age_type === "baby").length,
  };
}
