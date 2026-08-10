"use client";

import { useEffect, useState } from "react";

type Status = { label: string; container: string; dot: string };

const STATUS_STYLES: Record<string, Status> = {
  Aujourdhui: {
    label: "Aujourd'hui",
    container: "bg-gold text-deep-black ring-1 ring-gold/40",
    dot: "bg-deep-black",
  },
  Bientot: {
    label: "Bientôt",
    container: "bg-gold/10 text-gold ring-1 ring-gold/20",
    dot: "bg-gold",
  },
  AVenir: {
    label: "À venir",
    container: "bg-success-bg text-success-text ring-1 ring-success/20",
    dot: "bg-success",
  },
  Termine: {
    label: "Terminé",
    container: "bg-muted text-muted-foreground ring-1 ring-border",
    dot: "bg-muted-foreground",
  },
};

// Calcule le statut de l'événement selon le fuseau horaire du navigateur
function getStatus(eventDate: string): Status {
  const [year, month, day] = eventDate.split("-").map(Number);
  const now = new Date();
  // Interprète la date de l'événement dans le fuseau horaire local
  const eventLocal = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (eventLocal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return STATUS_STYLES.Termine;
  if (diffDays === 0) return STATUS_STYLES.Aujourdhui;
  if (diffDays <= 7) return STATUS_STYLES.Bientot;
  return STATUS_STYLES.AVenir;
}

// Badge de statut d'un événement (calcul côté client pour respecter le fuseau de l'utilisateur)
export function EventStatusBadge({ eventDate }: { eventDate: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    const update = () => setStatus(getStatus(eventDate));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [eventDate]);

  if (!status) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.container}`}
    >
      <span className="relative flex size-2">
        {status.label === "Bientôt" && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${status.dot}`} />
      </span>
      {status.label}
    </span>
  );
}