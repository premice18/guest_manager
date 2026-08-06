"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeGuests } from "@/lib/hooks/use-realtime";
import { useReceptionStore } from "@/lib/store/reception-store";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Users,
  UserCheck,
  Table,
  Star,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

// Recharts est chargé de manière paresseuse (dynamic import) pour ne pas
// embarquer sa grosse dépendance dans le bundle initial de la page.
const ChartsPanel = dynamic(
  () => import("./components/ChartsPanel").then((m) => m.default),
  {
    loading: () => (
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
);

type Event = Database["public"]["Tables"]["events"]["Row"];
type Guest = Database["public"]["Tables"]["guests"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];

// Variants d'animation pour les cartes KPI
const kpiCardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 180,
      damping: 22,
      delay: i * 0.08,
    },
  }),
};

// Page du tableau de bord statistiques
export default function DashboardStatsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [eventId, setEventId] = useState("");
  const [supabase] = useState(() => createClient());

  // Données chargées depuis Supabase
  const [event, setEvent] = useState<Event | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Store Zustand (invités en temps réel)
  const events = useReceptionStore((s) => s.events);
  const setStoreGuests = useReceptionStore((s) => s.setGuests);
  const isOnline = useReceptionStore((s) => s.isOnline);

  // État local des invités (fallback si store vide)
  const [localGuests, setLocalGuests] = useState<Guest[]>([]);

  // Souscription Realtime
  useRealtimeGuests(eventId);

  // Fusionne les invités : priorité au store, fallback sur le chargement local
  const guests: Guest[] = useMemo(() => {
    const storeValues =
      eventId && events[eventId]
        ? (Object.values(events[eventId].guests) as Guest[])
        : [];
    if (storeValues.length > 0) return storeValues;
    return localGuests;
  }, [events, eventId, localGuests]);

  // Chargement initial des données
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await params.then((p) => p.eventId);
      if (cancelled) return;
      setEventId(id);

      const { data: ev } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();
      if (!cancelled && ev) setEvent(ev);

      const { data: tbls } = await supabase
        .from("tables")
        .select("*")
        .eq("event_id", id)
        .order("name");
      if (!cancelled) setTables(tbls ?? []);

