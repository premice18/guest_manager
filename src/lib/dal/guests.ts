import { createClient } from "@/lib/supabase/server";

export async function getGuestsByEvent(
  eventId: string,
  options?: { withTable?: boolean; placed?: boolean }
) {
  const supabase = await createClient();
  const selectCols = options?.withTable
    ? "id, event_id, table_id, first_name, last_name, group_id, group_name, is_present, checked_in_at, age_type, category, dietary_notes, needs_accessibility, notes, guest_count, tables(name)"
    : "id, event_id, table_id, first_name, last_name, group_id, group_name, is_present, checked_in_at, age_type, category, dietary_notes, needs_accessibility, notes, guest_count";

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
    .select("event_id, id, is_present, guest_count")
    .in("event_id", eventIds);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGuestsByTable(eventId: string, tableId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name, group_id, group_name, is_present, checked_in_at, guest_count")
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
    .select("id, is_present, table_id, age_type, guest_count", { count: "exact", head: false })
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  const guests = data ?? [];
  // Les compteurs sont basés sur la somme des guest_count : un invité
  // "comptant pour 5" représente 5 personnes physiques.
  const sum = (list: typeof guests) =>
    list.reduce((acc, g) => acc + (g.guest_count ?? 1), 0);
  return {
    total: sum(guests),
    present: sum(guests.filter((g) => g.is_present)),
    placed: sum(guests.filter((g) => g.table_id)),
    adults: sum(guests.filter((g) => g.age_type === "adult")),
    children: sum(guests.filter((g) => g.age_type === "child" || g.age_type === "baby")),
  };
}
