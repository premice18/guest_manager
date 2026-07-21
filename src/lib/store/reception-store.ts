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
}

interface ReceptionState {
  guests: Record<string, Guest>;
  setGuests: (guests: Guest[]) => void;
  updateGuest: (id: string, updates: Partial<Guest>) => void;

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

      // Met à jour un seul invité dans le cache (via Realtime ou action locale)
      updateGuest: (id, updates) => {
        const guests = { ...get().guests };
        if (guests[id]) {
          guests[id] = { ...guests[id], ...updates };
        }
        const allGuests = Object.values(guests);
        set({
          guests,
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
      partialize: (state) => ({
        guests: state.guests,
        pendingActions: state.pendingActions,
      }),
    }
  )
);
