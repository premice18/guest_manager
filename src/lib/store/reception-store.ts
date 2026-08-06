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
  };
}

interface ReceptionState {
  guests: Record<string, Guest>;
  setGuests: (guests: Guest[]) => void;
  updateGuest: (id: string, updates: Partial<Guest>) => void;
  removeGuest: (id: string) => void;

  pendingActions: PendingAction[];
  addPendingAction: (action: PendingAction) => void;
  removePendingAction: (guestId: string) => void;
  clearPendingActions: () => void;

  isOnline: boolean;
  setOnline: (online: boolean) => void;

  totalGuests: number;
  presentCount: number;
  setCounts: (total: number, present: number) => void;
}

// Store Zustand avec persistance locale pour le mode hors-ligne
export const useReceptionStore = create<ReceptionState>()(
  persist(
    (set, get) => ({
      guests: {},
      totalGuests: 0,
      presentCount: 0,
      isOnline: true,
      pendingActions: [],

      // Charge la liste complète des invités dans le cache local
      setGuests: (guests) => {
        const map: Record<string, Guest> = {};
        for (const g of guests) {
          map[g.id] = g;
        }
        set({
          guests: map,
          totalGuests: guests.length,
          presentCount: guests.filter((g) => g.is_present).length,
        });
      },

      // Met à jour un invité dans le cache (via Realtime ou action locale).
      // Si l'invité est inconnu du cache (walk-in depuis un autre poste), il est ajouté.
      updateGuest: (id, updates) => {
        const guests = { ...get().guests };
        if (guests[id]) {
          guests[id] = { ...guests[id], ...updates };
        } else {
          guests[id] = updates as Guest;
        }
        const allGuests = Object.values(guests);
        set({
          guests,
          totalGuests: allGuests.length,
          presentCount: allGuests.filter((g) => g.is_present).length,
        });
      },

      // Retire un invité du cache (invité supprimé dans une autre interface)
      removeGuest: (id) => {
        const guests = { ...get().guests };
        delete guests[id];
        const allGuests = Object.values(guests);
        set({
          guests,
          totalGuests: allGuests.length,
          presentCount: allGuests.filter((g) => g.is_present).length,
        });
      },

      // Ajoute une action à la file d'attente offline
      addPendingAction: (action) => {
        set({ pendingActions: [...get().pendingActions, action] });
      },

      // Supprime une action de la file (après synchronisation réussie)
      removePendingAction: (guestId) => {
        set({
          pendingActions: get().pendingActions.filter((a) => a.guestId !== guestId),
        });
      },

      clearPendingActions: () => set({ pendingActions: [] }),

      setOnline: (online) => set({ isOnline: online }),

      setCounts: (total, present) => set({ totalGuests: total, presentCount: present }),
    }),
    {
      name: "reception-storage",
      // Persiste aussi les compteurs pour un affichage correct après rechargement hors-ligne
      partialize: (state) => ({
        guests: state.guests,
        pendingActions: state.pendingActions,
        totalGuests: state.totalGuests,
        presentCount: state.presentCount,
      }),
      // Recalcule les compteurs au rechargement pour garantir la cohérence avec le cache
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const allGuests = Object.values(state.guests ?? {});
        state.totalGuests = allGuests.length;
        state.presentCount = allGuests.filter((g) => g.is_present).length;
      },
    }
  )
);
