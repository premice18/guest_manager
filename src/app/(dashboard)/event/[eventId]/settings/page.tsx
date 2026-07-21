"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Archive, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Zone = Database["public"]["Tables"]["zones"]["Row"];

// Schéma de validation pour la modification de l'événement
const eventSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  event_date: z.string().min(1, "La date est requise"),
  location: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

type EventForm = z.infer<typeof eventSchema>;

// Schéma de validation pour une zone
const zoneSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
});

// Variants d'animation pour les sections
const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 180, damping: 22 },
  },
};

const zoneItemVariants = {
  hidden: { opacity: 0, x: -16, height: 0 },
  visible: {
    opacity: 1,
    x: 0,
    height: "auto",
    transition: { type: "spring" as const, stiffness: 260, damping: 22 },
  },
  exit: {
    opacity: 0,
    x: 16,
    height: 0,
    transition: { duration: 0.2 },
  },
};

// Page des paramètres d'un événement (édition + gestion des zones)
export default function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string>("");
  const supabase = createClient();

  const [event, setEvent] = useState<Event | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState("");

  // Charge les données de l'événement et des zones
  const loadData = useCallback(async () => {
    const id = await params.then((p) => p.eventId);
    setEventId(id);

    const { data: ev } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    if (ev) setEvent(ev);

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
  });

  // Met à jour le formulaire quand l'événement est chargé
  useEffect(() => {
    if (event) {
      reset({
        name: event.name,
        event_date: event.event_date.split("T")[0],
        location: event.location ?? "",
        description: event.description ?? "",
      });
    }
  }, [event, reset]);

  // Sauvegarde les modifications de l'événement
  const onUpdateEvent = async (data: EventForm) => {
    try {
      const { error } = await supabase
        .from("events")
        .update({
          name: data.name,
          event_date: data.event_date,
          location: data.location || null,
          description: data.description || null,
        })
        .eq("id", eventId);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Événement mis à jour");
      router.refresh();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  // Bascule le statut archivé / désarchivé
  const toggleArchive = async () => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_archived: !event?.is_archived })
        .eq("id", eventId);

      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(event?.is_archived ? "Événement restauré" : "Événement archivé");
      loadData();
      router.refresh();
    } catch {
      toast.error("Erreur lors de l'archivage");
    }
  };

  // Ajoute ou modifie une zone
  const saveZone = async () => {
    if (!zoneName.trim()) return;
    try {
      if (editingZone) {
        const { error } = await supabase
          .from("zones")
          .update({ name: zoneName.trim() })
          .eq("id", editingZone.id);
        if (error) {
          toast.error(error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("zones").insert({
          event_id: eventId,
          name: zoneName.trim(),
        });
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      setZoneName("");
      setEditingZone(null);
      loadData();
    } catch {
      toast.error("Erreur lors de la sauvegarde de la zone");
    }
  };

  // Supprime une zone (uniquement si aucune table ne lui est associée)
  const deleteZone = async (zoneId: string) => {
    try {
      const { count } = await supabase
        .from("tables")
        .select("*", { count: "exact", head: true })
        .eq("zone_id", zoneId);

      if (count && count > 0) {
        toast.error("Impossible : des tables sont associées à cette zone.");
        return;
      }

      const { error } = await supabase.from("zones").delete().eq("id", zoneId);
      if (error) {
        toast.error(error.message);
        return;
      }
      loadData();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading) return <p className="p-8 text-center">Chargement...</p>;
  if (!event) return <p className="p-8 text-center">Événement introuvable</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href={`/event/${eventId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Retour à l&rsquo;événement
      </Link>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 24 }}
        className="mb-8 font-serif text-3xl text-deep-black"
      >
        Paramètres
      </motion.h1>

      {/* Section : Informations générales */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="mb-8">
          <CardHeader>
            <div className="relative">
              <CardTitle>Informations générales</CardTitle>
              <div className="mt-1.5 h-0.5 w-12 rounded-full bg-gold" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onUpdateEvent)} noValidate className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input id="name" {...register("name")} aria-invalid={!!errors.name} className="focus-visible:ring-2 focus-visible:ring-gold" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_date">Date *</Label>
                <Input id="event_date" type="date" {...register("event_date")} className="focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Lieu</Label>
                <Input id="location" {...register("location")} className="focus-visible:ring-2 focus-visible:ring-gold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  rows={3}
                  className="h-auto w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-gold md:text-sm"
                  {...register("description")}
                />
              </div>
              <div className="flex gap-3">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button type="submit" className="bg-gold text-white hover:bg-gold/90" disabled={isSubmitting}>
                    {isSubmitting ? "Sauvegarde..." : "Enregistrer"}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button type="button" variant="outline" onClick={toggleArchive}>
                    {event.is_archived ? (
                      <><motion.span
                        key="restore"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      ><RotateCcw className="mr-1.5 size-4" /></motion.span> Restaurer</>
                    ) : (
                      <><motion.span
                        key="archive"
                        initial={{ y: -4, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      ><Archive className="mr-1.5 size-4" /></motion.span> Archiver</>
                    )}
                  </Button>
                </motion.div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section : Gestion des zones */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <Card>
          <CardHeader>
            <div className="relative">
              <CardTitle>Zones</CardTitle>
              <div className="mt-1.5 h-0.5 w-12 rounded-full bg-gold" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Les zones permettent d&rsquo;organiser vos tables par espace (ex: Salle principale, Terrasse VIP).
            </p>

            {/* Formulaire d'ajout / édition d'une zone */}
            <motion.div
              layout
              className="flex gap-2"
            >
              <Input
                placeholder="Nom de la zone"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveZone())}
                className="focus-visible:ring-2 focus-visible:ring-gold"
              />
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button onClick={saveZone} className="shrink-0">
                  {editingZone ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {editingZone ? "Modifier" : "Ajouter"}
                </Button>
              </motion.div>
              <AnimatePresence>
                {editingZone && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingZone(null);
                        setZoneName("");
                      }}
                    >
                      Annuler
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Liste des zones existantes */}
            <div className="space-y-2">
              <AnimatePresence>
                {zones.map((zone) => (
                  <motion.div
                    key={zone.id}
                    variants={zoneItemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:border-gold/30"
                  >
                    <span className="font-medium">{zone.name}</span>
                    <div className="flex gap-1">
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingZone(zone);
                            setZoneName(zone.name);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteZone(zone.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {zones.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground"
                >
                  Aucune zone pour le moment.
                </motion.p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
