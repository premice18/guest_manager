"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  FileText,
  Download,
  Table,
  FileSpreadsheet,
  FilePen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";

type Event = Database["public"]["Tables"]["events"]["Row"];

// Variants d'animation pour les cartes
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 180,
      damping: 22,
      delay: i * 0.1,
    },
  }),
};

// Définition des exports disponibles
const EXPORTS = [
  {
    key: "master-book",
    title: "Master Book",
    description: "Liste complète des invités avec toutes les informations : nom, catégorie, table, régime alimentaire.",
    icon: FileText,
    url: (eventId: string) => `/api/reports/${eventId}/master-book`,
    color: "from-gold to-gold/70",
    filename: "master-book.pdf",
  },
  {
    key: "table-sheets",
    title: "Fiches tables",
    description: "Fiches détaillées par table avec la liste des invités placés, capacités et notes.",
icon: Table,
    url: (eventId: string) => `/api/reports/${eventId}/table-sheets`,
    color: "from-blue-500 to-blue-400",
    filename: "fiches-tables.pdf",
  },
  {
    key: "catering-summary",
    title: "Résumé traiteur",
    description: "Récapitulatif des régimes alimentaires et allergies pour le service traiteur.",
icon: FileText,
    url: (eventId: string) => `/api/reports/${eventId}/catering-summary`,
    color: "from-green-500 to-green-400",
    filename: "synthese-traiteur.pdf",
  },
  {
    key: "table-list-simple",
    title: "Liste simple des tables",
    description: "Document fonctionnel avec les invités listés par table : nom, statut (couple/singleton), catégorie, restrictions.",
icon: Table,
    url: (eventId: string) => `/api/reports/${eventId}/table-lists?style=simple`,
    color: "from-amber-500 to-amber-400",
    filename: "liste-tables-simple.pdf",
  },
  {
    key: "table-list-stylized",
    title: "Liste stylisée des tables",
    description: "Version élégante avec encadrements dorés, couples affichés ensemble, badges restrictions — idéal pour impression.",
icon: FileText,
    url: (eventId: string) => `/api/reports/${eventId}/table-lists?style=stylized`,
    color: "from-gold to-amber-600",
    filename: "liste-tables-stylisee.pdf",
  },
  {
    key: "table-list-docx-simple",
    title: "DOCX — Liste simple",
    description: "Document Word modifiable avec tableaux, styles Heading et lignes zébrées — pour édition locale.",
icon: FilePen,
    url: (eventId: string) => `/api/reports/${eventId}/table-lists-docx?style=simple`,
    color: "from-blue-600 to-blue-500",
    filename: "liste-tables-simple.docx",
  },
  {
    key: "table-list-docx-stylized",
    title: "DOCX — Liste stylisée",
    description: "Document Word élégant avec bordures dorées, couples ❤️, badges restrictions — prêt à personnaliser.",
icon: FilePen,
    url: (eventId: string) => `/api/reports/${eventId}/table-lists-docx?style=stylized`,
    color: "from-gold to-amber-500",
    filename: "liste-tables-stylisee.docx",
  },
  {
    key: "csv",
    title: "Export CSV",
    description: "Fichier CSV complet des invités pour analyse dans un tableur (Excel, Google Sheets).",
    icon: FileSpreadsheet,
    url: (eventId: string) => `/api/reports/${eventId}/csv`,
    color: "from-purple-500 to-purple-400",
    filename: "invites.csv",
  },
];

// Page des rapports et exports
export default function ReportsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [eventId, setEventId] = useState("");
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
const [downloading, setDownloading] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  // Charge le nom de l'événement
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await params.then((p) => p.eventId);
      if (cancelled) return;
      setEventId(id);

      const { data: ev } = await supabase
        .from("events")
        .select("name")
        .eq("id", id)
        .single();
      if (!cancelled && ev) setEvent(ev as Event);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params, supabase]);

  // Gère le téléchargement avec état de chargement et gestion d'erreur
  // Télécharge via fetch pour détecter les erreurs (404, 500) au lieu d'ouvrir le JSON brut
  const handleDownload = async (key: string) => {
    const exp = EXPORTS.find((e) => e.key === key);
    if (!exp) return;
    const url = exp.url(eventId);

    startTransition(() => {
      setDownloading(key);
    });

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = exp.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Le rapport n'a pas pu être généré. Réessayez.");
    } finally {
      setTimeout(() => setDownloading(null), 500);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-center text-muted-foreground">Chargement...</p>
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
        className="mb-8"
      >
        <h1 className="font-serif text-3xl tracking-tight text-deep-black">
          Rapports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {event?.name ? `${event.name} — ` : ""}
          Générez des PDF, DOCX et exports CSV professionnels
        </p>
      </motion.div>

      {/* Grille des cartes d'export */}
      <div className="grid gap-6 sm:grid-cols-2">
        {EXPORTS.map((exp, idx) => {
          const Icon = exp.icon;
          const isDownloading = downloading === exp.key && isPending;

          return (
            <motion.div
              key={exp.key}
              custom={idx}
              variants={cardVariants}
              initial={prefersReducedMotion ? false : "hidden"}
              animate={prefersReducedMotion ? {} : "visible"}
            >
              <Card className="flex h-full flex-col transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <div className={cn(
                    "mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-xs",
                    exp.color
                  )}>
                    <Icon className="size-6 text-white" />
                  </div>
                  <CardTitle className="text-lg text-deep-black">
                    {exp.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {exp.description}
                  </p>
                  <motion.div
                    whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
                  >
                    <a
                      href={exp.url(eventId)}
                      onClick={(e) => {
                        e.preventDefault();
                        handleDownload(exp.key);
                      }}
                    >
                      <Button
                        className="w-full gap-2 bg-gold text-deep-black hover:bg-gold/90"
                        disabled={isDownloading}
                      >
                        <Download className="size-4" />
                        {isDownloading ? "Génération..." : "Télécharger"}
                      </Button>
                    </a>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </main>
  );
}

