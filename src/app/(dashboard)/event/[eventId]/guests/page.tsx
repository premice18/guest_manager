"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import BulkAddModal from "./components/BulkAddModal";
import { Select, SelectItem } from "@/components/ui/select";

import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  Download,
  Users,
Table as TableIcon,
  X,
  Check,
  CircleUser,
  Baby,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type Guest = Database["public"]["Tables"]["guests"]["Row"];
type Table = Database["public"]["Tables"]["tables"]["Row"];

interface GuestWithTable extends Guest {
  tables?: { name: string } | null;
}

const AGE_LABELS: Record<string, string> = {
  adult: "Adulte",
  child: "Enfant",
  baby: "Bébé",
};

// Analyse uneparse CSV ligne respectant les guillemets (permise des virgules
// ou points-virgules entre guillemets, guillemets doublés échappés).
function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

// Normalise une valeur de tranche d'âge française vers l'enum de la base
function normalizeAge(value: string): "adult" | "child" | "baby" {
  const v = value.trim().toLowerCase();
  if (["child", "enfant", "kids", "enfants"].includes(v)) return "child";
  if (["baby", "bébé", "bebe", "nourrisson"].includes(v)) return "baby";
  return "adult";
}

// Interprète une valeur booléenne (accessibilité) : Oui/Non/1/0/true/false...
function toBool(value: string): boolean {
  return ["oui", "yes", "true", "vrai", "1", "x"].includes(value.trim().toLowerCase());
}

// Variants d'animation pour les rangées du tableau
const tableContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.035 },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 200, damping: 24 },
  },
};

