"use client";

import { useEffect, useState, useCallback, useMemo, useRef, use } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { useReceptionStore } from "@/lib/store/reception-store";
import { useRealtimeGuests } from "@/lib/hooks/use-realtime";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Wifi,
  WifiOff,
  Users,
  UserPlus,
  Check,
  ArrowLeft,
  Clock,
  Baby,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Keyboard,
  PartyPopper,
  UserCheck,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Table = Database["public"]["Tables"]["tables"]["Row"];

const AGE_LABELS: Record<string, string> = {
  adult: "Adulte",
  child: "Enfant",
  baby: "Bébé",
};
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 70%)`;
}

function getInitials(first: string, last: string) {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

export default function ReceptionPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [eventName, setEventName] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const guestsMap = useReceptionStore((s) => s.guests);
  const setGuests = useReceptionStore((s) => s.setGuests);
  const updateGuest = useReceptionStore((s) => s.updateGuest);
  const totalGuests = useReceptionStore((s) => s.totalGuests);
  const presentCount = useReceptionStore((s) => s.presentCount);
  const isOnline = useReceptionStore((s) => s.isOnline);
  const pendingActions = useReceptionStore((s) => s.pendingActions);
  const addPendingAction = useReceptionStore((s) => s.addPendingAction);
  const removePendingAction = useReceptionStore((s) => s.removePendingAction);

  const [search, setSearch] = useState("");
  const [filterLetter, setFilterLetter] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "groups">("list");
  const [statsOpen, setStatsOpen] = useState(false);

  const [walkinModal, setWalkinModal] = useState(false);
  const [wiFirstName, setWiFirstName] = useState("");
  const [wiLastName, setWiLastName] = useState("");
  const [wiCategory, setWiCategory] = useState("Invité imprévu");
  const [wiAgeType, setWiAgeType] = useState<"adult" | "child" | "baby">(
    "adult",
  );
  const [wiTableId, setWiTableId] = useState("none");
  const [wiNotes, setWiNotes] = useState("");
  const [wiSaving, setWiSaving] = useState(false);

  const progressPercent =
    totalGuests > 0 ? Math.round((presentCount / totalGuests) * 100) : 0;

  const enrichGuests = useCallback(
    async (guestData: unknown) => {
      const raw = guestData as Array<Guest & { tables?: { name: string } | null }>;
      const enriched = raw.map(
        ({ tables, ...g }) => ({ ...g, table_name: tables?.name ?? null }) as Guest,
      );
      setGuests(enriched);
    },
    [setGuests],
  );

  const refreshGuests = useCallback(async () => {
    const { data: gsts } = await supabase
      .from("guests")
      .select("*, tables(name)")
      .eq("event_id", eventId)
      .order("last_name")
      .order("first_name");
    if (gsts) await enrichGuests(gsts);
  }, [eventId, supabase, enrichGuests]);

  useEffect(() => {
    (async () => {
      const { data: ev } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventId)
        .single();
      if (ev) setEventName(ev.name);

      const { data: tbls } = await supabase
        .from("tables")
        .select("*")
        .eq("event_id", eventId)
        .order("name");
      setTables(tbls ?? []);

      const { data: gsts } = await supabase
        .from("guests")
        .select("*, tables(name)")
        .eq("event_id", eventId)
        .order("last_name")
        .order("first_name");

      if (gsts) await enrichGuests(gsts);
      setLoading(false);
    })();
  }, [eventId, supabase, enrichGuests]);

  useRealtimeGuests(eventId);

  // Invités filtrés
  type EnrichedGuest = Guest & { table_name?: string | null };
  const filteredGuests = useMemo(() => {
    const all = Object.values(guestsMap) as EnrichedGuest[];
    return all.filter((g) => {
      const q = search.toLowerCase();
      if (
        q &&
        !`${g.first_name} ${g.last_name} ${g.group_name ?? ""} ${g.table_name ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (filterLetter && (g.last_name[0] ?? "").toUpperCase() !== filterLetter)
        return false;
      if (filterTable !== "all") {
        if (filterTable === "none") {
          if (g.table_id) return false;
        } else {
          if (g.table_id !== filterTable) return false;
        }
      }
      if (filterStatus === "present" && !g.is_present) return false;
      if (filterStatus === "absent" && g.is_present) return false;
      return true;
    });
  }, [guestsMap, search, filterLetter, filterTable, filterStatus]);

  const groupedView = useMemo(() => {
    const groups: Record<
      string,
      { groupName: string; members: EnrichedGuest[] }
    > = {};
    const solos: EnrichedGuest[] = [];
    const all = Object.values(guestsMap) as EnrichedGuest[];
    for (const g of all) {
      if (g.group_id) {
        if (!groups[g.group_id]) {
          groups[g.group_id] = {
            groupName: g.group_name ?? "Groupe",
            members: [],
          };
        }
        groups[g.group_id].members.push(g);
      } else {
        solos.push(g);
      }
    }
    return { groups: Object.values(groups), solos };
  }, [guestsMap]);

  const togglePresence = async (guest: Guest) => {
    const newStatus = !guest.is_present;
    const timestamp = new Date().toISOString();

    updateGuest(guest.id, {
      is_present: newStatus,
      checked_in_at: newStatus ? timestamp : null,
    });

    if (!isOnline) {
      addPendingAction({
        id: nanoid(),
        guestId: guest.id,
        type: newStatus ? "checkin" : "uncheckin",
        timestamp,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("guests")
        .update({
          is_present: newStatus,
          checked_in_at: newStatus ? timestamp : null,
        })
        .eq("id", guest.id);

      if (error) {
        updateGuest(guest.id, {
          is_present: guest.is_present,
          checked_in_at: guest.checked_in_at,
        });
        toast.error(error.message);
      }
    } catch {
      updateGuest(guest.id, {
        is_present: guest.is_present,
        checked_in_at: guest.checked_in_at,
      });
      toast.error("Erreur réseau");
    }
  };

  const checkinGroup = async (groupId: string) => {
    const timestamp = new Date().toISOString();
    const members = (Object.values(guestsMap) as Guest[]).filter(
      (g) => g.group_id === groupId,
    );

    for (const m of members) {
      updateGuest(m.id, { is_present: true, checked_in_at: timestamp });
    }

    if (!isOnline) {
      for (const m of members) {
        addPendingAction({
          id: nanoid(),
          guestId: m.id,
          type: "checkin",
          timestamp,
        });
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("guests")
        .update({ is_present: true, checked_in_at: timestamp })
        .eq("group_id", groupId);

      if (error) {
        toast.error(error.message);
        await refreshGuests();
      }
    } catch {
      toast.error("Erreur lors du check-in groupé");
    }
  };

  const addWalkin = async () => {
    if (!wiFirstName.trim() || !wiLastName.trim()) {
      toast.error("Prénom et nom requis");
      return;
    }
    setWiSaving(true);
    try {
      const { data, error } = await supabase
        .from("guests")
        .insert({
          event_id: eventId,
          first_name: wiFirstName.trim(),
          last_name: wiLastName.trim(),
          category: wiCategory.trim() || "Invité imprévu",
          age_type: wiAgeType,
          table_id: wiTableId === "none" ? null : wiTableId,
          notes: wiNotes.trim() || null,
          is_present: true,
          checked_in_at: new Date().toISOString(),
        })
        .select("*, tables(name)")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      const tableName =
        (data as unknown as { tables?: { name: string } | null })?.tables
          ?.name ?? "non placé";
      toast.success(`${data.first_name} ${data.last_name} → ${tableName}`);
      setWalkinModal(false);
      setWiFirstName("");
      setWiLastName("");
      setWiCategory("Invité imprévu");
      setWiAgeType("adult");
      setWiTableId("none");
      setWiNotes("");

      await refreshGuests();
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setWiSaving(false);
    }
  };

  const syncPendingActions = useCallback(async () => {
    if (pendingActions.length === 0) return;
    const actions = [...pendingActions];
    let synced = 0;

    for (const action of actions) {
      try {
        const { error } = await supabase
          .from("guests")
          .update({
            is_present: action.type === "checkin",
            checked_in_at: action.type === "checkin" ? action.timestamp : null,
          })
          .eq("id", action.guestId);

        if (!error) {
          removePendingAction(action.guestId);
          synced++;
        }
      } catch {
        // On réessaiera au prochain cycle
      }
    }

    if (synced > 0) {
      toast.success(`${synced} action(s) synchronisée(s)`);
    }
  }, [pendingActions, supabase, removePendingAction]);

  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncPendingActions();
    }
  }, [isOnline, pendingActions.length, syncPendingActions]);

  useEffect(() => {
    const handleOnline = () => useReceptionStore.getState().setOnline(true);
    const handleOffline = () => useReceptionStore.getState().setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne pas interférer avec la saisie dans un champ
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setViewMode((prev) => (prev === "list" ? "groups" : "list"));
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setWalkinModal(true);
      }
      if (e.key === "Escape") {
        setWalkinModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getTableAvailable = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return 0;
    const all = Object.values(guestsMap) as Guest[];
    return table.capacity - all.filter((g) => g.table_id === tableId).length;
  };

  // Stats enrichies
  const childrenCount = useMemo(
    () =>
      (Object.values(guestsMap) as Guest[]).filter(
        (g) => g.age_type === "child" || g.age_type === "baby",
      ).length,
    [guestsMap],
  );
  const presentChildren = useMemo(
    () =>
      (Object.values(guestsMap) as Guest[]).filter(
        (g) =>
          g.is_present && (g.age_type === "child" || g.age_type === "baby"),
      ).length,
    [guestsMap],
  );
  const unassignedCount = useMemo(
    () =>
      (Object.values(guestsMap) as Guest[]).filter((g) => !g.table_id).length,
    [guestsMap],
  );

  // Badge pour l'indicateur de progression
  const getProgressColor = () => {
    if (progressPercent >= 75) return "bg-green-500";
    if (progressPercent >= 40) return "bg-gold";
    return "bg-muted-foreground/30";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-off-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="size-12 rounded-full border-4 border-gold/30 border-t-gold"
        />
        <p className="text-sm text-muted-foreground">
          Chargement de la réception...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-off-white">
      {/* ===== En-tête ===== */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 20 }}
        className="sticky top-0 z-40 border-b border-border bg-white shadow-sm"
      >
        <div className="mx-auto max-w-5xl px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard"
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted sm:hidden"
                aria-label="Retour au tableau de bord"
              >
                <ArrowLeft className="size-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold sm:text-lg">
                    {eventName || "Réception"}
                  </h1>
                  {/* Indicateur de statut en temps réel */}
                  <motion.span
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "easeInOut",
                    }}
                    className={cn(
                      "inline-block size-2 rounded-full",
                      isOnline ? "bg-green-500" : "bg-red-500",
                    )}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {isOnline ? (
                      <Wifi className="size-3 text-green-600" />
                    ) : (
                      <WifiOff className="size-3 text-red-500" />
                    )}
                    {isOnline ? "Connecté" : "Hors-ligne"}
                  </span>
                  {pendingActions.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="rounded-full bg-gold/10 px-2 py-0.5 text-gold"
                    >
                      {pendingActions.length} en attente
                    </motion.span>
                  )}
                </div>
              </div>
            </div>

            {/* Compteur principal */}
            <div className="text-right">
              <motion.p
                key={presentCount}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="text-lg font-bold sm:text-2xl"
              >
                {presentCount}
                <span className="text-sm font-normal text-muted-foreground">
                  /{totalGuests}
                </span>
              </motion.p>
              <p className="text-xs text-muted-foreground">
                {totalGuests > 0
                  ? `${progressPercent}% présents`
                  : "Aucun invité"}
              </p>
            </div>
          </div>

          {/* Barre de progression */}
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% des invités présents`}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full transition-colors",
                getProgressColor(),
              )}
            />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4">
        {/* ===== Barre de recherche et filtres ===== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4 space-y-3"
        >
          {/* Recherche prédictive */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Rechercher un invité, une table, un groupe... (Ctrl+F)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pl-11 text-base focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="Rechercher un invité"
            />
          </div>

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre alphabétique */}
            <div
              className="flex gap-0.5 overflow-x-auto pb-1"
              role="group"
              aria-label="Filtre alphabétique"
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setFilterLetter("")}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium transition-colors",
                  !filterLetter
                    ? "bg-gold text-white"
                    : "bg-white text-muted-foreground hover:bg-muted",
                )}
                aria-label="Toutes les lettres"
              >
                Tous
              </motion.button>
              {LETTERS.map((letter) => (
                <motion.button
                  key={letter}
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    setFilterLetter(letter === filterLetter ? "" : letter)
                  }
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium transition-colors",
                    filterLetter === letter
                      ? "bg-gold text-white"
                      : "bg-white text-muted-foreground hover:bg-muted",
                  )}
                  aria-label={`Lettre ${letter}`}
                  aria-pressed={filterLetter === letter}
                >
                  {letter}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              aria-label="Filtrer par table"
            >
              <option value="all">Toutes les tables</option>
              <option value="none">Non placés</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 rounded-lg border border-input bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              aria-label="Filtrer par statut"
            >
              <option value="all">Tous</option>
              <option value="present">Présents</option>
              <option value="absent">Absents</option>
            </select>

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="inline-flex overflow-hidden rounded-lg border border-input bg-white"
            >
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-gold text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Vue liste"
                aria-pressed={viewMode === "list"}
              >
                <List className="size-4" />
                <span className="hidden sm:inline">Liste</span>
              </button>
              <button
                onClick={() => setViewMode("groups")}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === "groups"
                    ? "bg-gold text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Vue groupes"
                aria-pressed={viewMode === "groups"}
              >
                <Users className="size-4" />
                <span className="hidden sm:inline">Groupes</span>
              </button>
            </motion.div>

            {/* Bouton stats (mobile) */}
            <button
              onClick={() => setStatsOpen(!statsOpen)}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-input bg-white px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden"
              aria-expanded={statsOpen}
              aria-label="Statistiques"
            >
              <LayoutGrid className="size-4" />
              Stats
              {statsOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>

            {/* Indication des raccourcis */}
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Keyboard className="size-3" />
              <kbd className="rounded border bg-muted/50 px-1 font-mono text-[10px]">
                G
              </kbd>{" "}
              Groupes
              <kbd className="rounded border bg-muted/50 px-1 font-mono text-[10px]">
                N
              </kbd>{" "}
              Nouvel invité
            </span>
          </div>
        </motion.div>

        {/* Panneau de stats (mobile) */}
        <AnimatePresence>
          {statsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4 overflow-hidden sm:hidden"
            >
              <StatPanel
                presentCount={presentCount}
                totalGuests={totalGuests}
                progressPercent={progressPercent}
                childrenCount={childrenCount}
                presentChildren={presentChildren}
                unassignedCount={unassignedCount}
                pendingActions={pendingActions.length}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bandeau hors-ligne */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
                <WifiOff className="size-4 shrink-0" />
                Mode hors-ligne – Les actions seront synchronisées
                automatiquement.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== Contenu principal ===== */}
        <div className="flex gap-6">
          {/* Colonne principale */}
          <div className="min-w-0 flex-1">
            {/* Vue en liste */}
            {viewMode === "list" && (
              <AnimatePresence mode="wait">
                {filteredGuests.length > 0 ? (
                  <motion.div
                    key="guest-list"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                  >
                    {filteredGuests.map((guest) => (
                      <motion.div
                        key={guest.id}
                        variants={itemVariants}
                        layout
                        exit="exit"
                      >
                        <button
                          onClick={() => togglePresence(guest)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.98]",
                            guest.is_present
                              ? "border-green-200 bg-green-50"
                              : "border-border bg-white hover:border-gold/50 hover:shadow-sm",
                          )}
                          aria-label={
                            guest.is_present
                              ? `${guest.first_name} ${guest.last_name}, présent. Cliquez pour annuler.`
                              : `${guest.first_name} ${guest.last_name}, absent. Cliquez pour enregistrer.`
                          }
                        >
                          {/* Avatar circulaire avec initiales */}
                          <div
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-colors",
                              guest.is_present
                                ? "bg-green-500"
                                : "bg-muted-foreground/30",
                            )}
                            style={
                              !guest.is_present
                                ? {
                                    backgroundColor: stringToColor(
                                      `${guest.first_name} ${guest.last_name}`,
                                    ),
                                  }
                                : undefined
                            }
                          >
                            {guest.is_present ? (
                              <Check className="size-5" />
                            ) : guest.age_type === "baby" ? (
                              <Baby className="size-5" />
                            ) : (
                              getInitials(guest.first_name, guest.last_name)
                            )}
                          </div>

                          {/* Infos invité */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">
                              {guest.first_name} {guest.last_name}
                            </p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              {guest.table_name && (
                                <span className="truncate">
                                  {guest.table_name}
                                </span>
                              )}
                              {guest.group_name && (
                                <span className="truncate text-gold">
                                  {guest.group_name}
                                </span>
                              )}
                              {guest.category && (
                                <span className="truncate">
                                  {guest.category}
                                </span>
                              )}
                              {guest.age_type && guest.age_type !== "adult" && (
                                <span className="truncate text-muted-foreground/60">
                                  {AGE_LABELS[guest.age_type]}
                                </span>
                              )}
                            </div>
                            {guest.notes && (
                              <p className="mt-0.5 truncate text-xs italic text-muted-foreground/50">
                                {guest.notes}
                              </p>
                            )}
                          </div>

                          {/* Heure et statut */}
                          <div className="flex shrink-0 flex-col items-end gap-0.5">
                            {guest.is_present && guest.checked_in_at && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-1 text-xs text-green-600"
                              >
                                <Check className="size-3" />
                                {new Date(
                                  guest.checked_in_at,
                                ).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </motion.span>
                            )}
                            {!guest.is_present && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
                                <Clock className="size-3" />
                                En attente
                              </span>
                            )}
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border-2 border-dashed border-border bg-white p-8 text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 3,
                        ease: "easeInOut",
                      }}
                    >
                      <PartyPopper className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                    </motion.div>
                    <p className="text-muted-foreground">
                      {search
                        ? "Aucun invité trouvé. Ajoutez-le comme invité imprévu."
                        : filterTable !== "all" || filterStatus !== "all"
                          ? "Aucun invité ne correspond à ces filtres."
                          : "Aucun invité à afficher."}
                    </p>
                    {search && (
                      <Button
                        size="sm"
                        className="mt-3 bg-gold text-white hover:bg-gold/90"
                        onClick={() => setWalkinModal(true)}
                      >
                        <UserPlus className="mr-1.5 size-4" />
                        Ajouter {search} comme invité imprévu
                      </Button>
                    )}
                    {(filterTable !== "all" || filterStatus !== "all") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => {
                          setFilterTable("all");
                          setFilterStatus("all");
                        }}
                      >
                        Réinitialiser les filtres
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Vue par groupes */}
            {viewMode === "groups" && (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4"
              >
                {groupedView.groups.length > 0 ? (
                  groupedView.groups.map((group, idx) => {
                    const allPresent = group.members.every((m) => m.is_present);
                    const groupPresent = group.members.filter(
                      (m) => m.is_present,
                    ).length;
                    return (
                      <motion.div
                        key={group.members[0]?.group_id ?? `g-${idx}`}
                        variants={itemVariants}
                        layout
                        className="rounded-xl border border-border bg-white shadow-sm"
                      >
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Users className="size-5 text-gold" />
                            <span className="font-medium">
                              {group.groupName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {groupPresent}/{group.members.length}
                            </span>
                          </div>
                          {!allPresent && (
                            <motion.div whileTap={{ scale: 0.95 }}>
                              <Button
                                size="sm"
                                className="bg-gold text-white hover:bg-gold/90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  checkinGroup(
                                    group.members[0]?.group_id ?? "",
                                  );
                                }}
                              >
                                <Check className="mr-1.5 size-4" />
                                Valider tout le groupe
                              </Button>
                            </motion.div>
                          )}
                          {allPresent && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center gap-1 text-sm text-green-600"
                            >
                              <Check className="size-4" />
                              <span className="hidden sm:inline">Présent</span>
                            </motion.span>
                          )}
                        </div>

                        <div className="divide-y divide-border">
                          {group.members.map((member) => (
                            <motion.div
                              key={member.id}
                              whileTap={{ scale: 0.99 }}
                            >
                              <button
                                onClick={() => togglePresence(member)}
                                className={cn(
                                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                  member.is_present
                                    ? "bg-green-50/50"
                                    : "hover:bg-muted/30",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                                    member.is_present
                                      ? "bg-green-500"
                                      : "bg-muted-foreground/30 text-white",
                                  )}
                                >
                                  {member.is_present ? (
                                    <Check className="size-4" />
                                  ) : (
                                    getInitials(
                                      member.first_name,
                                      member.last_name,
                                    )
                                  )}
                                </div>
                                <span className="flex-1 text-sm font-medium">
                                  {member.first_name} {member.last_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {member.table_name ?? "Non placé"}
                                </span>
                                {member.is_present && member.checked_in_at && (
                                  <span className="text-xs text-green-600">
                                    {new Date(
                                      member.checked_in_at,
                                    ).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border-2 border-dashed border-border bg-white p-8 text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{
                        repeat: Infinity,
                        duration: 3,
                        ease: "easeInOut",
                      }}
                    >
                      <Users className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                    </motion.div>
                    <p className="text-muted-foreground">
                      Aucun groupe constitué.
                    </p>
                  </motion.div>
                )}

                {/* Invités seuls */}
                {groupedView.solos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Invités sans groupe ({groupedView.solos.length})
                    </p>
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="space-y-2"
                    >
                      {groupedView.solos.map((guest) => (
                        <motion.div key={guest.id} variants={itemVariants}>
                          <button
                            onClick={() => togglePresence(guest)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                              guest.is_present
                                ? "border-green-200 bg-green-50"
                                : "border-border bg-white hover:border-gold/50",
                            )}
                          >
                            <div
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                                guest.is_present
                                  ? "bg-green-500"
                                  : "bg-muted-foreground/30",
                              )}
                              style={
                                !guest.is_present
                                  ? {
                                      backgroundColor: stringToColor(
                                        `${guest.first_name} ${guest.last_name}`,
                                      ),
                                    }
                                  : undefined
                              }
                            >
                              {guest.is_present ? (
                                <Check className="size-5" />
                              ) : (
                                getInitials(guest.first_name, guest.last_name)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {guest.first_name} {guest.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {guest.table_name ?? "Non placé"}
                              </p>
                            </div>
                            {guest.is_present && guest.checked_in_at && (
                              <span className="text-xs text-green-600">
                                {new Date(
                                  guest.checked_in_at,
                                ).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Panneau de stats (desktop) */}
          <aside className="hidden w-64 shrink-0 sm:block">
            <div className="sticky top-28 space-y-3">
              <StatPanel
                presentCount={presentCount}
                totalGuests={totalGuests}
                progressPercent={progressPercent}
                childrenCount={childrenCount}
                presentChildren={presentChildren}
                unassignedCount={unassignedCount}
                pendingActions={pendingActions.length}
              />
              {/* Liste des tables avec remplissage */}
              {tables.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-4">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Capacité des tables
                  </h3>
                  <div className="space-y-2">
                    {tables.map((table) => {
                      const occupied = (
                        Object.values(guestsMap) as Guest[]
                      ).filter((g) => g.table_id === table.id).length;
                      const fillPct =
                        table.capacity > 0
                          ? Math.round((occupied / table.capacity) * 100)
                          : 0;
                      return (
                        <div key={table.id} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{table.name}</span>
                            <span
                              className={cn(
                                "text-muted-foreground",
                                fillPct >= 100 && "text-red-500 font-semibold",
                              )}
                            >
                              {occupied}/{table.capacity}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${fillPct}%` }}
                              transition={{ duration: 0.4 }}
                              className={cn(
                                "h-full rounded-full transition-colors",
                                fillPct >= 100
                                  ? "bg-red-500"
                                  : fillPct >= 75
                                    ? "bg-gold"
                                    : "bg-green-500",
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* FAB pour walk-in (mobile) */}
      <div className="fixed bottom-6 right-6 z-50 sm:hidden">
        <motion.button
          onClick={() => setWalkinModal(true)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          animate={{
            boxShadow: [
              "0 4px 14px rgba(201, 169, 110, 0.3)",
              "0 4px 24px rgba(201, 169, 110, 0.5)",
              "0 4px 14px rgba(201, 169, 110, 0.3)",
            ],
          }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="relative flex size-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-gold/30"
          aria-label="Ajouter un invité imprévu (raccourci: N)"
        >
          <UserPlus className="size-7" />
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-deep-black text-[10px] font-bold text-white shadow-sm">
            N
          </span>
        </motion.button>
      </div>

      {/* ===== Modal Walk-in ===== */}
      <Dialog open={walkinModal} onOpenChange={setWalkinModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-gold" />
              Ajouter un invité imprévu
            </DialogTitle>
            <DialogDescription>
              L&rsquo;invité sera marqué présent immédiatement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wi-first">Prénom *</Label>
                <Input
                  id="wi-first"
                  value={wiFirstName}
                  onChange={(e) => setWiFirstName(e.target.value)}
                  placeholder="Prénom"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wi-last">Nom *</Label>
                <Input
                  id="wi-last"
                  value={wiLastName}
                  onChange={(e) => setWiLastName(e.target.value)}
                  placeholder="Nom"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-cat">Catégorie</Label>
              <Input
                id="wi-cat"
                value={wiCategory}
                onChange={(e) => setWiCategory(e.target.value)}
                className="focus-visible:ring-2 focus-visible:ring-gold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-age">Tranche d&rsquo;âge</Label>
              <select
                id="wi-age"
                value={wiAgeType}
                onChange={(e) =>
                  setWiAgeType(e.target.value as "adult" | "child" | "baby")
                }
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              >
                <option value="adult">Adulte</option>
                <option value="child">Enfant</option>
                <option value="baby">Bébé</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-table">Table attribuée</Label>
              <select
                id="wi-table"
                value={wiTableId}
                onChange={(e) => setWiTableId(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
              >
                <option value="none">Non placé</option>
                {tables
                  .filter((t) => !t.is_locked && getTableAvailable(t.id) > 0)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({getTableAvailable(t.id)}/{t.capacity})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-notes">Notes (allergies, etc.)</Label>
              <textarea
                id="wi-notes"
                rows={2}
                value={wiNotes}
                onChange={(e) => setWiNotes(e.target.value)}
                className="h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-gold md:text-sm"
                placeholder="Allergies, régime..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWalkinModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={addWalkin}
              disabled={wiSaving || !wiFirstName.trim() || !wiLastName.trim()}
              className="bg-gold text-white hover:bg-gold/90"
            >
              {wiSaving ? "Ajout..." : "Ajouter et marquer présent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Panneau de statistiques réutilisable
function StatPanel({
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
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Statistiques
      </h3>
      <div className="space-y-3">
        {/* Compteur principal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
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
                stroke="#e2e8f0"
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
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={{
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
