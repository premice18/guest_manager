import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Table = Database["public"]["Tables"]["tables"]["Row"];
type Zone = Database["public"]["Tables"]["zones"]["Row"];

export async function getTablesByEvent(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tables")
    .select("id, name, capacity, zone_id, is_locked, sort_order")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Table[];
}

export async function getZonesByEvent(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zones")
    .select("id, name")
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Zone[];
}

export async function getTableCounts(eventId: string) {
  const supabase = await createClient();
  const [tablesRes, zonesRes] = await Promise.all([
    supabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("zones")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);
  return {
    totalTables: tablesRes.count ?? 0,
    totalZones: zonesRes.count ?? 0,
  };
}
