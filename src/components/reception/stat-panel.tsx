"use client";

import { motion, useReducedMotion } from "framer-motion";
import { UserCheck, Baby, AlertTriangle, Timer } from "lucide-react";

// Panneau de statistiques affiché dans l'interface de réception / check-in.
// Composant purement présentatif, alimenté par les compteurs calculés en amont.
export function StatPanel({
  presentCount,
  totalGuests,
  progressPercent,
  childrenCount,
  presentChildren,
  unassignedCount,
  pendingActions,
}: {
  presentCount: number;
  totalGuests: number;
  progressPercent: number;
  childrenCount: number;
  presentChildren: number;
  unassignedCount: number;
  pendingActions: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const items = [
    {
      label: "Taux de présence",
      value: `${progressPercent}%`,
      icon: UserCheck,
      color: "text-green-600",
      ariaLabel: `Taux de présence : ${progressPercent}%`,
    },
    {
      label: "Enfants présents",
      value: `${presentChildren}/${childrenCount}`,
      icon: Baby,
      color: "text-gold",
      ariaLabel: `Enfants présents : ${presentChildren} sur ${childrenCount}`,
    },
    {
      label: "Non placés",
      value: `${unassignedCount}`,
      icon: AlertTriangle,
      color: unassignedCount > 0 ? "text-amber-500" : "text-muted-foreground",
      ariaLabel: `Invités non placés : ${unassignedCount}`,
    },
  ];

  if (pendingActions > 0) {
    items.push({
      label: "En attente",
      value: `${pendingActions}`,
      icon: Timer,
      color: "text-gold",
      ariaLabel: `Actions en attente : ${pendingActions}`,
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Statistiques
      </h3>
      <div className="space-y-3">
        {/* Compteur principal */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
          transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
          className="text-center"
        >
          <div className="relative inline-flex items-center justify-center">
            <svg
              className="size-20 -rotate-90"
              viewBox="0 0 80 80"
              aria-hidden="true"
            >
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="var(--border)"
                strokeWidth="5"
              />
              <motion.circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                initial={prefersReducedMotion ? false : { strokeDashoffset: 2 * Math.PI * 34 }}
                animate={prefersReducedMotion ? {} : {
                  strokeDashoffset:
                    2 * Math.PI * 34 * (1 - progressPercent / 100),
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-gold"
              />
            </svg>
            <span className="absolute text-lg font-bold">{presentCount}</span>
          </div>
          <p
            className="mt-1 text-xs text-muted-foreground"
            aria-label={`sur ${totalGuests} invités`}
          >
            sur {totalGuests} invités
          </p>
        </motion.div>

        {/* Détails */}
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between text-sm"
              aria-label={item.ariaLabel}
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <item.icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </span>
              <span className={`font-semibold ${item.color}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}