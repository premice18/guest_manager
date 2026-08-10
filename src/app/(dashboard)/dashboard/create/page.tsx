"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";

// Schéma de validation pour la création d'un événement
const eventSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(200, "Nom trop long"),
  event_date: z.string().min(1, "La date est requise"),
  location: z.string().max(300, "Lieu trop long").optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
});

type EventForm = z.infer<typeof eventSchema>;

// Variantes d'animation pour l'entrée du formulaire
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 80,
      damping: 15,
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -15 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

// Formulaire de création d'un nouvel événement
export default function CreateEventPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  // Client Supabase créé une seule fois (état paresseux) — fix audit.
  const [supabase] = useState(() => createClient());

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_date: new Date().toISOString().split("T")[0],
    },
  });

  const description = useWatch({ control, name: "description" });
  const descriptionLength = description?.length ?? 0;

  // Crée l'événement en base de données
  const onSubmit = async (data: EventForm) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data: event, error } = await supabase
        .from("events")
        .insert({
          name: data.name,
          event_date: data.event_date,
          location: data.location || null,
          description: data.description || null,
          owner_id: user.id,
        })
        .select("id")
        .single();

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Événement créé avec succès !");
      router.push(`/event/${event.id}`);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue lors de la création.");
    }
  };

  return (
    <motion.main
      initial={prefersReducedMotion ? false : "hidden"}
      animate={prefersReducedMotion ? {} : "visible"}
      variants={containerVariants}
      className="mx-auto max-w-lg px-4 py-8 sm:px-6"
    >
      {/* Lien retour */}
      <motion.div variants={itemVariants}>
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4" />
          Retour au tableau de bord
        </Link>
      </motion.div>

      {/* Carte formulaire */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-t-2 border-t-gold/30 shadow-md">
          <CardHeader>
            {/* Icône décorative */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
              transition={{
                type: "spring" as const,
                stiffness: 200,
                damping: 15,
              }}
              className="mb-4 flex justify-center"
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/20">
                <Sparkles className="size-8 text-gold" />
              </div>
            </motion.div>
            <CardTitle className="text-center font-serif text-2xl text-foreground">
              Nouvel événement
            </CardTitle>
            <CardDescription className="text-center">
              Renseignez les informations de base pour créer votre événement.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              {/* Nom de l'événement */}
              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="name">Nom de l&rsquo;événement *</Label>
                <Input
                  id="name"
                  placeholder="Mariage de Jean & Marie"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                <AnimatePresence>
                  {errors.name && (
                  <motion.p
                    key="name-error"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
                    animate={prefersReducedMotion ? {} : {
                      opacity: 1,
                      x: [0, -8, 8, -8, 8, 0],
                      transition: { duration: 0.4 },
                    }}
                    exit={prefersReducedMotion ? {} : { opacity: 0, x: 10 }}
                    className="text-sm text-destructive"
                  >
                    {errors.name.message}
                  </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Date de l'événement */}
              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="event_date">Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  className="focus-visible:ring-2 focus-visible:ring-gold [color-scheme:light]"
                  {...register("event_date")}
                  aria-invalid={!!errors.event_date}
                />
                <AnimatePresence>
                  {errors.event_date && (
                  <motion.p
                    key="date-error"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
                    animate={prefersReducedMotion ? {} : {
                      opacity: 1,
                      x: [0, -8, 8, -8, 8, 0],
                      transition: { duration: 0.4 },
                    }}
                    exit={prefersReducedMotion ? {} : { opacity: 0, x: 10 }}
                    className="text-sm text-destructive"
                  >
                    {errors.event_date.message}
                  </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Lieu */}
              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="location">Lieu</Label>
                <Input
                  id="location"
                  placeholder="Château de Versailles"
                  className="focus-visible:ring-2 focus-visible:ring-gold"
                  {...register("location")}
                />
              </motion.div>

              {/* Description */}
              <motion.div variants={itemVariants} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Description (optionnelle)</Label>
                  <span
                    className={`text-xs ${
                      descriptionLength > 900
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {descriptionLength}/1000
                  </span>
                </div>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="Quelques mots sur votre événement..."
                  {...register("description")}
                />
              </motion.div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3 border-t border-border/50 bg-muted/30">
              <Link href="/dashboard">
                <motion.div
                  whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                  className="inline-block"
                >
                  <Button type="button" variant="outline">
                    Annuler
                  </Button>
                </motion.div>
              </Link>
              <motion.div
                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                className="inline-block"
              >
                <Button
                  type="submit"
                  className="bg-gold text-deep-black shadow-sm transition-all duration-200 hover:bg-gold/90 hover:shadow-md"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Création..." : "Créer l'événement"}
                </Button>
              </motion.div>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </motion.main>
  );
}
