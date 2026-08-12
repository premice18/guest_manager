"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem } from "@/components/ui/select";
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
import BulkAddModal from "@/app/(dashboard)/event/[eventId]/guests/components/BulkAddModal";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  GripVertical,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

type Table = Database["public"]["Tables"]["tables"]["Row"];
type Zone = Database["public"]["Tables"]["zones"]["Row"];

interface TableWithCount extends Table {
  guest_count: number;
}

// Calcule la couleur de la jauge en fonction du remplissage
function getFillColor(filled: number, capacity: number) {
  if (capacity === 0) return "bg-muted";
  const ratio = filled / capacity;
  if (ratio >= 1) return "bg-red-500";
  if (ratio >= 0.75) return "bg-gold";
  return "bg-green-500";
}

// Variants d'animation pour la grille de cartes
const cardContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
};

// Page de gestion des tables d'un événement
export default function TablesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
const prefersReducedMotion = useReducedMotion();
  const [eventId, setEventId] = useState("");
  const [supabase] = useState(() => createClient());

  const [tables, setTables] = useState<TableWithCount[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");

  // Droits d'écriture : owner/admin peuvent tout faire, les hôtes sont en
  // lecture seule (pas d'ajout d'invité depuis les tables).
  const [canManage, setCanManage] = useState(false);

  // Modal d'ajout rapide d'invités pour une table (saisie directe ici)
  const [addGuestsTableId, setAddGuestsTableId] = useState<string | null>(null);

  // Nombre de personnes placées par table (somme des guest_count) — utilisé
  // pour la validation de capacité du modal d'ajout.
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});

  // État du formulaire modal pour créer/éditer une table
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState(8);
  const [formShape, setFormShape] = useState<"round" | "rectangular" | "imperial">("round");
  const [formZone, setFormZone] = useState("");
  const [formLocked, setFormLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charge les données (tables, invités, zones) et laisse droit de l'utilisateur
  const loadData = useCallback(async (id: string) => {
    const [tblsRes, guestCountsRes, znsRes, roleRes] = await Promise.all([
      supabase
        .from("tables")
        .select("id, name, capacity, zone_id, is_locked, sort_order, shape")
        .eq("event_id", id)
        .order("sort_order", { ascending: true })
        .order("name"),
      // Récupère table_id + guest_count pour un comptage EN PERSONNES
      supabase
        .from("guests")
        .select("table_id, guest_count")
        .eq("event_id", id),
      supabase.from("zones").select("id, name").eq("event_id", id).order("name"),
      supabase.auth.getUser(),
    ]);

    const rawTables = (tblsRes.data ?? []) as Table[];
    const personMap: Record<string, number> = {};
    for (const g of (guestCountsRes.data ?? []) as {
      table_id: string | null;
      guest_count: number | null;
    }[]) {
      if (g.table_id) {
        personMap[g.table_id] =
          (personMap[g.table_id] ?? 0) + (g.guest_count ?? 1);
      }
    }

    // Détermine si l'utilisateur courant peut gérer (owner ou admin)
    const currentUser = roleRes?.data?.user ?? null;
    let canWrite = false;
    if (currentUser?.id) {
      const { data: evOwner } = await supabase
        .from("events")
        .select("owner_id")
        .eq("id", id)
        .single();
      if (evOwner?.owner_id === currentUser.id) {
        canWrite = true;
      } else {
        const { data: staffRow } = await supabase
          .from("event_staff")
          .select("role")
          .eq("event_id", id)
          .eq("user_id", currentUser.id)
          .maybeSingle();
        canWrite = staffRow?.role === "admin";
      }
    }

    return {
      rawTables,
      personMap,
      zones: (znsRes.data ?? []) as Zone[],
      canWrite,
    };
  }, [supabase]);

useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await params.then((p) => p.eventId);
      if (cancelled) return;
      setEventId(id);

      const result = await loadData(id);

      if (!cancelled) {
        setTables(
          result.rawTables.map((t) => ({
            ...t,
            guest_count: result.personMap[t.id] ?? 0,
          }))
        );
        setZones(result.zones);
        setTableCounts(result.personMap);
        setCanManage(result.canWrite);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, supabase, loadData]);

  const refreshData = async () => {
    if (!eventId) return;
    const result = await loadData(eventId);
    setTables(
      result.rawTables.map((t) => ({
        ...t,
        guest_count: result.personMap[t.id] ?? 0,
      }))
    );
    setZones(result.zones);
    setTableCounts(result.personMap);
    setCanManage(result.canWrite);
  };

  // Ouvre le modal pour créer ou éditer une table
  const openModal = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setFormName(table.name);
      setFormCapacity(table.capacity);
      setFormShape(table.shape);
      setFormZone(table.zone_id ?? "none");
      setFormLocked(table.is_locked);
    } else {
      setEditingTable(null);
      setFormName("");
      setFormCapacity(8);
      setFormShape("round");
      setFormZone("none");
      setFormLocked(false);
    }
    setModalOpen(true);
  };

  // Sauvegarde (création ou mise à jour) d'une table
  const saveTable = async () => {
    if (!formName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        event_id: eventId,
        name: formName.trim(),
        capacity: formCapacity,
        shape: formShape,
        zone_id: formZone === "none" ? null : formZone,
        is_locked: formLocked,
      };

      if (editingTable) {
        const { error } = await supabase
          .from("tables")
          .update(payload)
          .eq("id", editingTable.id)
          .eq("event_id", eventId);
        if (error) {
          toast.error(error.message);
          return;
        }
      } else {
        // Trouve le prochain sort_order
        const maxOrder = tables.reduce((max, t) => Math.max(max, t.sort_order), 0);
        const { error } = await supabase.from("tables").insert({
          ...payload,
          sort_order: maxOrder + 1,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      setModalOpen(false);
      refreshData();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Supprime une table (vérifie qu'elle n'a pas d'invités)
  const deleteTable = async (table: TableWithCount) => {
    if (table.guest_count > 0) {
      toast.error("Impossible : des invités sont encore attribués à cette table. Déplacez-les d'abord.");
      return;
    }
    try {
      const { error } = await supabase
        .from("tables")
        .delete()
        .eq("id", table.id)
        .eq("event_id", eventId);
      if (error) {
        toast.error(error.message);
        return;
      }
      refreshData();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  // Verrouille ou déverrouille une table
  const toggleLock = async (table: Table) => {
    try {
      const { error } = await supabase
        .from("tables")
        .update({ is_locked: !table.is_locked })
        .eq("id", table.id)
        .eq("event_id", eventId);
      if (error) {
        toast.error(error.message);
        return;
      }
      refreshData();
    } catch {
      toast.error("Erreur lors du verrouillage");
    }
  };

  // Réorganise l'ordre d'affichage (monter / descendre)
  const moveTable = async (id: string, direction: -1 | 1) => {
    // Recherche l'indice réel de la table dans la liste TRIÉE complète
    // (l'indice de la carte filtrée ne peut pas être utilisé : il serait
    // incohérent dès qu'un filtre de recherche/zone est actif).
    const index = tables.findIndex((t) => t.id === id);
    if (index < 0) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tables.length) return;

    const original = tables;
    const updated = [...tables];
    const temp = updated[index].sort_order;
    updated[index] = { ...updated[index], sort_order: updated[newIndex].sort_order };
    updated[newIndex] = { ...updated[newIndex], sort_order: temp };
    updated.sort((a, b) => a.sort_order - b.sort_order);

    // Mise à jour optimiste locale
    setTables(updated);

    try {
      // Réordonnancement atomique via un seul appel RPC (transaction en
      // base) : deux UPDATE séparés n'étaient PAS atomiques et un tri
      // intermédiaire pouvait adresser l'update aux mauvaises lignes.
      const idOrder = updated.map((t) => t.id);
      const { error } = await supabase.rpc("reorder_tables", {
        target_event_id: eventId,
        table_ids: idOrder,
      });

      if (error) {
        // Rollback si l'écriture a échoué
        setTables(original);
        toast.error(error.message ?? "Erreur lors du réordonnancement");
      }
    } catch {
      setTables(original);
      toast.error("Erreur lors du réordonnancement");
    }
  };

  // Filtre les tables par recherche et zone
  const filteredTables = tables.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchZone = zoneFilter === "all" || t.zone_id === zoneFilter;
    return matchSearch && matchZone;
  });

  if (loading) return <p className="p-8 text-center">Chargement...</p>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href={`/event/${eventId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Retour à l&rsquo;événement
      </Link>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="font-serif text-3xl text-foreground">Tables</h1>
        <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
          <Button onClick={() => openModal()}>
            <Plus className="mr-1.5 size-4" />
            Ajouter une table
          </Button>
        </motion.div>
      </motion.div>

      {/* Filtres */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <Input
          placeholder="Rechercher une table..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs focus-visible:ring-2 focus-visible:ring-gold"
        />
        <Select
          value={zoneFilter}
          onValueChange={setZoneFilter}
          className="w-auto"
        >
          <SelectItem value="all">Toutes les zones</SelectItem>
          {zones.map((z) => (
            <SelectItem key={z.id} value={z.id}>
              {z.name}
            </SelectItem>
          ))}
        </Select>
      </motion.div>

      {/* Grille des tables */}
      {filteredTables.length > 0 ? (
        <motion.div
          variants={cardContainerVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredTables.map((table, index) => {
            const fillRatio = table.capacity > 0 ? table.guest_count / table.capacity : 0;
            const fillPercent = Math.min(100, Math.round(fillRatio * 100));

            return (
              <motion.div key={table.id} variants={cardItemVariants}>
                <Card
                  className={cn(
                    "shadow-sm transition-all hover:shadow-md",
                    table.is_locked && "opacity-75"
                  )}
                >
                  <CardHeader className="border-b border-border/50 pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {table.is_locked && (
                          <motion.div
                            initial={{ rotate: 0 }}
                            animate={prefersReducedMotion ? {} : { rotate: table.is_locked ? [0, -10, 10, -5, 0] : 0 }}
                            transition={{ duration: 0.4 }}
                          >
                            <Lock className="size-4 text-muted-foreground" />
                          </motion.div>
                        )}
                        {table.name}
                      </CardTitle>
                      <div className="flex gap-0.5">
                        <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.1 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Déplacer vers le haut"
                            onClick={() => moveTable(table.id, -1)}
                            disabled={index === 0}
                          >
                            <GripVertical className="size-4 rotate-90" />
                          </Button>
                        </motion.div>
                        <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.1 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Déplacer vers le bas"
                            onClick={() => moveTable(table.id, 1)}
                            disabled={index === filteredTables.length - 1}
                          >
                            <GripVertical className="size-4 -rotate-90" />
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 capitalize">
                        <span className={cn(
                          "size-2 rounded-full",
                          table.shape === "round" ? "bg-gold" : table.shape === "imperial" ? "bg-purple-500" : "bg-blue-500"
                        )} />
                        {table.shape === "imperial" ? "impériale" : table.shape === "round" ? "ronde" : "rectangulaire"}
                      </span>
                      {table.zone_id && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5">
                          {zones.find((z) => z.id === table.zone_id)?.name ?? "Zone inconnue"}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    {/* Jauge de remplissage */}
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Remplissage</span>
                        <span className={cn("font-medium", fillRatio >= 1 && "text-red-500")}>
                          {table.guest_count}/{table.capacity}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${fillPercent}%` }}
                          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut", type: "spring" as const, stiffness: 100 }}
                          className={cn("h-full rounded-full", getFillColor(table.guest_count, table.capacity))}
                        />
                      </div>
                    </div>

                    {/* Saisie directe des invités de la table (masquée si la
                        table est verrouillée : aucun invité ne peut y être
                        ajouté) */}
                    {canManage && !table.is_locked && (
                      <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 text-gold border-gold/30 hover:bg-gold/5"
                          onClick={() => setAddGuestsTableId(table.id)}
                        >
                          <UserPlus className="size-3.5" />
                          Ajouter des invités
                        </Button>
                      </motion.div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }} className="flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => openModal(table)}
                        >
                          <Pencil className="mr-1.5 size-3.5" />
                          Modifier
                        </Button>
                      </motion.div>
                      <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.05 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLock(table)}
                          className="focus-visible:ring-2 focus-visible:ring-gold"
                        >
                          <motion.span
                            key={table.is_locked ? "unlock" : "lock"}
                            initial={prefersReducedMotion ? false : { rotate: -90, opacity: 0 }}
                            animate={prefersReducedMotion ? {} : { rotate: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            {table.is_locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                          </motion.span>
                        </Button>
                      </motion.div>
                      <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.05 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTable(table)}
                          className="text-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-gold"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
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
            <svg className="mx-auto mb-4 size-12 text-muted-foreground/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="4" rx="1" />
              <path d="M8 8v12" />
              <path d="M16 8v12" />
              <path d="M4 18h16" />
            </svg>
          </motion.div>
          <p className="text-muted-foreground">
            {search || zoneFilter !== "all"
              ? "Aucune table ne correspond aux filtres."
              : "Aucune table pour le moment. Créez votre première table !"}
          </p>
        </motion.div>
      )}

      {/* Modal de création / édition d'une table */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingTable ? "Modifier la table" : "Nouvelle table"}
              </DialogTitle>
              <DialogDescription>
                {editingTable
                  ? "Modifiez les informations de la table."
                  : "Ajoutez une nouvelle table à votre événement."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table-name">Nom de la table *</Label>
                <Input
                  id="table-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Table 1"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-capacity">Capacité *</Label>
                <Input
                  id="table-capacity"
                  type="number"
                  min={1}
                  max={100}
                  value={formCapacity}
                  onChange={(e) => setFormCapacity(parseInt(e.target.value) || 1)}
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-shape">Forme</Label>
                <Select
                  id="table-shape"
                  value={formShape}
                  onValueChange={(v) => setFormShape(v as "round" | "rectangular" | "imperial")}
                >
                  <SelectItem value="round">Ronde</SelectItem>
                  <SelectItem value="rectangular">Rectangulaire</SelectItem>
                  <SelectItem value="imperial">Impériale</SelectItem>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-zone">Zone</Label>
                <Select
                  id="table-zone"
                  value={formZone}
                  onValueChange={setFormZone}
                >
                  <SelectItem value="none">Aucune zone</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formLocked}
                  onChange={(e) => setFormLocked(e.target.checked)}
                  className="size-4 rounded border-border text-gold focus:ring-2 focus:ring-gold"
                />
                Verrouiller la table (empêche les modifications de placement)
              </label>
            </div>

            <DialogFooter>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Annuler
                </Button>
              </motion.div>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button
                  onClick={saveTable}
                  disabled={saving || !formName.trim()}
                  className="bg-gold text-deep-black hover:bg-gold/90"
                >
                  {saving ? "Sauvegarde..." : editingTable ? "Enregistrer" : "Créer"}
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Modal d'ajout rapide d'invités pour une table : les invités saisis
          sont automatiquement attribués à la table sélectionnée */}
      <BulkAddModal
        open={addGuestsTableId !== null}
        onOpenChange={(open) => {
          if (!open) setAddGuestsTableId(null);
        }}
        eventId={eventId}
        tables={tables}
        tableCounts={tableCounts}
        defaultTableId={addGuestsTableId ?? undefined}
        onSuccess={refreshData}
      />
    </main>
  );
}

