import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new AuthError("Non authentifié", 401);
  }
  return user;
}

export async function requireEventAccess(eventId: string, requiredRole: "admin" | "any" = "admin") {
  const supabase = await createClient();
  const user = await requireUser();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, event_date, location, description, owner_id, is_archived, created_at, updated_at")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    throw new AuthError("Événement introuvable", 404);
  }

  if (event.owner_id === user.id) return { user, event, role: "owner" as const };

  if (requiredRole === "any") {
    const { data: staff } = await supabase
      .from("event_staff")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single();

    if (!staff) {
      throw new AuthError("Accès refusé", 403);
    }
    return { user, event, role: staff.role as "admin" | "host" };
  }

  const { data: staff } = await supabase
    .from("event_staff")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();

  if (!staff || staff.role !== "admin") {
    throw new AuthError("Accès refusé", 403);
  }

  return { user, event, role: "admin" as const };
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "AuthError";
  }
}

export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
}
