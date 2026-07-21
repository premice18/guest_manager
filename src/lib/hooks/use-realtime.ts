"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useReceptionStore } from "@/lib/store/reception-store";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Guest = Database["public"]["Tables"]["guests"]["Row"];

// Hook d'écoute des changements en temps réel sur la table guests
// Met à jour le store Zustand à chaque modification (check-in, walk-in)
export function useRealtimeGuests(eventId: string) {
  const updateGuest = useReceptionStore((s) => s.updateGuest);
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newGuest = payload.new as Guest;
          if (newGuest?.id) {
            updateGuest(newGuest.id, newGuest);
          }
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const updatedGuest = payload.new as Guest;
          if (updatedGuest?.id) {
            updateGuest(updatedGuest.id, updatedGuest);
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
  }, [eventId, updateGuest]);

  return channelRef;
}
