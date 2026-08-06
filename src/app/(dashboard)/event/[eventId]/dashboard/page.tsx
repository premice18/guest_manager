"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Clock,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

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

const graphVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 150,
      damping: 24,
      delay: 0.2 + i * 0.1,
    },
  }),
};

// Couleurs pour le graphique camembert (catégories)
const CATEGORY_COLORS = [
  "#C9A96E", "#4CAF50", "#2196F3", "#FF9800",
  "#9C27B0", "#F44336", "#00BCD4", "#607D8B",
];

// Couleurs pour le graphique en barres (tranches d'âge)
const AGE_BAR_COLORS = {
  inscrits: "#C9A96E",
  presents: "#4CAF50",
};

// Type des payloads Recharts pour les tooltips personnalisés
interface TooltipPayloadItem {
  value?: number | string | Array<number | string>;
  name?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
  dataKey?: string | number;
}

interface BaseTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

// Tooltip personnalisé pour l'AreaChart (arrivées)
function ArrivalsTooltip({ active, payload, label }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-gold">{payload[0].value} arrivée(s)</p>
    </div>
  );
}

// Tooltip personnalisé pour le PieChart (catégories)
function CategoryTooltip({ active, payload }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{data.name}</p>
      <p className="text-sm font-bold" style={{ color: data.color }}>
        {data.value} invité{data.value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// Tooltip personnalisé pour le BarChart (âges)
function AgeTooltip({ active, payload, label }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-sm font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// Tooltip personnalisé pour le graphique occupation des tables
function TableTooltip({ active, payload }: BaseTooltipProps) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload as
    | { name?: string; fill?: string; guests?: number; capacity?: number; percentage?: number }
    | undefined;
  if (!data) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground">{data.name}</p>
      <p className="text-sm font-bold" style={{ color: data.fill }}>
        {data.guests}/{data.capacity} ({Math.round(data.percentage ?? 0)}%)
      </p>
    </div>
  );
}

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
  const storeGuests = useReceptionStore((s) => s.guests);
  const setStoreGuests = useReceptionStore((s) => s.setGuests);
  const isOnline = useReceptionStore((s) => s.isOnline);

  // État local des invités (fallback si store vide)
  const [localGuests, setLocalGuests] = useState<Guest[]>([]);

  // Souscription Realtime
  useRealtimeGuests(eventId);

  // Fusionne les invités : priorité au store, fallback sur le chargement local
  const guests: Guest[] = useMemo(() => {
    const storeValues = Object.values(storeGuests) as Guest[];
    if (storeValues.length > 0) return storeValues;
    return localGuests;
  }, [storeGuests, localGuests]);

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

      // Charge les invités dans le store si vide
      const storeValues = Object.values(useReceptionStore.getState().guests);
      if (storeValues.length === 0) {
        const { data: gsts } = await supabase
          .from("guests")
          .select("*")
          .eq("event_id", id)
          .order("last_name");
        if (!cancelled) {
          const rawGuests = (gsts ?? []) as Guest[];
          setLocalGuests(rawGuests);
          setStoreGuests(rawGuests);
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

      {/* Graphiques */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Graphique 1 : Évolution des arrivées */}
        <motion.div
          custom={0}
          variants={graphVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Clock className="size-4 text-gold" />
                Évolution des arrivées
              </CardTitle>
            </CardHeader>
            <CardContent>
              {arrivalsByHour.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={arrivalsByHour} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="arrivalsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C9A96E" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#C9A96E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="hour" tick={{ fontSize: 12 }} stroke="#999" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#999" />
                      <Tooltip content={<ArrivalsTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#C9A96E"
                        strokeWidth={2}
                        fill="url(#arrivalsGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune arrivée enregistrée pour le moment
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Graphique 2 : Répartition par catégorie */}
        <motion.div
          custom={1}
          variants={graphVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="size-4 text-gold" />
                Répartition par catégorie
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryDistribution.length > 0 ? (
                <div className="flex h-64 items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryDistribution.map((entry, idx) => (
                          <Cell
                            key={entry.name}
                            fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CategoryTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Texte central */}
                  <div className="pointer-events-none absolute flex flex-col items-center">
                    <span className="text-2xl font-bold text-deep-black">{totalGuests}</span>
                    <span className="text-xs text-muted-foreground">total</span>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune donnée de catégorie
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Graphique 3 : Tranches d'âge */}
        <motion.div
          custom={2}
          variants={graphVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Users className="size-4 text-gold" />
                Tranches d&rsquo;âge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ageDistribution.some((a) => a.inscrits > 0) ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#999" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#999" />
                      <Tooltip content={<AgeTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value: string) => (
                          <span className="text-xs text-muted-foreground">{value}</span>
                        )}
                      />
                      <Bar
                        dataKey="inscrits"
                        name="Inscrits"
                        fill={AGE_BAR_COLORS.inscrits}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                      <Bar
                        dataKey="presents"
                        name="Présents"
                        fill={AGE_BAR_COLORS.presents}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune donnée d&rsquo;âge
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Graphique 4 : Occupation des tables */}
        <motion.div
          custom={3}
          variants={graphVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
        >
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Table className="size-4 text-gold" />
                Occupation des tables
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tableOccupancy.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tableOccupancy}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="#999" domain={[0, 100]} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#999" width={60} />
                      <Tooltip content={<TableTooltip />} />
                      <Bar dataKey="percentage" name="Occupation" radius={[0, 4, 4, 0]} maxBarSize={20}>
                        {tableOccupancy.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune table configurée
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

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
