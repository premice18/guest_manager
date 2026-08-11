"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Database } from "@/types/database.types";

type Guest = Database["public"]["Tables"]["guests"]["Row"];

// File d'attente des actions de check-in effectuées hors-ligne
interface PendingAction {
  id: string;
  guestId: string;
  type: "checkin" | "uncheckin";
  timestamp: string;
  // Payload supplémentaire pour un walk-in créé hors-ligne
  walkin?: {
    first_name: string;
    last_name: string;
    category: string | null;
    age_type: Guest["age_type"];
    table_id: string | null;
    notes: string | null;
    guest_count: number;
  };
}

// Cache des invités d'UN événement. Le store est scopé par eventId pour
// garantir qu'aucune donnée d'un événement ne puisse fuir dans un autre.
interface EventGuests {
  guests: Record<string, Guest>;
  totalGuests: number;
  presentCount: number;
}

interface ReceptionState {
  events: Record<string, EventGuests>;
  setGuests: (eventId: string, guests: Guest[]) => void;
  updateGuest: (eventId: string, id: string, updates: Partial<Guest>) => void;
  removeGuest: (eventId: string, id: string) => void;

  pendingActions: PendingAction[];
  addPendingAction: (action: PendingAction) => void;
  removePendingAction: (actionId: string) => void;
  clearPendingActions: () => void;
  clearAll: () => void;

  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

const emptyEvent = (): EventGuests => ({
  guests: {},
  totalGuests: 0,
  presentCount: 0,
});

// Construit un état événement à partir du cache, en recalculant les compteurs.
// Les effectifs utilisent la SOMME des guest_count : un invité "comptant
// pour 5" représente 5 personnes physiques pour le décompte des présents.
function buildEvent(guests: Record<string, Guest>): EventGuests {
  const all = Object.values(guests);
  const people = (list: Guest[]) =>
    list.reduce((acc, g) => acc + (g.guest_count ?? 1), 0);
  return {
    guests,
    totalGuests: people(all),
    presentCount: people(all.filter((g) => g.is_present)),
  };
}

// Store Zustand avec persistance locale pour le mode hors-ligne.
// Les données sont scopées par événement : plus aucune fuite inter-événements.
export const useReceptionStore = create<ReceptionState>()(
  persist(
    (set, get) => ({
      events: {},
      pendingActions: [],
      isOnline: true,

      // Charge la liste complète des invités d'un événement dans le cache local
      setGuests: (eventId, guests) => {
        const map: Record<string, Guest> = {};
        for (const g of guests) {
          map[g.id] = g;
        }
        set({
          events: { ...get().events, [eventId]: buildEvent(map) },
        });
      },

      // Met à jour un invité dans le cache (via Realtime ou action locale).
      // Si l'invité est inconnu du cache (walk-in depuis un autre poste), il est ajouté.
      updateGuest: (eventId, id, updates) => {
        const prev = get().events[eventId] ?? emptyEvent();
        const guests = { ...prev.guests };
        if (guests[id]) {
          guests[id] = { ...guests[id], ...updates };
        } else {
          guests[id] = updates as Guest;
        }
        set({
          events: { ...get().events, [eventId]: buildEvent(guests) },
        });
      },

      // Retire un invité du cache (invité supprimé dans une autre interface)
      removeGuest: (eventId, id) => {
        const prev = get().events[eventId] ?? emptyEvent();
        const guests = { ...prev.guests };
        delete guests[id];
        set({
          events: { ...get().events, [eventId]: buildEvent(guests) },
        });
      },

      // Ajoute une action à la file d'attente offline
      addPendingAction: (action) => {
        set({ pendingActions: [...get().pendingActions, action] });
      },

      // Supprime une action de la file (après synchronisation réussie).
      // Filtrée par action.id (et non guestId) : si le même invité a plusieurs
      // actions en attente (ex. check-in puis check-out hors-ligne), la
      // synchro d'une seule action ne doit pas écraser les autres (fix audit).
      removePendingAction: (actionId) => {
        set({
          pendingActions: get().pendingActions.filter((a) => a.id !== actionId),
        });
      },

      clearPendingActions: () => set({ pendingActions: [] }),

      // Purge complète du store (déconnexion). Vide TOUT le cache en mémoire
      // et le snapshot persistant, afin qu'un autre compte connecté sur le
      // même poste ne récupère pas les invités/actions du précédent
      // (fix audit : données inter-comptes + fuite des événements en mémoire).
      clearAll: () =>
        set({
          events: {},
          pendingActions: [],
          isOnline: false,
        }),

      setOnline: (online) => set({ isOnline: online }),
    }),
    {
      name: "reception-storage",
      // Ne persiste PAS les invités (PII : noms, régimes, allergies, données
      // santé) en localStorage afin d'éviter une exfiltration massive en cas
      // de XSS (recommandation audit sécurité). Seules les actions de
      // check-in effectuées hors-ligne sont conservées, et uniquement le
      // temps nécessaire à leur synchronisation.
      partialize: (state) => ({
        pendingActions: state.pendingActions,
      }),
      // Recalcule les compteurs au rechargement pour garantir la cohérence
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const events = state.events ?? {};
        for (const key of Object.keys(events)) {
          events[key] = buildEvent(events[key]?.guests ?? {});
        }
        state.events = events;
      },
    }
  )
);