// Page de gestion des invités d'un événement
export default function GuestsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [eventId, setEventId] = useState("");
  const [supabase] = useState(() => createClient());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [guests, setGuests] = useState<GuestWithTable[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
const [filterPresent, setFilterPresent] = useState<string>("all");
  const [filterAge, setFilterAge] = useState<string>("all");
  const [filterTableId, setFilterTableId] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Droits d'écriture : le propriétaire et les admins peuvent tout faire,
  // les hôtes sont en lecture seule (la présence se gère depuis la réception).
  const [canManage, setCanManage] = useState(false);

  // État du modal invité
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  // Confirmation de suppression
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formAgeType, setFormAgeType] = useState<"adult" | "child" | "baby">("adult");
  const [formTableId, setFormTableId] = useState("none");
  const [formGroupName, setFormGroupName] = useState("");
  const [formGroupId, setFormGroupId] = useState("");
  const [formDietary, setFormDietary] = useState("");
  const [formAccessibility, setFormAccessibility] = useState(false);
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [applyToGroup, setApplyToGroup] = useState(false);

  // État du modal groupe
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState("");

  // État du modal import CSV
  const [importModalOpen, setImportModalOpen] = useState(false);

  // État du modal ajout rapide
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await params.then((p) => p.eventId);
      if (cancelled) return;
      setEventId(id);

      const { data: tbls } = await supabase
        .from("tables")
        .select("id, name, capacity")
        .eq("event_id", id)
        .order("name");
      const rawTables = (tbls ?? []) as Table[];

      const { data: gsts } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", id)
        .order("last_name")
        .order("first_name");
      const rawGuests = (gsts ?? []) as Guest[];

      // Détermine le rôle courant (owner / admin => gestion complète, host => lecture seule)
      let role: string | null = null;
      const { data: currentUser } = await supabase.auth.getUser();
      if (currentUser?.user?.id) {
        const { data: staffRow } = await supabase
          .from("event_staff")
          .select("role")
          .eq("event_id", id)
          .eq("user_id", currentUser.user.id)
          .maybeSingle();
        role = staffRow?.role ?? null;
      }
      const { data: evOwner } = await supabase
        .from("events")
        .select("owner_id")
        .eq("id", id)
        .single();
      const isOwner = !!evOwner && evOwner.owner_id === currentUser?.user?.id;

      if (!cancelled) {
        setTables(rawTables);
        // Associe le nom de la table pour chaque invité
        const tableMap = new Map(rawTables.map((t) => [t.id, t.name]));
        setGuests(
          rawGuests.map((g) => ({
            ...g,
            tables: g.table_id ? { name: tableMap.get(g.table_id) ?? "?" } : null,
          }))
        );
        setCanManage(isOwner || role === "admin");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
}, [params, supabase]);

  // Recharge les données après une mutation (ajout, suppression, groupe...)
  const loadData = useCallback(async () => {
    if (!eventId) return;
    const { data: tbls } = await supabase
      .from("tables")
      .select("id, name, capacity")
      .eq("event_id", eventId)
      .order("name");
    const rawTables = (tbls ?? []) as Table[];
    setTables(rawTables);

    const { data: gsts } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", eventId)
      .order("last_name")
      .order("first_name");
    const rawGuests = (gsts ?? []) as Guest[];
    const tableMap = new Map(rawTables.map((t) => [t.id, t.name]));
    setGuests(
      rawGuests.map((g) => ({
        ...g,
        tables: g.table_id ? { name: tableMap.get(g.table_id) ?? "?" } : null,
      }))
    );
  }, [supabase, eventId]);

  // Ouvre le modal pour créer/éditer un invité
  const openGuestModal = (guest?: Guest) => {
    if (guest) {
      setEditingGuest(guest);
      setFormFirstName(guest.first_name);
      setFormLastName(guest.last_name);
      setFormCategory(guest.category ?? "");
      setFormAgeType(guest.age_type);
      setFormTableId(guest.table_id ?? "none");
      setFormGroupName(guest.group_name ?? "");
      setFormGroupId(guest.group_id ?? "");
      setFormDietary(guest.dietary_notes ?? "");
      setFormAccessibility(guest.needs_accessibility);
      setFormNotes(guest.notes ?? "");
    } else {
      setEditingGuest(null);
      setFormFirstName("");
      setFormLastName("");
      setFormCategory("");
      setFormAgeType("adult");
      setFormTableId("none");
      setFormGroupName("");
      setFormGroupId("");
      setFormDietary("");
      setFormAccessibility(false);
      setFormNotes("");
    }
    setApplyToGroup(false);
    setGuestModalOpen(true);
  };

  // Sauvegarde un invité
  const saveGuest = async () => {
    if (!formFirstName.trim() || !formLastName.trim()) {
      toast.error("Le prénom et le nom sont requis");
      return;
    }

    const targetTableId = formTableId === "none" ? null : formTableId;
    const groupId = formGroupId || (formGroupName.trim() ? nanoid() : null);

    // Vérifie la capacité avant sauvegarde pour ne jamais dépasser les places d'une table
    if (targetTableId) {
      const targetTable = tables.find((t) => t.id === targetTableId);
      if (targetTable && targetTable.is_locked && editingGuest?.table_id !== targetTableId) {
        toast.error(`🔒 La table "${targetTable.name}" est verrouillée.`);
        return;
      }

      if (targetTable && applyToGroup && groupId) {
        const groupMembers = guests.filter((g) => g.group_id === groupId);
        const alreadyOnTarget = groupMembers.filter(
          (g) => g.table_id === targetTableId
        ).length;
        const placedOnTarget = guests.filter(
          (g) => g.table_id === targetTableId
        ).length;
        const free = targetTable.capacity - placedOnTarget;
        const needed = groupMembers.length - alreadyOnTarget;
        if (needed > free) {
          toast.error(
            `⚠️ Le groupe (${groupMembers.length} pers.) ne tient pas sur "${targetTable.name}" (${free} place${free > 1 ? "s" : ""} libre${free > 1 ? "s" : ""}).`
          );
          return;
        }
      } else if (targetTable) {
        const staying = editingGuest?.table_id === targetTableId;
        const available = getTableAvailable(targetTableId);
        if (!staying && available < 1) {
          toast.error(
            `⚠️ La table "${targetTable.name}" est complète (${targetTable.capacity} places).`
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        event_id: eventId,
        first_name: formFirstName.trim(),
        last_name: formLastName.trim(),
        category: formCategory.trim() || null,
        age_type: formAgeType,
        table_id: formTableId === "none" ? null : formTableId,
        group_name: formGroupName.trim() || null,
        group_id: groupId,
        dietary_notes: formDietary.trim() || null,
        needs_accessibility: formAccessibility,
        notes: formNotes.trim() || null,
      };

      if (editingGuest) {
        const { error } = await supabase
          .from("guests")
          .update(payload)
          .eq("id", editingGuest.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Invité mis à jour");

        // Si demandé, applique la table à tout le groupe
        if (applyToGroup && payload.table_id && payload.group_id) {
          const { error: groupError } = await supabase
            .from("guests")
            .update({ table_id: payload.table_id })
            .eq("group_id", payload.group_id)
            .eq("event_id", eventId)
            .neq("id", editingGuest.id);
          if (groupError) toast.error("Erreur lors de l'application au groupe");
        }
      } else {
        const { error } = await supabase.from("guests").insert(payload);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Invité ajouté");
      }

      setGuestModalOpen(false);
      loadData();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Supprime un invité (appelé depuis le modal de confirmation)
  const confirmDeleteGuest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("guests").delete().eq("id", deleteTarget.id);
      if (error) {
        toast.error(error.message);
        setDeleteTarget(null);
        return;
      }
      toast.success("Invité supprimé");
      setDeleteTarget(null);
      const { count } = await supabase
        .from("guests")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      // Si la page courante devient vide, on remonte d'une page
      if (count !== null && count <= page * PAGE_SIZE) {
        setPage(Math.max(0, page - 1));
      }
      loadData();
    } catch {
      toast.error("Erreur lors de la suppression");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Crée un groupe à partir des invités sélectionnés
  const createGroup = async () => {
    if (selectedGuestIds.size < 2) {
      toast.error("Sélectionnez au moins 2 invités");
      return;
    }
    const groupId = nanoid();
    try {
      const { error } = await supabase
        .from("guests")
        .update({
          group_id: groupId,
          group_name: newGroupName.trim() || null,
        })
        .in("id", Array.from(selectedGuestIds));

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Groupe créé !");
      setGroupModalOpen(false);
      setSelectedGuestIds(new Set());
      setNewGroupName("");
      loadData();
    } catch {
      toast.error("Erreur lors de la création du groupe");
    }
  };

  // Retire un invité de son groupe
  const removeFromGroup = async (guest: Guest) => {
    try {
      const { error } = await supabase
        .from("guests")
        .update({ group_id: null, group_name: null })
        .eq("id", guest.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      loadData();
    } catch {
      toast.error("Erreur");
    }
  };

// Nombre d'invités placés par table (utilisé pour la validation de capacité dans le bulk add)
  const tableCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of guests) {
      if (g.table_id) {
        counts[g.table_id] = (counts[g.table_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [guests]);

  // Capacité restante d'une table, dérivée du comptage mémorisé ci-dessus
  const tableAvailable = useMemo(() => {
    const result: Record<string, number> = {};
    for (const t of tables) {
      result[t.id] = t.capacity - (tableCounts[t.id] ?? 0);
    }
    return result;
  }, [tables, tableCounts]);

  // Calcule la capacité restante d'une table
  const getTableAvailable = (tableId: string) => tableAvailable[tableId] ?? 0;

  // Filtres
  const filtered = guests.filter((g) => {
    const q = search.toLowerCase();
    if (q && !`${g.first_name} ${g.last_name} ${g.group_name ?? ""} ${g.category ?? ""}`
      .toLowerCase()
      .includes(q)) return false;
    if (filterPresent === "present" && !g.is_present) return false;
if (filterPresent === "absent" && g.is_present) return false;
    if (filterAge !== "all" && g.age_type !== filterAge) return false;
    if (filterTableId !== "all" && g.table_id !== filterTableId) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Page bornée pour éviter l'état vide quand le résultat se réduit
  // (suppression du dernier élément de la page, filtre resserré...)
  const safePage = Math.min(page, totalPages - 1);
  const pageGuests = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Civilité", "Prénom", "Nom", "Catégorie", "Âge",
      "Groupe", "Table", "Régime", "Accessibilité",
      "Présent", "Arrivée", "Notes",
    ];
    const rows = guests.map((g) => [
      "", g.first_name, g.last_name, g.category ?? "", AGE_LABELS[g.age_type] ?? g.age_type,
      g.group_name ?? "", g.tables?.name ?? "", g.dietary_notes ?? "",
      g.needs_accessibility ? "Oui" : "Non",
      g.is_present ? "Oui" : "Non", g.checked_in_at ?? "", g.notes ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invites-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  // Import CSV - lecture du fichier
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    // Définit un séparateur (virgule ou point-virgule) selon le plus présent
    const lines = text.split(/\r?\n/).map((l) => l.replace(/^\uFEFF/, "")).filter(Boolean);
    const headerLine = lines[0] ?? "";
    const commaCount = (headerLine.match(/,/g) ?? []).length;
    const semiCount = (headerLine.match(/;/g) ?? []).length;
    const delimiter = semiCount > commaCount ? ";" : ",";
    const headers = parseCsvLine(headerLine, delimiter);
    const data = lines.slice(1).map((l) => parseCsvLine(l, delimiter));
    setCsvHeaders(headers);
    setCsvData(data);
    // Mapping par défaut
    const guess: Record<string, string> = {};
    for (const h of headers) {
      const hl = h.toLowerCase();
      if (hl.includes("prénom") || hl.includes("first")) guess[h] = "first_name";
      else if (hl.includes("nom") || hl.includes("last") || hl.includes("name")) guess[h] = "last_name";
      else if (hl.includes("catégorie") || hl.includes("categorie") || hl.includes("category")) guess[h] = "category";
      else if (hl.includes("âge") || hl.includes("age")) guess[h] = "age_type";
      else if (hl.includes("groupe") || hl.includes("group")) guess[h] = "group_name";
      else if (hl.includes("table")) guess[h] = "table_id";
      else if (hl.includes("régime") || hl.includes("aliment") || hl.includes("diet")) guess[h] = "dietary_notes";
      else if (hl.includes("accessib")) guess[h] = "needs_accessibility";
    }
    setColumnMapping(guess);
    setImportModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Import CSV - envoi en base
const executeImport = async () => {
    setImporting(true);
    let success = 0;
    let errors = 0;

    // Construit le mapping inverse
    const reverseMap: Record<string, string> = {};
    for (const [csvCol, dbField] of Object.entries(columnMapping)) {
      reverseMap[dbField] = csvCol;
    }

    const rowsToInsert: (Database["public"]["Tables"]["guests"]["Insert"] & { event_id: string })[] = [];

    // Correspondance nom de table (colonne CSV) -> id de table
    const tableIdByName = new Map(tables.map((t) => [t.name.toLowerCase(), t.id]));

    for (const row of csvData) {
      try {
        const get = (field: string) => {
          const colIndex = reverseMap[field];
          if (colIndex === undefined) return "";
          const idx = csvHeaders.indexOf(colIndex);
          return idx >= 0 ? row[idx]?.trim() ?? "" : "";
        };

        const firstName = get("first_name");
        const lastName = get("last_name");
        if (!firstName || !lastName) {
          errors++;
          continue;
        }

        const tableName = get("table_id");
        rowsToInsert.push({
          event_id: eventId,
          first_name: firstName,
          last_name: lastName,
          category: get("category") || null,
          age_type: get("age_type") ? normalizeAge(get("age_type")) : "adult",
          table_id: tableName ? tableIdByName.get(tableName.toLowerCase()) ?? null : null,
          group_name: get("group_name") || null,
          dietary_notes: get("dietary_notes") || null,
          needs_accessibility: get("needs_accessibility") ? toBool(get("needs_accessibility")) : false,
          notes: get("notes") || null,
        });
      } catch {
        errors++;
      }
    }

    // Insertion groupée : UNE seule requête au lieu d'une par ligne (évite le N+1)
    if (rowsToInsert.length > 0) {
      try {
        const { error } = await supabase.from("guests").insert(rowsToInsert);
        if (error) {
          // Une ligne invalide (enum d'âge, capacité DB...) ne doit pas faire
          // échouer l'ensemble : on retente ligne par ligne puis on compte les
          // erreurs unitaires. Le trigger de capacité rejette également ici.
          let ok = 0;
          let failed = 0;
          for (const row of rowsToInsert) {
            const { error: rowError } = await supabase.from("guests").insert(row);
            if (rowError) failed++;
            else ok++;
          }
          success = ok;
          errors += failed;
        } else {
          success = rowsToInsert.length;
        }
      } catch {
        // Erreur réseau inattendue : chaque ligne du lot est comptée comme un échec
        errors += rowsToInsert.length;
      }
    }

    setImporting(false);
    setImportModalOpen(false);
    toast.success(`${success} invité(s) importé(s)` + (errors ? `, ${errors} erreur(s)` : ""));
    loadData();
  };

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

      {/* En-tête */}
      <motion.div
        variants={fadeInUp}
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
        className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="font-serif text-3xl text-deep-black">Invités</h1>
          <p className="text-sm text-muted-foreground">
            {guests.length} invité{guests.length !== 1 ? "s" : ""} au total
            ({guests.filter((g) => !g.table_id).length} non placé
            {guests.filter((g) => !g.table_id).length !== 1 ? "s" : ""})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          {canManage && (
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-1.5 size-4" />
                Importer CSV
              </Button>
            </motion.div>
          )}
          <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-1.5 size-4" />
              Exporter CSV
            </Button>
          </motion.div>
          {canManage && (
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkModalOpen(true)}
                className="gap-1.5 text-gold border-gold/30 hover:bg-gold/5"
              >
                <UserPlus className="size-4" />
                Ajout rapide
              </Button>
            </motion.div>
          )}
          {canManage && (
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button size="sm" onClick={() => openGuestModal()}>
                <Plus className="mr-1.5 size-4" />
                Ajouter un invité
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Filtres */}
      <motion.div
        variants={fadeInUp}
        initial={prefersReducedMotion ? false : "hidden"}
        animate={prefersReducedMotion ? {} : "visible"}
      >
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher nom, prénom, groupe..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
              <Select
                value={filterPresent}
                onValueChange={(v) => { setFilterPresent(v); setPage(0); }}
                className="w-auto"
              >
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="present">Présents</SelectItem>
                <SelectItem value="absent">Absents</SelectItem>
              </Select>
              <Select
                value={filterAge}
                onValueChange={(v) => { setFilterAge(v); setPage(0); }}
                className="w-auto"
              >
                <SelectItem value="all">Tous les âges</SelectItem>
                <SelectItem value="adult">Adultes</SelectItem>
                <SelectItem value="child">Enfants</SelectItem>
                <SelectItem value="baby">Bébés</SelectItem>
              </Select>
              <Select
                value={filterTableId}
                onValueChange={(v) => { setFilterTableId(v); setPage(0); }}
                className="w-auto"
              >
                <SelectItem value="all">Toutes les tables</SelectItem>
                <SelectItem value="none">Non placés</SelectItem>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Actions de groupe */}
      <AnimatePresence>
        {canManage && selectedGuestIds.size > 0 && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -12, height: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0, height: "auto" }}
            exit={prefersReducedMotion ? {} : { opacity: 0, y: -12, height: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 22 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-lg bg-gold/10 px-4 py-2 text-sm">
              <motion.span
                key={selectedGuestIds.size}
                initial={prefersReducedMotion ? false : { scale: 1.3 }}
                animate={prefersReducedMotion ? {} : { scale: 1 }}
                className="font-medium"
              >
                {selectedGuestIds.size} sélectionné(s)
              </motion.span>
              {canManage && (
                <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewGroupName("");
                      setGroupModalOpen(true);
                    }}
                  >
                    Créer un groupe
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedGuestIds(new Set())}
                >
                  <X className="mr-1 size-3.5" />
                  Annuler
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tableau des invités */}
      {pageGuests.length > 0 ? (
        <motion.div
          variants={tableContainerVariants}
          initial={prefersReducedMotion ? false : "hidden"}
          animate={prefersReducedMotion ? {} : "visible"}
          className="overflow-x-auto rounded-xl border border-border bg-white"
        >
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGuestIds(new Set(pageGuests.map((g) => g.id)));
                      } else {
                        setSelectedGuestIds(new Set());
                      }
                    }}
                    checked={pageGuests.every((g) => selectedGuestIds.has(g.id))}
                    className="size-4 rounded border-border text-gold focus:ring-2 focus:ring-gold"
                  />
                </th>
                <th className="px-3 py-3 text-left font-medium">Nom</th>
                <th className="px-3 py-3 text-left font-medium">Prénom</th>
                <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Catégorie</th>
                <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Âge</th>
                <th className="px-3 py-3 text-left font-medium hidden lg:table-cell">Groupe</th>
                <th className="px-3 py-3 text-left font-medium">Table</th>
                <th className="px-3 py-3 text-center font-medium">Arrivé</th>
                <th className="w-20 px-3 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageGuests.map((guest, idx) => (
                <motion.tr
                  key={guest.id}
                  variants={tableRowVariants}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-muted/30",
                    guest.is_present && "bg-green-50/50",
                    idx % 2 === 0 ? "bg-white" : "bg-muted/20"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedGuestIds.has(guest.id)}
                      onChange={() => {
                        const next = new Set(selectedGuestIds);
                        if (next.has(guest.id)) next.delete(guest.id);
                        else next.add(guest.id);
                        setSelectedGuestIds(next);
                      }}
                      className="size-4 rounded border-border text-gold focus:ring-2 focus:ring-gold"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium">{guest.last_name}</td>
                  <td className="px-3 py-2.5">{guest.first_name}</td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                    {guest.category ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    {guest.age_type === "baby" ? (
                      <Baby className="size-4 text-muted-foreground" />
                    ) : (
                      <CircleUser className="size-4 text-muted-foreground" />
                    )}
                    <span className="ml-1 text-xs">{AGE_LABELS[guest.age_type]}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    {guest.group_name ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">
                        <Users className="size-3" />
                        {guest.group_name}
                      </span>
                    ) : guest.group_id ? (
                      <span className="text-xs text-muted-foreground">Membre d&rsquo;un groupe</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {guest.tables?.name ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                        <TableIcon className="size-3" />
                        {guest.tables.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {guest.is_present ? (
                      <Check className="mx-auto size-4 text-green-600" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canManage && (
                      <div className="flex justify-end gap-0.5">
                        <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.1 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="Modifier"
                            onClick={() => openGuestModal(guest)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </motion.div>
                        {guest.group_id && (
                          <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.1 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label="Retirer du groupe"
                              onClick={() => removeFromGroup(guest)}
                              title="Retirer du groupe"
                            >
                              <Users className="size-3.5" />
                            </Button>
                          </motion.div>
                        )}
                        <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.1 }} whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            aria-label="Supprimer"
                            onClick={() => setDeleteTarget(guest)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </motion.div>
                      </div>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={prefersReducedMotion ? {} : { opacity: 1 }}
              className="flex items-center justify-between border-t border-border px-4 py-3"
            >
              <p className="text-sm text-muted-foreground">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
              </p>
              <div className="flex gap-1">
                <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                    className="focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    Précédent
                  </Button>
                </motion.div>
                <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                  <Button
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                    className="bg-gold text-deep-black hover:bg-gold/90 focus-visible:ring-2 focus-visible:ring-gold disabled:bg-muted disabled:text-muted-foreground"
                  >
                    Suivant
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
          className="rounded-xl border-2 border-dashed border-border bg-white p-12 text-center"
        >
          <motion.div
            animate={prefersReducedMotion ? {} : { y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          >
            <Users className="mx-auto mb-4 size-12 text-muted-foreground/40" />
          </motion.div>
          <p className="text-muted-foreground">
            {search || filterPresent !== "all" || filterAge !== "all" || filterTableId !== "all"
              ? "Aucun invité ne correspond aux filtres."
              : "Aucun invité pour le moment. Importez un fichier CSV ou ajoutez un invité."}
          </p>
        </motion.div>
      )}

      {/* Modal invité (création / édition) */}
      <Dialog open={guestModalOpen} onOpenChange={setGuestModalOpen}>
        <DialogContent>
          <motion.div
initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle>{editingGuest ? "Modifier l'invité" : "Nouvel invité"}</DialogTitle>
              <DialogDescription>
                {editingGuest ? "Modifiez les informations de l'invité." : "Ajoutez un invité à votre événement."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first-name">Prénom *</Label>
                <Input id="first-name" value={formFirstName} onChange={(e) => setFormFirstName(e.target.value)} className="focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Nom *</Label>
                <Input id="last-name" value={formLastName} onChange={(e) => setFormLastName(e.target.value)} className="focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-category">Catégorie</Label>
                <Input id="guest-category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} placeholder="VIP, Famille..." className="focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-age">Tranche d&apos;âge</Label>
                <Select
                  id="guest-age"
                  value={formAgeType}
                  onValueChange={(v) => setFormAgeType(v as "adult" | "child" | "baby")}
                >
                  <SelectItem value="adult">Adulte</SelectItem>
                  <SelectItem value="child">Enfant</SelectItem>
                  <SelectItem value="baby">Bébé</SelectItem>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-table">Table attribuée</Label>
                <Select
                  id="guest-table"
                  value={formTableId}
                  onValueChange={setFormTableId}
                >
                  <SelectItem value="none">Non placé</SelectItem>
                  {tables
                    .filter((t) => !t.is_locked || editingGuest?.table_id === t.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({getTableAvailable(t.id)}/{t.capacity} places)
                      </SelectItem>
                    ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-group">Groupe</Label>
                <Input
                  id="guest-group"
                  value={formGroupName}
                  onChange={(e) => setFormGroupName(e.target.value)}
                  placeholder="Nom du groupe (optionnel)"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guest-dietary">Notes alimentaires</Label>
                <Textarea
                  id="guest-dietary"
                  rows={2}
                  value={formDietary}
                  onChange={(e) => setFormDietary(e.target.value)}
                  placeholder="Allergies, régime..."
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="guest-notes">Notes diverses</Label>
                <Textarea
                  id="guest-notes"
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formAccessibility}
                    onChange={(e) => setFormAccessibility(e.target.checked)}
                    className="size-4 rounded border-border text-gold focus:ring-2 focus:ring-gold"
                  />
                  Besoin d&rsquo;accessibilité
                </label>
              </div>
              {editingGuest && canManage && formTableId !== "none" && (
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyToGroup}
                      onChange={(e) => setApplyToGroup(e.target.checked)}
                      className="size-4 rounded border-border text-gold focus:ring-2 focus:ring-gold"
                    />
                    Appliquer cette table à tout le groupe
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button variant="outline" onClick={() => setGuestModalOpen(false)}>Annuler</Button>
              </motion.div>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button
                  onClick={saveGuest}
                  disabled={saving || !formFirstName.trim() || !formLastName.trim()}
                  className="bg-gold text-deep-black hover:bg-gold/90"
                >
                  {saving ? "Sauvegarde..." : editingGuest ? "Enregistrer" : "Ajouter"}
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Modal création de groupe */}
      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent>
          <motion.div
initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle>Créer un groupe</DialogTitle>
              <DialogDescription>
                {selectedGuestIds.size} invité(s) sélectionné(s). Donnez un nom à ce groupe.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="group-name">Nom du groupe</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Famille Mbuyi, Couple Dupont..."
                className="focus-visible:ring-2 focus-visible:ring-gold"
              />
            </div>
            <DialogFooter>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button variant="outline" onClick={() => setGroupModalOpen(false)}>Annuler</Button>
              </motion.div>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button onClick={createGroup} className="bg-gold text-deep-black hover:bg-gold/90">
                  Créer le groupe
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Modal ajout rapide */}
      <BulkAddModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
eventId={eventId}
        tables={tables}
        tableCounts={tableCounts}
        onSuccess={loadData}
      />

      {/* Modal import CSV */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <motion.div
initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle>Import CSV</DialogTitle>
              <DialogDescription>
                Faites correspondre les colonnes de votre fichier aux champs de la base.
              </DialogDescription>
            </DialogHeader>

            {csvHeaders.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {csvData.length} ligne(s) détectée(s). Associez chaque colonne CSV :
                </p>
                {csvHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="min-w-[120px] text-sm font-medium">{header}</span>
                    <Select
                      value={columnMapping[header] ?? ""}
                      onValueChange={(v) =>
                        setColumnMapping((prev) => ({ ...prev, [header]: v }))
                      }
                      className="h-10 flex-1 w-auto"
                    >
                      <SelectItem value="">Ignorer</SelectItem>
                      <SelectItem value="first_name">Prénom (obligatoire)</SelectItem>
                      <SelectItem value="last_name">Nom (obligatoire)</SelectItem>
                      <SelectItem value="category">Catégorie</SelectItem>
                      <SelectItem value="age_type">Tranche d&apos;âge</SelectItem>
                      <SelectItem value="group_name">Groupe</SelectItem>
                      <SelectItem value="table_id">Table</SelectItem>
                      <SelectItem value="dietary_notes">Notes alimentaires</SelectItem>
                      <SelectItem value="needs_accessibility">Accessibilité</SelectItem>
                      <SelectItem value="notes">Notes</SelectItem>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button variant="outline" onClick={() => setImportModalOpen(false)}>Annuler</Button>
              </motion.div>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button
                  onClick={executeImport}
                  disabled={importing || !csvData.length}
                  className="bg-gold text-deep-black hover:bg-gold/90"
                >
                  {importing ? "Import..." : `Importer ${csvData.length} lignes`}
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* FAB mobile pour ajouter un invité */}
      {canManage && (
        <div className="fixed bottom-6 right-6 z-50 sm:hidden">
          <motion.button
            onClick={() => openGuestModal()}
            whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
            className="flex size-14 items-center justify-center rounded-full bg-gold text-deep-black shadow-lg shadow-gold/30"
            aria-label="Ajouter un invité"
          >
            <Plus className="size-7" />
          </motion.button>
        </div>
      )}

      {/* Modal confirmation de suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
          >
            <DialogHeader>
              <DialogTitle>Supprimer cet invité ?</DialogTitle>
              <DialogDescription>
                {deleteTarget ? (
                  <>
                    « {deleteTarget.first_name} {deleteTarget.last_name} » sera
                    définitivement retiré de la liste et de sa table.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Annuler
                </Button>
              </motion.div>
              <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                <Button
                  onClick={confirmDeleteGuest}
                  disabled={deleting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </Button>
              </motion.div>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

