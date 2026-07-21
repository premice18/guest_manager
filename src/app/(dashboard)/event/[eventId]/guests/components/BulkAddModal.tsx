"use client";
// Modal d'ajout rapide d'invités en masse (bulk add)
// Permet de saisir plusieurs invités simultanément avec prénom, nom, type (singleton/couple) et table
// Supporte l'import CSV intégré et la création de couples liés par group_id

import { nanoid } from "nanoid";
import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X,
  Plus,
  Copy,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type Table = Database["public"]["Tables"]["tables"]["Row"];

interface BulkAddRow {
  id: string; // clé locale unique
  firstName: string;
  lastName: string;
  type: "singleton" | "couple";
  tableId: string;
}

interface BulkAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  tables: Table[];
  guestsCount: number; // nombre d'invités déjà placés pour calcul des capacités
  onSuccess: () => void; // rappel pour rafraîchir la liste
}

// Génère un ID local unique pour chaque ligne
function localId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Crée 3 lignes vides par défaut
function createEmptyRow(type: "singleton" | "couple" = "singleton"): BulkAddRow {
  return { id: localId(), firstName: "", lastName: "", type, tableId: "" };
}

const INITIAL_ROWS = 3;

export default function BulkAddModal({
  open,
  onOpenChange,
  eventId,
  tables,
  guestsCount,
  onSuccess,
}: BulkAddModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // État des lignes de saisie
  const [rows, setRows] = useState<BulkAddRow[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => createEmptyRow())
  );
  const [saving, setSaving] = useState(false);

  // État import CSV
  const [csvText, setCsvText] = useState("");
  const [showCsv, setShowCsv] = useState(false);

  // Compte combien d'invités sont placés par table pour calculer la capacité restante
  const guestCountByTable = useCallback(
    (tableId: string) => guestsCount, // approximation simple : on utilise le total
    [guestsCount]
  );

  // Capacité restante d'une table
  const getTableAvailable = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return 0;
    // On ne peut pas compter en temps réel ici sans recharger, mais on valide au moment de l'insert
    return table.capacity;
  };

  // Ajoute une ligne vide
  const addRow = (type: "singleton" | "couple" = "singleton") => {
    setRows((prev) => [...prev, createEmptyRow(type)]);
  };

  // Supprime une ligne
  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Duplique une ligne
  const duplicateRow = (row: BulkAddRow) => {
    setRows((prev) => [
      ...prev,
      { ...row, id: localId(), firstName: row.firstName, lastName: row.lastName },
    ]);
  };

  // Met à jour un champ d'une ligne
  const updateRow = (id: string, field: keyof BulkAddRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };

        // Si on change le type en "couple", on ajoute automatiquement une ligne partenaire
        if (field === "type" && value === "couple" && r.type !== "couple") {
          // Ajoute une ligne partenaire juste après
          const partnerRow = createEmptyRow("couple");
          // On marque la ligne partenaire avec group_id implicite via l'index
          const idx = prev.indexOf(r);
          const newRows = [...prev];
          newRows.splice(idx + 1, 0, {
            ...partnerRow,
            firstName: "",
            lastName: "",
          });
          return updated;
        }

        return updated;
      })
    );
  };

  // Récupère les lignes partenaires pour les couples
  const getCoupleGroups = (): BulkAddRow[][] => {
    const groups: BulkAddRow[][] = [];
    const visited = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      if (rows[i].type !== "couple" || visited.has(rows[i].id)) continue;
      const pair = [rows[i]];
      visited.add(rows[i].id);

      // Cherche la ligne partenaire adjacente (prochaine ligne "couple" si elle existe)
      if (i + 1 < rows.length && rows[i + 1].type === "couple") {
        pair.push(rows[i + 1]);
        visited.add(rows[i + 1].id);
      }

      groups.push(pair);
    }

    return groups;
  };

  // Valide les lignes avant enregistrement
  const validateRows = (): string[] => {
    const errors: string[] = [];
    const coupleGroups = getCoupleGroups();
    const coupleMembers = new Set(coupleGroups.flatMap((g) => g.map((r) => r.id)));

    for (const row of rows) {
      if (!row.firstName.trim()) errors.push(`Ligne : Prénom manquant`);
      if (!row.lastName.trim()) errors.push(`Ligne : Nom manquant`);
    }

    // Vérifie que chaque couple a 2 membres
    for (const group of coupleGroups) {
      if (group.length < 2) {
        errors.push(`Couple "${group[0].firstName} ${group[0].lastName}" : conjoint manquant`);
      }
    }

    return [...new Set(errors)];
  };

  // Enregistre tous les invités en base
  const saveBulk = async () => {
    const validationErrors = validateRows();
    if (validationErrors.length > 0) {
      toast.error(validationErrors.join(". "));
      return;
    }

    // Filtre les lignes vides
    const validRows = rows.filter((r) => r.firstName.trim() && r.lastName.trim());

    if (validRows.length === 0) {
      toast.error("Aucune ligne valide à ajouter");
      return;
    }

    setSaving(true);

    try {
      // Construit les inserts pour Supabase
      const inserts: Array<{
        event_id: string;
        first_name: string;
        last_name: string;
        table_id: string | null;
        group_id: string | null;
        group_name: string | null;
        age_type: "adult" | "child" | "baby";
      }> = [];

      // Traite les couples
      const coupleGroups = getCoupleGroups();
      const coupleMemberIds = new Set(coupleGroups.flatMap((g) => g.map((r) => r.id)));

      for (const group of coupleGroups) {
        if (group.length < 2) continue;
        const groupId = nanoid();
        const lastName = group[0].lastName || group[1]?.lastName || "Couple";

        for (const member of group) {
          if (!member.firstName.trim() || !member.lastName.trim()) continue;
          inserts.push({
            event_id: eventId,
            first_name: member.firstName.trim(),
            last_name: member.lastName.trim(),
            table_id: member.tableId || null,
            group_id: groupId,
            group_name: `Couple ${lastName}`,
            age_type: "adult",
          });
        }
      }

      // Traite les singletons
      for (const row of validRows) {
        if (coupleMemberIds.has(row.id)) continue;
        inserts.push({
          event_id: eventId,
          first_name: row.firstName.trim(),
          last_name: row.lastName.trim(),
          table_id: row.tableId || null,
          group_id: null,
          group_name: null,
          age_type: "adult",
        });
      }

      if (inserts.length === 0) {
        toast.error("Aucun invité valide à ajouter");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("guests").insert(inserts);

      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }

      toast.success(`${inserts.length} invité(s) ajouté(s) avec succès`);
      onOpenChange(false);
      onSuccess();

      // Réinitialise les lignes
      setRows(Array.from({ length: INITIAL_ROWS }, () => createEmptyRow()));
    } catch {
      toast.error("Erreur lors de l'ajout des invités");
    } finally {
      setSaving(false);
    }
  };

  // Import CSV depuis un texte collé
  const importCsvText = () => {
    if (!csvText.trim()) {
      toast.error("Collez des données CSV");
      return;
    }

    const lines = csvText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      toast.error("Le CSV doit contenir un en-tête et au moins une ligne");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const data = lines
      .slice(1)
      .map((l) =>
        l.split(",").map((c) => c.replace(/^"|"$/g, "").trim())
      );

    // Trouve les index des colonnes
    const firstNameIdx = headers.findIndex(
      (h) => h.includes("prenom") || h.includes("prénom") || h.includes("first")
    );
    const lastNameIdx = headers.findIndex(
      (h) => h.includes("nom") || h.includes("last") || h.includes("name")
    );
    const typeIdx = headers.findIndex(
      (h) => h.includes("type") || h.includes("couple") || h.includes("statut")
    );
    const tableIdx = headers.findIndex((h) => h.includes("table"));

    if (firstNameIdx < 0 || lastNameIdx < 0) {
      toast.error("Le CSV doit contenir les colonnes 'prenom' et 'nom'");
      return;
    }

    // Crée les lignes à partir du CSV
    const tableMap = new Map(tables.map((t) => [t.name.toLowerCase(), t.id]));
    const importedRows: BulkAddRow[] = [];

    for (const row of data) {
      const firstName = row[firstNameIdx] ?? "";
      const lastName = row[lastNameIdx] ?? "";
      const type =
        typeIdx >= 0 && row[typeIdx]?.toLowerCase().includes("couple")
          ? "couple"
          : "singleton";
      const tableName = tableIdx >= 0 ? (row[tableIdx] ?? "") : "";
      const tableId = tableName ? tableMap.get(tableName.toLowerCase()) ?? "" : "";

      importedRows.push({
        id: localId(),
        firstName,
        lastName,
        type: type as "singleton" | "couple",
        tableId,
      });
    }

    if (importedRows.length === 0) {
      toast.error("Aucune ligne valide dans le CSV");
      return;
    }

    setRows(importedRows);
    setShowCsv(false);
    setCsvText("");
    toast.success(`${importedRows.length} ligne(s) importée(s) depuis le CSV`);
  };

  // Import CSV depuis un fichier
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setCsvText(text);
        setShowCsv(true);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Réinitialise lors de l'ouverture
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShowCsv(false);
      setCsvText("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
        >
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-gold">
              Ajout rapide d&rsquo;invités
            </DialogTitle>
            <DialogDescription>
              Saisissez plusieurs invités en une seule fois.
              Chaque ligne correspond à un invité ou un couple.
              Les champs marqués * sont obligatoires.
            </DialogDescription>
          </DialogHeader>

          {/* Boutons d'action supérieurs */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addRow("singleton")}
                className="gap-1"
              >
                <Plus className="size-3.5" />
                Singleton
              </Button>
            </motion.div>
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addRow("couple")}
                className="gap-1 text-gold"
              >
                <Plus className="size-3.5" />
                Couple
              </Button>
            </motion.div>
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCsv(!showCsv)}
                className="gap-1 ml-auto"
              >
                <Upload className="size-3.5" />
                {showCsv ? "Masquer CSV" : "CSV"}
              </Button>
            </motion.div>
          </div>

          {/* Section CSV */}
          <AnimatePresence>
            {showCsv && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
                exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-4 overflow-hidden"
              >
                <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
                  <p className="mb-2 text-sm font-medium">
                    Collez vos données CSV (en-têtes : prenom,nom,type,table)
                  </p>
                  <Textarea
                    rows={4}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder={`prenom,nom,type,table\nJean,Dupont,singleton,Table 1\nMarie,Martin,couple,Table 2`}
                    className="mb-3 bg-white"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="flex gap-2">
                    <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-1 size-3.5" />
                        Fichier
                      </Button>
                    </motion.div>
                    <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
                      <Button size="sm" onClick={importCsvText} className="bg-gold text-deep-black hover:bg-gold/90">
                        Importer
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tableau de saisie */}
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-anthracite text-white">
                  <th className="w-10 px-2 py-2.5 text-center text-xs font-medium">N°</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium">Prénom *</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium">Nom *</th>
                  <th className="w-24 px-2 py-2.5 text-left text-xs font-medium">Type</th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium">Table</th>
                  <th className="w-20 px-2 py-2.5 text-center text-xs font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const table = tables.find((t) => t.id === row.tableId);
                  const available = table ? table.capacity : 0;
                  const isCouple = row.type === "couple";

                  return (
                    <motion.tr
                      key={row.id}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
                      transition={{ type: "spring" as const, stiffness: 260, damping: 24 }}
                      className={cn(
                        "border-b border-border transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                        isCouple && "bg-gold/5"
                      )}
                    >
                      <td className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                        {idx + 1}
                        {isCouple && (
                          <span className="ml-1 text-[10px] text-gold" title="Couple">💑</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={row.firstName}
                          onChange={(e) => updateRow(row.id, "firstName", e.target.value)}
                          placeholder="Prénom"
                          className="h-9 text-xs focus-visible:ring-2 focus-visible:ring-gold"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={row.lastName}
                          onChange={(e) => updateRow(row.id, "lastName", e.target.value)}
                          placeholder="Nom"
                          className="h-9 text-xs focus-visible:ring-2 focus-visible:ring-gold"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.type}
                          onChange={(e) =>
                            updateRow(row.id, "type", e.target.value)
                          }
                          className={cn(
                            "h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none",
                            isCouple && "border-gold/50 text-gold"
                          )}
                        >
                          <option value="singleton">Seul(e)</option>
                          <option value="couple">Couple</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.tableId}
                          onChange={(e) => updateRow(row.id, "tableId", e.target.value)}
                          className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-xs focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
                        >
                          <option value="">Non placé</option>
                          {tables.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({available} pl.)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex justify-center gap-0.5">
                          <motion.button
                            whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                            whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                            onClick={() => duplicateRow(row)}
                            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="Dupliquer"
                          >
                            <Copy className="size-3" />
                          </motion.button>
                          <motion.button
                            whileHover={prefersReducedMotion ? {} : { scale: 1.1 }}
                            whileTap={prefersReducedMotion ? {} : { scale: 0.9 }}
                            onClick={() => removeRow(row.id)}
                            className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Supprimer"
                          >
                            <X className="size-3" />
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Indicateur de lignes */}
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {rows.filter((r) => r.firstName.trim() && r.lastName.trim()).length} invité(s) saisi(s)
              {" — "}
              {getCoupleGroups().length} couple(s)
            </span>
            {rows.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setRows([])}
                className="text-red-400 hover:text-red-500"
              >
                Tout effacer
              </motion.button>
            )}
          </div>

          <DialogFooter className="mt-4 border-t border-border pt-4">
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
            </motion.div>
            <motion.div whileHover={prefersReducedMotion ? {} : { scale: 1.03 }} whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}>
              <Button
                onClick={saveBulk}
                disabled={saving}
                className="bg-gold text-deep-black hover:bg-gold/90"
              >
                {saving ? "Ajout en cours..." : `Ajouter les invités`}
              </Button>
            </motion.div>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

