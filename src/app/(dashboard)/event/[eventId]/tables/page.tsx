"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  const router = useRouter();
  const [eventId, setEventId] = useState("");
  const supabase = createClient();

  const [tables, setTables] = useState<TableWithCount[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");

  // État du formulaire modal pour créer/éditer une table
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState(8);
  const [formShape, setFormShape] = useState<"round" | "rectangular" | "imperial">("round");
  const [formZone, setFormZone] = useState("");
  const [formLocked, setFormLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const id = await params.then((p) => p.eventId);
    setEventId(id);

    // Récupère les tables et le nombre d'invités associés
    const { data: tbls } = await supabase
      .from("tables")
      .select("*")
      .eq("event_id", id)
      .order("sort_order", { ascending: true })
      .order("name");
    const rawTables = (tbls ?? []) as Table[];

    const { data: guestCounts } = await supabase
      .from("guests")
      .select("table_id")
      .eq("event_id", id);
    const countMap: Record<string, number> = {};
    for (const g of (guestCounts ?? []) as { table_id: string | null }[]) {
      if (g.table_id) countMap[g.table_id] = (countMap[g.table_id] ?? 0) + 1;
    }

    setTables(
      rawTables.map((t) => ({
        ...t,
        guest_count: countMap[t.id] ?? 0,
      }))
    );

    const { data: zns } = await supabase
      .from("zones")
      .select("*")
      .eq("event_id", id)
      .order("name");
    setZones(zns ?? []);
    setLoading(false);
  }, [params, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          .eq("id", editingTable.id);
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
      loadData();
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
      const { error } = await supabase.from("tables").delete().eq("id", table.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      loadData();
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
        .eq("id", table.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      loadData();
    } catch {
      toast.error("Erreur lors du verrouillage");
    }
  };

  // Réorganise l'ordre d'affichage (monter / descendre)
  const moveTable = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tables.length) return;

    const updated = [...tables];
    const temp = updated[index].sort_order;
    updated[index] = { ...updated[index], sort_order: updated[newIndex].sort_order };
    updated[newIndex] = { ...updated[newIndex], sort_order: temp };
    updated.sort((a, b) => a.sort_order - b.sort_order);

    try {
      await supabase
        .from("tables")
        .update({ sort_order: updated[index].sort_order })
        .eq("id", updated[index].id);
      await supabase
        .from("tables")
        .update({ sort_order: updated[newIndex].sort_order })
        .eq("id", updated[newIndex].id);
      setTables(updated);
    } catch {
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="font-serif text-3xl text-deep-black">Tables</h1>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={() => openModal()}>
            <Plus className="mr-1.5 size-4" />
            Ajouter une table
          </Button>
        </motion.div>
      </motion.div>

      {/* Filtres */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <Input
          placeholder="Rechercher une table..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs focus-visible:ring-2 focus-visible:ring-gold"
        />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
        >
          <option value="all">Toutes les zones</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Grille des tables */}
      {filteredTables.length > 0 ? (
        <motion.div
          variants={cardContainerVariants}
          initial="hidden"
          animate="visible"
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
                            animate={{ rotate: table.is_locked ? [0, -10, 10, -5, 0] : 0 }}
                            transition={{ duration: 0.4 }}
                          >
                            <Lock className="size-4 text-muted-foreground" />
                          </motion.div>
                        )}
                        {table.name}
                      </CardTitle>
                      <div className="flex gap-0.5">
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => moveTable(index, -1)}
                            disabled={index === 0}
                          >
                            <GripVertical className="size-4 rotate-90" />
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => moveTable(index, 1)}
                            disabled={index === tables.length - 1}
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
                          transition={{ duration: 0.6, ease: "easeOut", type: "spring" as const, stiffness: 100 }}
                          className={cn("h-full rounded-full", getFillColor(table.guest_count, table.capacity))}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1">
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
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLock(table)}
                          className="focus-visible:ring-2 focus-visible:ring-gold"
                        >
                          <motion.span
                            key={table.is_locked ? "unlock" : "lock"}
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            {table.is_locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                          </motion.span>
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
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
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
          className="rounded-xl border-2 border-dashed border-border bg-white p-12 text-center"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
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
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
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
                <select
                  id="table-shape"
                  value={formShape}
                  onChange={(e) => setFormShape(e.target.value as any)}
                  className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                >
                  <option value="round">Ronde</option>
                  <option value="rectangular">Rectangulaire</option>
                  <option value="imperial">Impériale</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table-zone">Zone</Label>
                <select
                  id="table-zone"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                >
                  <option value="none">Aucune zone</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
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
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Annuler
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button
                  onClick={saveTable}
                  disabled={saving || !formName.trim()}
                  className="bg-gold text-white hover:bg-gold/90"
                >
                  {saving ? "Sauvegarde..." : editingTable ? "Enregistrer" : "Créer"}
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
