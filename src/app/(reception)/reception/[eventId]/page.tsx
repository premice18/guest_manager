"use client";

import { useEffect, useState, useCallback, useMemo, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import { useReceptionStore } from "@/lib/store/reception-store";
import { useRealtimeGuests } from "@/lib/hooks/use-realtime";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
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
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Keyboard,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Table = Database["public"]["Tables"]["tables"]["Row"];

const AGE_LABELS: Record<string, string> = {
  adult: "Adulte",
  child: "Enfant",
  baby: "Bébé",
};
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const walkinSchema = z.object({
  first_name: z.string().min(1, "Prénom requis").trim(),
  last_name: z.string().min(1, "Nom requis").trim(),
  category: z.string(),
  age_type: z.enum(["adult", "child", "baby"]),
  table_id: z.string(),
  notes: z.string().trim().optional(),
});

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
  const prefersReducedMotion = useReducedMotion();
  const { eventId } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [eventName, setEventName] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  const eventState = useReceptionStore((s) => s.events[eventId]);
  const setGuests = useReceptionStore((s) => s.setGuests);
  const updateGuest = useReceptionStore((s) => s.updateGuest);
  const isOnline = useReceptionStore((s) => s.isOnline);
  const pendingActions = useReceptionStore((s) => s.pendingActions);
  const addPendingAction = useReceptionStore((s) => s.addPendingAction);
  const removePendingAction = useReceptionStore((s) => s.removePendingAction);
  const guestsMap = useMemo(() => eventState?.guests ?? {}, [eventState]);
  const totalGuests = eventState?.totalGuests ?? 0;
  const presentCount = eventState?.presentCount ?? 0;

  const [search, setSearch] = useState("");
  const [filterLetter, setFilterLetter] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "groups">("list");
  const [statsOpen, setStatsOpen] = useState(false);

  const [walkinModal, setWalkinModal] = useState(false);
  const [wiSaving, setWiSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetWalkinForm,
    formState: { errors: wiErrors },
  } = useForm<z.infer<typeof walkinSchema>>({
    resolver: zodResolver(walkinSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      category: "Invité imprévu",
      age_type: "adult",
      table_id: "none",
      notes: "",
    },
  });

  const progressPercent =
    totalGuests > 0 ? Math.round((presentCount / totalGuests) * 100) : 0;

  const enrichGuests = useCallback(
    async (guestData: unknown) => {
      const raw = guestData as Array<Guest & { tables?: { name: string } | null }>;
      const enriched = raw.map(
        ({ tables, ...g }) => ({ ...g, table_name: tables?.name ?? null }) as Guest,
      );
      setGuests(eventId, enriched);
    },
    [eventId, setGuests],
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
    let cancelled = false;
    (async () => {
      // Garde d'accès : redirige si non connecté ou sans accès à l'événement
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: ev } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .single();
      if (cancelled) return;
      if (!ev) {
        router.push("/dashboard");
        return;
      }

      await refreshGuests();
      if (cancelled) return;

      const { data: evn } = await supabase
        .from("events")
        .select("name")
        .eq("id", eventId)
        .single();
      if (!cancelled && evn) setEventName(evn.name);

      const { data: tbls } = await supabase
        .from("tables")
        .select("*")
        .eq("event_id", eventId)
        .order("name");
      if (!cancelled) setTables(tbls ?? []);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, supabase, router, refreshGuests]);

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

    updateGuest(eventId, guest.id, {
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
        updateGuest(eventId, guest.id, {
          is_present: guest.is_present,
          checked_in_at: guest.checked_in_at,
        });
        toast.error(error.message);
      }
    } catch {
      updateGuest(eventId, guest.id, {
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

    // Sauvegarde l'état précédent pour pouvoir annuler en cas d'erreur
    const previous = members.map((m) => ({
      id: m.id,
      is_present: m.is_present,
      checked_in_at: m.checked_in_at,
    }));

    for (const m of members) {
      updateGuest(eventId, m.id, { is_present: true, checked_in_at: timestamp });
    }

    // Annule la mise à jour optimiste (rollback) en cas d'échec
    const rollback = () => {
      for (const p of previous) {
        updateGuest(eventId, p.id, {
          is_present: p.is_present,
          checked_in_at: p.checked_in_at,
        });
      }
    };

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
        .eq("group_id", groupId)
        .eq("event_id", eventId);

      if (error) {
        rollback();
        toast.error(error.message);
      }
    } catch {
      rollback();
      toast.error("Erreur lors du check-in groupé");
    }
  };

  const addWalkin = handleSubmit(async (formData) => {
    setWiSaving(true);
    try {
      const walkinPayload = {
        event_id: eventId,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        category: formData.category
          ? formData.category.trim()
          : "Invité imprévu",
        age_type: formData.age_type,
        table_id: formData.table_id === "none" ? null : formData.table_id,
        notes: formData.notes?.trim() || null,
        is_present: true,
        checked_in_at: new Date().toISOString(),
      };

      // Mode hors-ligne : on met en file d'attente l'insertion du walk-in
      if (!isOnline) {
        const actionId = nanoid();
        addPendingAction({
          id: actionId,
          guestId: actionId,
          type: "checkin",
          timestamp: walkinPayload.checked_in_at!,
          walkin: {
            first_name: walkinPayload.first_name,
            last_name: walkinPayload.last_name,
            category: walkinPayload.category,
            age_type: walkinPayload.age_type,
            table_id: walkinPayload.table_id,
            notes: walkinPayload.notes,
          },
        });
        toast.success(
          `${walkinPayload.first_name} ${walkinPayload.last_name} ajouté hors-ligne (synchronisation à la reconnexion)`,
        );
        setWalkinModal(false);
        resetWalkinForm();
        return;
      }

      const { data, error } = await supabase
        .from("guests")
        .insert(walkinPayload)
        .select("*, tables(name)")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      const insertedGuest = data as unknown as {
        first_name: string;
        last_name: string;
        tables?: { name: string } | null;
      };
      const tableName = insertedGuest.tables?.name ?? "non placé";
      toast.success(`${insertedGuest.first_name} ${insertedGuest.last_name} → ${tableName}`);
      setWalkinModal(false);
      resetWalkinForm();

      await refreshGuests();
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setWiSaving(false);
    }
  });

  const syncPendingActions = useCallback(async () => {
    if (pendingActions.length === 0) return;
    const actions = [...pendingActions];
    let synced = 0;

for (const action of actions) {
      try {
        // Walk-in créé hors-ligne : on insère l'invité
        if (action.walkin) {
          const { error } = await supabase.from("guests").insert({
            event_id: eventId,
            ...action.walkin,
            is_present: true,
            checked_in_at: action.timestamp,
          });
          if (!error) {
            removePendingAction(action.guestId);
            synced++;
          }
          continue;
        }

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
  }, [pendingActions, supabase, removePendingAction, eventId]);

  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncPendingActions();
    }
  }, [isOnline, pendingActions.length, syncPendingActions]);

// Suivi de la connectivité : s'appuie sur navigator.onLine (source fiable)
  // plutôt que sur le seul statut du canal Realtime
  useEffect(() => {
    const setOnline = useReceptionStore.getState().setOnline;

    // Valeur initiale depuis navigator.onLine
    setOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => {
      setOnline(true);
      // Au retour du réseau : resynchronise les actions en attente
      // ET recharge les invités (reprend un fetch initial qui aurait échoué)
      syncPendingActions();
      refreshGuests();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPendingActions, refreshGuests]);

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

  // Places disponibles par table, calculé en UNE passe sur les invités (évite
  // le O(tables × guests) à chaque rendu).
  const tablesAvailable = useMemo(() => {
    const byTable: Record<string, number> = {};
    for (const g of Object.values(guestsMap) as Guest[]) {
      if (g.table_id) byTable[g.table_id] = (byTable[g.table_id] ?? 0) + 1;
    }
    const result: Record<string, number> = {};
    for (const t of tables) {
      result[t.id] = t.capacity - (byTable[t.id] ?? 0);
    }
    return result;
  }, [guestsMap, tables]);

  const getTableAvailable = (tableId: string) => tablesAvailable[tableId] ?? 0;

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
          animate={prefersReducedMotion ? {} : { rotate: 360 }}
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
        initial={prefersReducedMotion ? false : { y: -60, opacity: 0 }}
        animate={prefersReducedMotion ? {} : { y: 0, opacity: 1 }}
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
                    animate={prefersReducedMotion ? {} : { scale: [1, 1.3, 1] }}
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
                      initial={prefersReducedMotion ? false : { scale: 0 }}
                      animate={prefersReducedMotion ? {} : { scale: 1 }}
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
                initial={prefersReducedMotion ? false : { scale: 1.3, opacity: 0 }}
                animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
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
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
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
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
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
                whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                onClick={() => setFilterLetter("")}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium transition-colors",
                  !filterLetter
                    ? "bg-gold text-deep-black"
                    : "bg-white text-muted-foreground hover:bg-muted",
                )}
                aria-label="Toutes les lettres"
              >
                Tous
              </motion.button>
              {LETTERS.map((letter) => (
                <motion.button
                  key={letter}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                  onClick={() =>
                    setFilterLetter(letter === filterLetter ? "" : letter)
                  }
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium transition-colors",
                    filterLetter === letter
                      ? "bg-gold text-deep-black"
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
            <Select
              value={filterTable}
              onValueChange={setFilterTable}
              className="w-auto bg-white"
              aria-label="Filtrer par table"
            >
              <SelectItem value="all">Toutes les tables</SelectItem>
              <SelectItem value="none">Non placés</SelectItem>
              {tables.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </Select>

            <Select
              value={filterStatus}
              onValueChange={setFilterStatus}
              className="w-auto bg-white"
              aria-label="Filtrer par statut"
            >
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="present">Présents</SelectItem>
              <SelectItem value="absent">Absents</SelectItem>
            </Select>

            <motion.div
              whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
              className="inline-flex overflow-hidden rounded-lg border border-input bg-white"
            >
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-gold text-deep-black"
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
                    ? "bg-gold text-deep-black"
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
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={prefersReducedMotion ? {} : { height: "auto", opacity: 1 }}
              exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
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
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={prefersReducedMotion ? {} : { height: "auto", opacity: 1 }}
              exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
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
                    initial={prefersReducedMotion ? false : "hidden"}
                    animate={prefersReducedMotion ? {} : "visible"}
                    className="space-y-2"
                  >
                    {filteredGuests.map((guest) => (
                      <motion.div
                        key={guest.id}
                        variants={itemVariants}
                        layout
                        exit={prefersReducedMotion ? {} : "exit"}
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
                                initial={prefersReducedMotion ? false : { opacity: 0 }}
                                animate={prefersReducedMotion ? {} : { opacity: 1 }}
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
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                    className="rounded-xl border-2 border-dashed border-border bg-white p-8 text-center"
                  >
                    <motion.div
                      animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
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
                        className="mt-3 bg-gold text-deep-black hover:bg-gold/90"
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
                initial={prefersReducedMotion ? false : "hidden"}
                animate={prefersReducedMotion ? {} : "visible"}
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
                            <motion.div whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}>
                              <Button
                                size="sm"
                                className="bg-gold text-deep-black hover:bg-gold/90"
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
                              initial={prefersReducedMotion ? false : { scale: 0 }}
                              animate={prefersReducedMotion ? {} : { scale: 1 }}
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
                              whileTap={prefersReducedMotion ? {} : { scale: 0.99 }}
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
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                    className="rounded-xl border-2 border-dashed border-border bg-white p-8 text-center"
                  >
                    <motion.div
                      animate={prefersReducedMotion ? {} : { y: [0, -4, 0] }}
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
                      initial={prefersReducedMotion ? false : "hidden"}
                      animate={prefersReducedMotion ? {} : "visible"}
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
                              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
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
          whileHover={prefersReducedMotion ? {} : { scale: 1.08 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.92 }}
          animate={prefersReducedMotion ? {} : {
            boxShadow: [
              "0 4px 14px rgba(201, 169, 110, 0.3)",
              "0 4px 24px rgba(201, 169, 110, 0.5)",
              "0 4px 14px rgba(201, 169, 110, 0.3)",
            ],
          }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="relative flex size-14 items-center justify-center rounded-full bg-gold text-deep-black shadow-lg shadow-gold/30"
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

          <form onSubmit={addWalkin} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wi-first">Prénom *</Label>
                <Input
                  id="wi-first"
                  {...register("first_name")}
                  placeholder="Prénom"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                  aria-invalid={!!wiErrors.first_name}
                />
                {wiErrors.first_name && (
                  <p className="text-xs text-destructive">{wiErrors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wi-last">Nom *</Label>
                <Input
                  id="wi-last"
                  {...register("last_name")}
                  placeholder="Nom"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                  aria-invalid={!!wiErrors.last_name}
                />
                {wiErrors.last_name && (
                  <p className="text-xs text-destructive">{wiErrors.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-cat">Catégorie</Label>
              <Input
                id="wi-cat"
                {...register("category")}
                className="focus-visible:ring-2 focus-visible:ring-gold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-age">Tranche d&rsquo;âge</Label>
              <Select
                id="wi-age"
                {...register("age_type")}
              >
                <SelectItem value="adult">Adulte</SelectItem>
                <SelectItem value="child">Enfant</SelectItem>
                <SelectItem value="baby">Bébé</SelectItem>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-table">Table attribuée</Label>
              <Select
                id="wi-table"
                {...register("table_id")}
              >
                <SelectItem value="none">Non placé</SelectItem>
                {tables
                  .filter((t) => !t.is_locked && getTableAvailable(t.id) > 0)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({getTableAvailable(t.id)}/{t.capacity})
                    </SelectItem>
                  ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wi-notes">Notes (allergies, etc.)</Label>
              <Textarea
                id="wi-notes"
                rows={2}
                {...register("notes")}
                placeholder="Allergies, régime..."
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setWalkinModal(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={wiSaving}
                className="bg-gold text-deep-black hover:bg-gold/90"
              >
                {wiSaving ? "Ajout..." : "Ajouter et marquer présent"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Panneau de statistiques réutilisable
import { StatPanel } from "@/components/reception/stat-panel";

