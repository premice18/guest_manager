"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useReceptionStore } from "@/lib/store/reception-store";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Guest = Database["public"]["Tables"]["guests"]["Row"];

// Recharge un invité complet (avec le nom de sa table) après un changement de table
async function refetchGuest(eventId: string, guestId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("guests")
    .select("*, tables(name)")
    .eq("event_id", eventId)
    .eq("id", guestId)
    .single();
  return data;
}

// Hook d'écoute des changements en temps réel sur la table guests
// Met à jour le store Zustand à chaque modification (check-in, walk-in, suppression)
export function useRealtimeGuests(eventId: string) {
  const updateGuest = useReceptionStore((s) => s.updateGuest);
  const removeGuest = useReceptionStore((s) => s.removeGuest);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const supabase = createClient();

    // Souscrit aux changements sur la table guests filtrés par event_id
    const channel = supabase
      .channel(`guests-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "guests",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newGuest = payload.new as Guest;
          if (!newGuest?.id) return;
          // Recharge l'invité complet pour obtenir le nom de sa table
          const fresh = await refetchGuest(eventId, newGuest.id);
          updateGuest(eventId, newGuest.id, (fresh ?? newGuest) as Guest);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "guests",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const updatedGuest = payload.new as Guest;
          if (!updatedGuest?.id) return;
          const previous = payload.old as Partial<Guest> | null;
          // Si la table a changé, on recharge pour rafraîchir le nom de table affiché
          if (previous && previous.table_id !== updatedGuest.table_id) {
            const fresh = await refetchGuest(eventId, updatedGuest.id);
            if (fresh) {
              updateGuest(eventId, updatedGuest.id, fresh as Guest);
              return;
            }
          }
          updateGuest(eventId, updatedGuest.id, updatedGuest);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "guests",
          filter: `event_id=eq.${eventId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const oldGuest = payload.old as Guest | null;
          if (oldGuest?.id) {
            removeGuest(eventId, oldGuest.id);
          }
        }
      )
      .subscribe((status) => {
        // Met à jour le statut de connexion Realtime
        const setOnline = useReceptionStore.getState().setOnline;
        setOnline(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      // Nettoie la souscription au démontage
      supabase.removeChannel(channel);
    };
  }, [eventId, updateGuest, removeGuest]);

  return channelRef;
}
