"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ArrowLeft,
  Users,
  Table as TableIcon,
  Lock,
  GripVertical,
  Search,
  CircleUser,
  Baby,
  AlertTriangle,
  ArrowRightFromLine,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Table = Database["public"]["Tables"]["tables"]["Row"];

const panelVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1, x: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
};

// === Composant : Invité draggable (utilisé dans la liste non placés ET dans les tables) ===
function DraggableGuest({ guest, compact }: { guest: Guest; compact?: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `guest-${guest.id}`,
    data: { guest },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  return (
    <motion.div
      whileHover={prefersReducedMotion ? {} : { scale: 1.02, borderColor: "rgba(201, 169, 110, 0.5)" }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        "flex cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm transition-shadow active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg ring-2 ring-gold",
        compact && "px-2 py-1.5 text-xs"
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
      {guest.age_type === "baby" ? (
        <Baby className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <CircleUser className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate font-medium">{guest.first_name} {guest.last_name}</span>
      {guest.group_name && (
        <span className="shrink-0 rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold">
          {guest.group_name}
        </span>
      )}
    </motion.div>
  );
}

// === Composant : Zone de dépôt pour les non-placés (retrait d'une table) ===
function UnplacedDroppable() {
  const { setNodeRef, isOver } = useDroppable({ id: "unplaced-zone" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors",
        isOver
          ? "border-gold bg-gold/5 text-gold"
          : "border-muted-foreground/20 text-muted-foreground hover:border-gold/30"
      )}
    >
      <UserX className="mx-auto mb-1 size-5" />
      Déposez ici pour retirer de la table
    </div>
  );
}

// === Composant : Table droppable avec invités draggables ===
function DroppableTable({
  table,
  guests,
  guestCount,
  capacity,
  isLocked,
}: {
  table: Table;
  guests: Guest[];
  guestCount: number;
  capacity: number;
  isLocked: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const { setNodeRef, isOver } = useDroppable({
    id: `table-${table.id}`,
    data: { table },
    disabled: isLocked,
  });

  const fillRatio = capacity > 0 ? guestCount / capacity : 0;
  const fillPercent = Math.min(100, Math.round(fillRatio * 100));
  const isFull = guestCount >= capacity;

  return (
    <motion.div
      whileHover={!isLocked && !prefersReducedMotion ? { scale: 1.015, borderColor: "#C9A96E" } : undefined}
      ref={setNodeRef}
      className={cn(
        "rounded-xl border-2 p-3 transition-all duration-200",
        isLocked
          ? "border-muted bg-muted/30 opacity-60"
          : isOver && !isFull
            ? "border-gold bg-gold/5 shadow-md shadow-gold/10"
            : isOver && isFull
              ? "border-red-300 bg-red-50"
              : "border-border bg-card hover:border-gold/50 hover:shadow-sm"
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {isLocked && <Lock className="size-3.5 text-muted-foreground" />}
          {table.name}
        </span>
        <span className={cn("text-xs tabular-nums", isFull ? "font-semibold text-red-500" : "text-muted-foreground")}>
          {guestCount}/{capacity}
        </span>
      </div>

      {/* Jauge de remplissage animée */}
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPercent}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut", type: "spring" as const, stiffness: 100 }}
          className={cn(
            "h-full rounded-full",
            isFull ? "bg-red-500" : fillRatio >= 0.75 ? "bg-gold" : "bg-green-500"
          )}
        />
      </div>

      {/* Invités placés (maintenant draggables) */}
      <div className="space-y-1.5">
        {guests.map((guest) => (
          <DraggableGuest key={guest.id} guest={guest} compact />
        ))}
        {guests.length === 0 && (
          <p className="py-2 text-center text-[11px] text-muted-foreground">
            {isLocked ? "Verrouillée" : "Déposez ici"}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// === Page de placement ===
export default function PlacementPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [eventId, setEventId] = useState("");
  const [supabase] = useState(() => createClient());

  // Tous les invités (placés + non placés) pour permettre les transferts
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<(Table & { guest_count: number; placed_guests: Guest[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // État du drag
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);

  // Capteurs de drag&drop : souris/tactile ET clavier (accessibilité —
  // fix audit : le drag était inutilisable au clavier, en lecture d'écran).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Modal de confirmation pour le déplacement entre tables
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ guest: Guest; sourceTableId: string; targetTableId: string } | null>(null);
  const [isGroupMove, setIsGroupMove] = useState(false);

  // Modal d'alerte groupe (membres sur des tables différentes)
  const [groupAlertOpen, setGroupAlertOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ guest: Guest; tableId: string } | null>(null);

// Charge les données initiales
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await params.then((p) => p.eventId);
      if (cancelled) return;
      setEventId(id);

      const { data: tbls } = await supabase
        .from("tables")
        .select("*")
        .eq("event_id", id)
        .order("sort_order");
      const rawTables = (tbls ?? []) as Table[];

      const { data: gsts } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", id)
        .order("last_name");
      const rawGuests = (gsts ?? []) as Guest[];

      if (!cancelled) {
        // Stocke TOUS les invités pour pouvoir gérer les transferts
        setAllGuests(rawGuests);

        setTables(
          rawTables.map((t) => ({
            ...t,
            guest_count: rawGuests.filter((g) => g.table_id === t.id).length,
            placed_guests: rawGuests.filter((g) => g.table_id === t.id),
          }))
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, supabase]);

  const refreshData = async () => {
    if (!eventId) return;
    const [{ data: tbls }, { data: gsts }] = await Promise.all([
      supabase.from("tables").select("*").eq("event_id", eventId).order("sort_order"),
      supabase.from("guests").select("*").eq("event_id", eventId).order("last_name"),
    ]);
    const rawTables = (tbls ?? []) as Table[];
    const rawGuests = (gsts ?? []) as Guest[];
    setAllGuests(rawGuests);
    setTables(
      rawTables.map((t) => ({
        ...t,
        guest_count: rawGuests.filter((g) => g.table_id === t.id).length,
        placed_guests: rawGuests.filter((g) => g.table_id === t.id),
      }))
    );
  };

  // Exécute le déplacement avec mise à jour optimiste
  const executeDrop = async (guestId: string, tableId: string | null) => {
    // Mise à jour optimiste locale
    const prevGuests = [...allGuests];
    setAllGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, table_id: tableId } : g))
    );
    setTables((prev) => {
      const moved = prevGuests.find((g) => g.id === guestId);
      return prev.map((t) => {
        const inTable = t.placed_guests.some((g) => g.id === guestId);
        if (inTable && tableId === null) {
          // Retrait de la table
          return {
            ...t,
            guest_count: t.guest_count - 1,
            placed_guests: t.placed_guests.filter((g) => g.id !== guestId),
          };
        }
        if (inTable && tableId && t.id !== tableId) {
          // Déplacement vers une autre table
          return {
            ...t,
            guest_count: t.guest_count - 1,
            placed_guests: t.placed_guests.filter((g) => g.id !== guestId),
          };
        }
        if (!inTable && tableId && t.id === tableId && moved) {
          // Ajout depuis le panier non placés
          return {
            ...t,
            guest_count: t.guest_count + 1,
            placed_guests: [...t.placed_guests, { ...moved, table_id: tableId }],
          };
        }
        return t;
      });
    });

    try {
      const { error } = await supabase
        .from("guests")
        .update({ table_id: tableId })
        .eq("id", guestId)
        .eq("event_id", eventId);
      if (error) {
        // Rollback en cas d'erreur
        setAllGuests(prevGuests);
        refreshData();
        toast.error(error.message);
        return;
      }
      // Réconcilie avec le serveur après succès pour refléter les changements
      // faits par d'autres clients (l'optimistic seul peut devenir obsolète).
      refreshData();
    } catch {
      // Rollback réseau
      setAllGuests(prevGuests);
      refreshData();
      toast.error("Erreur lors du placement");
    }
  };

  // Déplace tout un groupe avec mise à jour optimiste
  const executeGroupDrop = async (groupId: string, tableId: string | null) => {
    const prevGuests = [...allGuests];
    const groupMembers = allGuests.filter((g) => g.group_id === groupId);

    // Un groupe ne peut pas quitter une table verrouillée
    if (tableId) {
      const sourceTableIds = new Set(
        groupMembers.map((m) => m.table_id).filter((id): id is string => Boolean(id))
      );
      for (const sid of sourceTableIds) {
        const sourceTable = tables.find((t) => t.id === sid);
        if (sourceTable?.is_locked && sid !== tableId) {
          toast.error(`🔒 La table "${sourceTable.name}" est verrouillée, le groupe ne peut pas être déplacé.`);
          setAllGuests(prevGuests);
          return;
        }
      }
    }

    // Vérifie la capacité cible : le groupe entier doit tenir sur la table
    const targetTable = tableId ? tables.find((t) => t.id === tableId) : null;
    if (targetTable) {
      const groupSize = groupMembers.length;
      const freeSeats = targetTable.capacity - targetTable.guest_count;
      if (groupSize > freeSeats) {
        toast.error(
          `⚠️ La table "${targetTable.name}" n'a que ${freeSeats} place(s) libre(s) pour un groupe de ${groupSize}.`
        );
        setAllGuests(prevGuests);
        return;
      }
    }

    // Met à jour l'état local pour tous les membres du groupe
    setAllGuests((prev) =>
      prev.map((g) =>
        g.group_id === groupId ? { ...g, table_id: tableId } : g
      )
    );
    setTables((prev) => {
      const memberIds = new Set(groupMembers.map((m) => m.id));
      return prev.map((t) => {
        const membersInThisTable = t.placed_guests.filter((g) => memberIds.has(g.id));
        if (membersInThisTable.length > 0 && tableId !== t.id) {
          return {
            ...t,
            guest_count: t.guest_count - membersInThisTable.length,
            placed_guests: t.placed_guests.filter((g) => !memberIds.has(g.id)),
          };
        }
        if (tableId === t.id) {
          const existingIds = new Set(t.placed_guests.map((g) => g.id));
          const newMembers = groupMembers
            .filter((g) => !existingIds.has(g.id))
            .map((g) => ({ ...g, table_id: tableId }));
          if (newMembers.length > 0) {
            return {
              ...t,
              guest_count: t.guest_count + newMembers.length,
              placed_guests: [...t.placed_guests, ...newMembers],
            };
          }
        }
        return t;
      });
    });

    try {
      const { error } = await supabase
        .from("guests")
        .update({ table_id: tableId })
        .eq("group_id", groupId)
        .eq("event_id", eventId);
      if (error) {
        setAllGuests(prevGuests);
        refreshData();
        toast.error(error.message);
        return;
      }
      // Réconcilie avec le serveur après succès (autres clients, verrous).
      refreshData();
    } catch {
      setAllGuests(prevGuests);
      refreshData();
      toast.error("Erreur lors du déplacement du groupe");
    }
  };

  // Gère la fin du drag
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGuest(null);
    const { active, over } = event;
    if (!over) return;

    const guest = active.data.current?.guest as Guest | undefined;
    if (!guest) return;

    const dropId = over.id.toString();

    // Cas 1 : dépôt sur la zone "non placés" → retrait de la table
    if (dropId === "unplaced-zone") {
      if (!guest.table_id) return; // Déjà non placé
      const sourceLocked = tables.find((t) => t.id === guest.table_id)?.is_locked;
      if (sourceLocked) {
        toast.error("🔒 Cet invité est sur une table verrouillée, il ne peut pas être retiré.");
        return;
      }
      toast.success(`${guest.first_name} ${guest.last_name} retiré de la table`);
      executeDrop(guest.id, null);
      return;
    }

    // Cas 2 : dépôt sur une table
    const tableId = dropId.replace("table-", "");
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    // Vérifications préalables
    if (table.is_locked) {
      toast.error(`🔒 La table "${table.name}" est verrouillée.`);
      return;
    }
    if (table.guest_count >= table.capacity) {
      toast.error(`⚠️ La table "${table.name}" est complète (${table.capacity} places).`);
      return;
    }

    const sourceTableId = guest.table_id;

    // Un invité placé sur une table verrouillée ne peut pas en sortir
    const sourceTable = sourceTableId
      ? tables.find((t) => t.id === sourceTableId)
      : null;
    if (sourceTable?.is_locked && tableId !== sourceTableId) {
      toast.error(`🔒 La table "${sourceTable.name}" est verrouillée, cet invité ne peut pas être déplacé.`);
      return;
    }

    // Cas 3 : invité non placé → placement direct (pas de confirmation)
    if (!sourceTableId) {
      // Vérifie les contraintes de groupe
      const otherGroupMembers = allGuests.filter(
        (g) => g.group_id && g.group_id === guest.group_id && g.id !== guest.id && g.table_id !== tableId
      );
      if (guest.group_id && otherGroupMembers.some((m) => m.table_id)) {
        // Des membres du groupe sont déjà sur d'autres tables
        setPendingDrop({ guest, tableId });
        setGroupAlertOpen(true);
        return;
      }
      executeDrop(guest.id, tableId);
      return;
    }

    // Cas 4 : invité déjà placé sur une table → besoin de confirmation
    if (sourceTableId === tableId) return; // Même table → ignoré

    // Vérifie si l'invité fait partie d'un groupe
    const otherGroupMembers = allGuests.filter(
      (g) => g.group_id && g.group_id === guest.group_id && g.id !== guest.id
    );
    const isInGroup = guest.group_id && otherGroupMembers.length > 0;

    if (isInGroup) {
      // Vérifie si les autres membres sont sur la source ou ailleurs
      const membersOnSource = otherGroupMembers.filter((m) => m.table_id === sourceTableId);
      const membersElsewhere = otherGroupMembers.filter(
        (m) => m.table_id && m.table_id !== sourceTableId
      );

      if (membersOnSource.length > 0) {
        // Tout le groupe est (presque) sur la même table source
        // On propose de déplacer tout le groupe
        setPendingMove({
          guest,
          sourceTableId,
          targetTableId: tableId,
        });
        setIsGroupMove(true);
        setMoveConfirmOpen(true);
        return;
      }

      if (membersElsewhere.length > 0) {
        // Le groupe est déjà éparpillé → on propose quand même
        setPendingMove({
          guest,
          sourceTableId,
          targetTableId: tableId,
        });
        setIsGroupMove(true);
        setMoveConfirmOpen(true);
        return;
      }
    }

    // Pas de groupe → confirmation simple
    setPendingMove({
      guest,
      sourceTableId,
      targetTableId: tableId,
    });
    setIsGroupMove(false);
    setMoveConfirmOpen(true);
  };

  // Confirme le déplacement simple
  const confirmMove = async () => {
    if (!pendingMove) return;
    const { guest, targetTableId } = pendingMove;
    const targetTable = tables.find((t) => t.id === targetTableId);
    const targetName = targetTable?.name ?? " nouvelle table";

    executeDrop(guest.id, targetTableId);
    toast.success(`${guest.first_name} ${guest.last_name} déplacé vers "${targetName}"`);
    setMoveConfirmOpen(false);
    setPendingMove(null);
  };

  // Confirme le déplacement de tout le groupe
  const confirmGroupMove = async () => {
    if (!pendingMove) return;
    const { guest, targetTableId } = pendingMove;
    const targetTable = tables.find((t) => t.id === targetTableId);
    const targetName = targetTable?.name ?? " nouvelle table";

    if (!guest.group_id) return;
    await executeGroupDrop(guest.group_id, targetTableId);
    toast.success(`Groupe "${guest.group_name}" déplacé vers "${targetName}"`);
    setMoveConfirmOpen(false);
    setPendingMove(null);
  };

  // Confirme le déplacement d'un seul membre du groupe (avec séparation)
  const confirmMoveSolo = async () => {
    if (!pendingMove) return;
    const { guest, targetTableId } = pendingMove;
    const targetTable = tables.find((t) => t.id === targetTableId);
    const targetName = targetTable?.name ?? " nouvelle table";

    executeDrop(guest.id, targetTableId);
    toast.warning(`${guest.first_name} ${guest.last_name} déplacé seul vers "${targetName}" (séparé du groupe)`);
    setMoveConfirmOpen(false);
    setPendingMove(null);
  };

  // Annule le déplacement
  const cancelMove = () => {
    setMoveConfirmOpen(false);
    setPendingMove(null);
    setIsGroupMove(false);
  };

  // Groupe alerte (déplacement depuis la liste non placés)
  const confirmGroupDrop = async () => {
    if (!pendingDrop) return;
    const { guest, tableId } = pendingDrop;
    if (!guest.group_id) return;
    await executeGroupDrop(guest.group_id, tableId);
    toast.success(`Groupe "${guest.group_name}" placé sur la table`);
    setGroupAlertOpen(false);
    setPendingDrop(null);
  };

  const cancelGroupDrop = () => {
    setGroupAlertOpen(false);
    setPendingDrop(null);
  };

  // Filtre les invités non placés
  const unplacedGuests = useMemo(
    () => allGuests.filter((g) => !g.table_id).filter((g) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return `${g.first_name} ${g.last_name} ${g.group_name ?? ""}`.toLowerCase().includes(q);
    }),
    [allGuests, search]
  );

  if (loading) return <p className="p-8 text-center">Chargement...</p>;

  // Regroupe les invités non placés par groupe
  const groupedGuests: { groupId: string; groupName: string; members: Guest[] }[] = [];
  const soloGuests: Guest[] = [];

  for (const g of unplacedGuests) {
    if (g.group_id) {
      let grp = groupedGuests.find((gr) => gr.groupId === g.group_id);
      if (!grp) {
        grp = { groupId: g.group_id, groupName: g.group_name ?? "Groupe", members: [] };
        groupedGuests.push(grp);
      }
      grp.members.push(g);
    } else {
      soloGuests.push(g);
    }
  }

  // Nombre d'invités placés
  const placedCount = allGuests.length - unplacedGuests.length;

  return (
    <main className="relative mx-auto px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(201,169,110,0.04)_0%,transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(45,45,45,0.03)_0%,transparent_60%)]" />

      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/event/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4" />
          Retour
        </Link>
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">
          Plan de salle
        </h1>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event: DragStartEvent) => {
          const guest = event.active.data.current?.guest as Guest;
          setActiveGuest(guest ?? null);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Colonne gauche : invités non placés */}
          <motion.div
            variants={panelVariants}
            initial={prefersReducedMotion ? false : "hidden"}
            animate={prefersReducedMotion ? {} : "visible"}
            className="w-full shrink-0 lg:w-80"
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4 text-gold" />
                  Invités
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {unplacedGuests.length} non placé{unplacedGuests.length !== 1 ? "s" : ""}
                    {" · "}{placedCount} placé{placedCount !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-gold"
                  />
                </div>

                {/* Zone de dépôt pour retrait d'une table */}
                <UnplacedDroppable />

                {/* Groupes non placés */}
                {groupedGuests.map((group) => (
                  <motion.div
                    key={group.groupId}
                    variants={staggerContainer}
                    initial={prefersReducedMotion ? false : "hidden"}
                    animate={prefersReducedMotion ? {} : "visible"}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1.5 border-b border-gold/20 pb-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                        <Users className="size-3" />
                        {group.groupName}
                      </p>
                      <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                        {group.members.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {group.members.map((g) => (
                        <motion.div key={g.id} variants={staggerItem}>
                          <DraggableGuest guest={g} compact />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}

                {/* Invités seuls non placés */}
                {soloGuests.map((g) => (
                  <motion.div
                    key={g.id}
                    variants={staggerItem}
                    initial={prefersReducedMotion ? false : "hidden"}
                    animate={prefersReducedMotion ? {} : "visible"}
                  >
                    <DraggableGuest guest={g} />
                  </motion.div>
                ))}

                {unplacedGuests.length === 0 && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="py-4 text-center"
                  >
                    <motion.div
                      animate={prefersReducedMotion ? {} : { y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    >
                      <Users className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                    </motion.div>
                    <p className="text-sm text-muted-foreground">
                      Tous les invités sont placés.
                    </p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Colonne droite : grille des tables */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={{ type: "spring" as const, stiffness: 200, damping: 24, delay: 0.1 }}
            className="flex-1"
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tables.map((table) => (
                <DroppableTable
                  key={table.id}
                  table={table}
                  guests={table.placed_guests}
                  guestCount={table.guest_count}
                  capacity={table.capacity}
                  isLocked={table.is_locked}
                />
              ))}
            </div>

            {tables.length === 0 && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
                className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center"
              >
                <motion.div
                  animate={prefersReducedMotion ? {} : { y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                >
                  <TableIcon className="mx-auto mb-4 size-12 text-muted-foreground/40" />
                </motion.div>
                <p className="text-muted-foreground">
                  Aucune table configurée.{" "}
                  <Link
                    href={`/event/${eventId}/tables`}
                    className="text-gold underline"
                  >
                    Créez des tables
                  </Link>{" "}
                  pour commencer le placement.
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Drag overlay : visuel de l'élément pendant le drag */}
        <DragOverlay>
          <AnimatePresence>
            {activeGuest && (
              <motion.div
                initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0, rotate: -2 }}
                animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1, rotate: 0 }}
                exit={prefersReducedMotion ? {} : { scale: 0.9, opacity: 0 }}
                transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
                className="flex items-center gap-2 rounded-xl border-2 border-gold bg-card px-4 py-3 shadow-xl shadow-gold/20"
              >
                <GripVertical className="size-4 text-gold" />
                <span className="font-semibold text-foreground">
                  {activeGuest.first_name} {activeGuest.last_name}
                </span>
                {activeGuest.group_name && (
                  <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs font-medium text-gold">
                    {activeGuest.group_name}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </DragOverlay>
      </DndContext>

      {/* Modal de confirmation pour le déplacement entre tables */}
      <Dialog open={moveConfirmOpen} onOpenChange={setMoveConfirmOpen}>
        <DialogContent>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="size-5 text-gold" />
                Confirmer le déplacement
              </DialogTitle>
              <DialogDescription className="pt-2">
                {pendingMove && (() => {
                  const { guest, sourceTableId, targetTableId } = pendingMove;
                  const sourceTable = tables.find((t) => t.id === sourceTableId);
                  const targetTable = tables.find((t) => t.id === targetTableId);
                  const sourceName = sourceTable?.name ?? "Table inconnue";
                  const targetName = targetTable?.name ?? "nouvelle table";

                  return (
                    <div className="space-y-3">
                      <p>
                        <strong>{guest.first_name} {guest.last_name}</strong> est actuellement sur la table{" "}
                        <strong className="text-gold">&ldquo;{sourceName}&rdquo;</strong>.
                      </p>
                      <p className="flex items-center gap-2 text-sm">
                        <ArrowRightFromLine className="size-4 text-gold" />
                        Voulez-vous le déplacer vers la table{" "}
                        <strong className="text-gold">&ldquo;{targetName}&rdquo;</strong> ?
                      </p>
                      {isGroupMove && guest.group_name && (
                        <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-sm">
                          <p className="flex items-center gap-1.5 font-medium text-gold">
                            <Users className="size-4" />
                            {guest.group_name}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Ce membre appartient à un groupe. Vous pouvez déplacer tout le groupe ou uniquement cet invité.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-col">
              {isGroupMove ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                  <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                    <Button variant="outline" onClick={cancelMove} className="w-full sm:w-auto">
                      Annuler
                    </Button>
                  </motion.div>
                  <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                    <Button
                      variant="outline"
                      onClick={confirmMoveSolo}
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 sm:w-auto"
                    >
                      Déplacer seul
                    </Button>
                  </motion.div>
                  <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                    <Button
                      onClick={confirmGroupMove}
                      className="w-full bg-gold text-deep-black hover:bg-gold/90 sm:w-auto"
                    >
                      Déplacer tout le groupe
                    </Button>
                  </motion.div>
                </div>
              ) : (
                <div className="flex w-full gap-2 sm:justify-end">
                  <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                    <Button variant="outline" onClick={cancelMove}>
                      Annuler
                    </Button>
                  </motion.div>
                  <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                    <Button
                      onClick={confirmMove}
                      className="bg-gold text-deep-black hover:bg-gold/90"
                    >
                      Oui, déplacer
                    </Button>
                  </motion.div>
                </div>
              )}
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Modal d'alerte pour le déplacement de groupe depuis la liste non placés */}
      <Dialog open={groupAlertOpen} onOpenChange={setGroupAlertOpen}>
        <DialogContent>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-gold" />
                Déplacer tout le groupe ?
              </DialogTitle>
              <DialogDescription>
                <strong>{pendingDrop?.guest.group_name || "Ce membre"}</strong> appartient
                &agrave; un groupe dont les autres membres sont sur une table diff&eacute;rente.
                Voulez-vous d&eacute;placer tout le groupe sur cette table ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button variant="outline" onClick={cancelGroupDrop}>Non, annuler</Button>
              </motion.div>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button onClick={confirmGroupDrop} className="bg-gold text-deep-black hover:bg-gold/90">
                  Oui, d&eacute;placer tout le groupe
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