// Charge les invités dans le store uniquement si l'événement courant n'y est pas encore
  const currentEvent = useReceptionStore.getState().events[id];
  if (!currentEvent) {
    const { data: gsts } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", id)
      .order("last_name");
    if (!cancelled) {
      const rawGuests = (gsts ?? []) as Guest[];
      setLocalGuests(rawGuests);
      setStoreGuests(id, rawGuests);
    }
  }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params, supabase, setStoreGuests]);

  // Affiche une notification une fois les données initiales chargées
  const didInitToast = useRef(false);
  useEffect(() => {
    if (loading || didInitToast.current) return;
    didInitToast.current = true;
    const total = guests.length;
    const present = guests.filter((g) => g.is_present).length;
    toast.success(`${present}/${total} invités présents`, {
      duration: 2000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ---- Statistiques calculées avec useMemo ----

  // KPI 1 : Total invités
  const totalGuests = useMemo(() => guests.length, [guests]);

  // KPI 2 : Présents
  const presentGuests = useMemo(
    () => guests.filter((g) => g.is_present),
    [guests]
  );
  const presentCount = useMemo(() => presentGuests.length, [presentGuests]);
  const presentPercentage = useMemo(
    () => (totalGuests > 0 ? (presentCount / totalGuests) * 100 : 0),
    [presentCount, totalGuests]
  );

  // KPI 3 : Occupation des tables
  const totalCapacity = useMemo(
    () => tables.reduce((sum, t) => sum + t.capacity, 0),
    [tables]
  );
  const placedGuests = useMemo(
    () => guests.filter((g) => g.table_id).length,
    [guests]
  );
  const occupancyRate = useMemo(
    () => (totalCapacity > 0 ? (placedGuests / totalCapacity) * 100 : 0),
    [placedGuests, totalCapacity]
  );

  // KPI 4 : VIP présents
  const vipGuests = useMemo(
    () => guests.filter((g) => g.category?.toLowerCase() === "vip"),
    [guests]
  );
  const vipPresent = useMemo(
    () => vipGuests.filter((g) => g.is_present),
    [vipGuests]
  );

  // Graphique 1 : Arrivées par heure
  const arrivalsByHour = useMemo(() => {
    const hours: Record<string, number> = {};
    for (const g of presentGuests) {
      if (g.checked_in_at) {
        const hour = new Date(g.checked_in_at).getHours();
        const key = `${hour.toString().padStart(2, "0")}:00`;
        hours[key] = (hours[key] ?? 0) + 1;
      }
    }
    // Trie par heure croissante
    const sorted = Object.entries(hours)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count }));
    return sorted;
  }, [presentGuests]);

  // Graphique 2 : Répartition par catégorie
  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of guests) {
      const cat = g.category || "Non défini";
      map[cat] = (map[cat] ?? 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [guests]);

  // Graphique 3 : Tranches d'âge
  const ageDistribution = useMemo(() => {
    const ageTypes = ["adult", "child", "baby"] as const;
    const labels: Record<string, string> = {
      adult: "Adultes",
      child: "Enfants",
      baby: "Bébés",
    };
    return ageTypes.map((type) => ({
      name: labels[type],
      inscrits: guests.filter((g) => g.age_type === type).length,
      presents: presentGuests.filter((g) => g.age_type === type).length,
    }));
  }, [guests, presentGuests]);

  // Graphique 4 : Occupation des tables
  const tableOccupancy = useMemo(() => {
    const guestCountByTable: Record<string, number> = {};
    for (const g of guests) {
      if (g.table_id) {
        guestCountByTable[g.table_id] = (guestCountByTable[g.table_id] ?? 0) + 1;
      }
    }
    return tables.map((t) => {
      const guestsOnTable = guestCountByTable[t.id] ?? 0;
      const percentage = t.capacity > 0 ? (guestsOnTable / t.capacity) * 100 : 0;
      const fill =
        percentage >= 80 ? "#4CAF50" :
        percentage >= 50 ? "#C9A96E" :
        "#F44336";
      return {
        name: t.name,
        guests: guestsOnTable,
        capacity: t.capacity,
        percentage,
        fill,
      };
    });
  }, [tables, guests]);

  // Utilitaire : nombre d'invités par table
  const guestCountByTable = useCallback(
    (tableId: string) => guests.filter((g) => g.table_id === tableId).length,
    [guests]
  );

  // Section Alertes
  const alerts = useMemo(() => {
    const results: { type: "warning" | "error" | "success"; message: string }[] = [];

    // VIP non arrivés
    const vipNotPresent = vipGuests.filter((g) => !g.is_present);
    if (vipNotPresent.length > 0) {
      results.push({
        type: "warning",
        message: `${vipNotPresent.length} VIP non arrivé(s) : ${vipNotPresent
          .slice(0, 3)
          .map((g) => `${g.first_name} ${g.last_name}`)
          .join(", ")}${vipNotPresent.length > 3 ? ` et ${vipNotPresent.length - 3} autre(s)` : ""}`,
      });
    }

    // Groupes séparés (membres d'un même groupe sur des tables différentes)
    const groups: Record<string, Guest[]> = {};
    for (const g of guests) {
      if (g.group_id && g.table_id) {
        if (!groups[g.group_id]) groups[g.group_id] = [];
        groups[g.group_id].push(g);
      }
    }
    for (const [, members] of Object.entries(groups)) {
      const uniqueTables = new Set(members.map((m) => m.table_id));
      if (uniqueTables.size > 1 && members.length > 1) {
        results.push({
          type: "warning",
          message: `Groupe "${members[0].group_name || "Sans nom"}" réparti sur ${uniqueTables.size} tables différentes`,
        });
      }
    }

    // Tables surchargées
    for (const t of tables) {
      const guestCount = guestCountByTable(t.id);
      if (guestCount > t.capacity) {
        results.push({
          type: "error",
          message: `Table ${t.name} surchargée : ${guestCount}/${t.capacity} invités`,
        });
      }
    }

    // Si tout va bien
    if (results.length === 0) {
      results.push({
        type: "success",
        message: "Tout est sous contrôle ✓",
      });
    }

    return results;
  }, [guests, vipGuests, tables, guestCountByTable]);

  // URLs d'export
  const exportUrls = useMemo(
    () => ({
      masterBook: `/api/reports/${eventId}/master-book`,
      tableSheets: `/api/reports/${eventId}/table-sheets`,
      cateringSummary: `/api/reports/${eventId}/catering-summary`,
      csv: `/api/reports/${eventId}/csv`,
    }),
    [eventId]
  );

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-muted-foreground">Chargement du tableau de bord...</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-muted-foreground">Événement introuvable</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Fil d'Ariane */}
      <Link
        href={`/event/${eventId}`}
        className="group mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Retour à l&rsquo;événement
      </Link>

      {/* En-tête */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-deep-black">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {event.name} &mdash; {formatDate(event.event_date)}
          </p>
        </div>

        {/* Indicateur temps réel */}
        <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
          <span className="relative flex size-2">
            <span className={cn(
              "inline-flex size-2 rounded-full opacity-90",
              isOnline ? "bg-green-500" : "bg-red-500"
            )} />
          </span>
          Temps réel
        </div>
      </motion.div>

      {/* Boutons d'export */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: "spring" as const, stiffness: 200, damping: 24 }}
        className="mb-6 flex flex-wrap gap-2"
      >
        <a href={exportUrls.masterBook} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-4" />
            Master Book PDF
          </Button>
        </a>
        <a href={exportUrls.tableSheets} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-4" />
            Fiches tables PDF
          </Button>
        </a>
        <a href={exportUrls.cateringSummary} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText className="size-4" />
            Résumé traiteur PDF
          </Button>
        </a>
        <a href={exportUrls.csv} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-4" />
            CSV
          </Button>
        </a>
      </motion.div>

      {/* Grille des KPI */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 : Total invités */}
        <motion.div
          custom={0}
          variants={kpiCardVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold/70 shadow-xs">
                  <Users className="size-4 text-white" />
                </div>
                Total invités
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-deep-black">{totalGuests}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {placedGuests} placé{placedGuests !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI 2 : Présents */}
        <motion.div
          custom={1}
          variants={kpiCardVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-400 shadow-xs">
                  <UserCheck className="size-4 text-white" />
                </div>
                Présents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-deep-black">{presentCount}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold to-green-500 transition-all duration-500"
                    style={{ width: `${Math.min(presentPercentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round(presentPercentage)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI 3 : Taux d'occupation */}
        <motion.div
          custom={2}
          variants={kpiCardVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-400 shadow-xs">
                  <Table className="size-4 text-white" />
                </div>
                Taux d&rsquo;occupation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-deep-black">
                {Math.round(occupancyRate)}%
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {placedGuests} / {totalCapacity} places
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI 4 : VIP présents */}
        <motion.div
          custom={3}
          variants={kpiCardVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-400 shadow-xs">
                  <Star className="size-4 text-white" />
                </div>
                VIP présents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-deep-black">
                {vipPresent.length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                sur {vipGuests.length} VIP
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Graphiques (chargés paresseusement via next/dynamic) */}
      <ChartsPanel
        totalGuests={totalGuests}
        arrivalsByHour={arrivalsByHour}
        categoryDistribution={categoryDistribution}
        ageDistribution={ageDistribution}
        tableOccupancy={tableOccupancy}
      />

      {/* Section Alertes */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring" as const, stiffness: 180, damping: 24 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4 text-gold" />
              Alertes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3 text-sm",
                    alert.type === "error" && "bg-red-50 text-red-700 ring-1 ring-red-200",
                    alert.type === "warning" && "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
                    alert.type === "success" && "bg-green-50 text-green-700 ring-1 ring-green-200"
                  )}
                >
                  {alert.type === "error" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />}
                  {alert.type === "warning" && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />}
                  {alert.type === "success" && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />}
                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
