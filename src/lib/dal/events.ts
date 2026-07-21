import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Event = Database["public"]["Tables"]["events"]["Row"];

export async function getEventById(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_date, location, description, owner_id, is_archived")
    .eq("id", eventId)
    .single();
  if (error) return null;
  return data;
}

export async function getUserEvents(userId: string, archived = false) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_date, location, is_archived")
    .eq("owner_id", userId)
    .eq("is_archived", archived)
    .order("event_date");
  if (error) throw new Error(error.message);
  return data ?? [];
}
