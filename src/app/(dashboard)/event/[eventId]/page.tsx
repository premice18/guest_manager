import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventById } from "@/lib/dal/events";
import { getGuestStats } from "@/lib/dal/guests";
import { getTableCounts } from "@/lib/dal/tables";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Table,
  LayoutDashboard,
  Settings,
  Calendar,
  MapPin,
  Plus,
  BarChart3,
  FileText,
} from "lucide-react";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await getEventById(eventId);
  if (!event) notFound();

  const [guestStats, tableCounts] = await Promise.all([
    getGuestStats(eventId),
    getTableCounts(eventId),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Fil d'Ariane */}
      <Link
        href="/dashboard"
        className="group mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Tableau de bord
      </Link>

      {/* En-tête de l'événement */}
      <div className="mb-8">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-sm">
            <Calendar className="size-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl tracking-tight text-foreground">
              {event.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4 text-gold/60" />
                {formatDate(event.event_date)}
              </span>
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-gold/60" />
                  {event.location}
                </span>
              )}
            </div>
            {/* Description de l'événement */}
            {event.description && (
              <p className="mt-3 border-l-2 border-gold/30 pl-3 text-sm leading-relaxed text-muted-foreground italic">
                {event.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold/70 shadow-xs">
                <Users className="size-4 text-white" />
              </div>
              Invités
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {guestStats.total}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {guestStats.placed} placés
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-gold/70 shadow-xs">
                <Table className="size-4 text-white" />
              </div>
              Tables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {tableCounts.totalTables}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              dans {tableCounts.totalZones} zone{tableCounts.totalZones !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href={`/event/${eventId}/guests`}>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 transition-all duration-200 hover:shadow-sm active:scale-[0.97]"
          >
            <Plus className="size-4" />
            Ajouter un invité
          </Button>
        </Link>
        <Link href={`/event/${eventId}/tables`}>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 transition-all duration-200 hover:shadow-sm active:scale-[0.97]"
          >
            <Table className="size-4" />
            Configurer les tables
          </Button>
        </Link>
        <Link href={`/event/${eventId}/settings`}>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 transition-all duration-200 hover:shadow-sm active:scale-[0.97]"
          >
            <Settings className="size-4" />
            Paramètres
          </Button>
        </Link>
        <Link href={`/event/${eventId}/dashboard`}>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 transition-all duration-200 hover:shadow-sm active:scale-[0.97]"
          >
            <BarChart3 className="size-4" />
            Statistiques
          </Button>
        </Link>
        <Link href={`/event/${eventId}/reports`}>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 transition-all duration-200 hover:shadow-sm active:scale-[0.97]"
          >
            <FileText className="size-4" />
            Rapports
          </Button>
        </Link>
      </div>

      {/* Grille de navigation vers les différents modules */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/event/${eventId}/guests`}
          className="group block"
        >
          <Card className="cursor-pointer border-t-2 border-t-transparent shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-t-gold/40 group-hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-xs transition-transform duration-300 group-hover:scale-110">
                <Users className="size-6 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Gestion des invités</CardTitle>
                <ArrowRight className="size-4 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Importez, filtrez et organisez vos listes d&rsquo;invités.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/event/${eventId}/tables`}
          className="group block"
        >
          <Card className="cursor-pointer border-t-2 border-t-transparent shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-t-gold/40 group-hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-xs transition-transform duration-300 group-hover:scale-110">
                <Table className="size-6 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Tables & zones</CardTitle>
                <ArrowRight className="size-4 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configurez vos tables, zones et verrouillez les placements.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/event/${eventId}/placement`}
          className="group block"
        >
          <Card className="cursor-pointer border-t-2 border-t-transparent shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-t-gold/40 group-hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-xs transition-transform duration-300 group-hover:scale-110">
                <LayoutDashboard className="size-6 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Plan de salle</CardTitle>
                <ArrowRight className="size-4 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Placez vos invités par glisser-déposer sur les tables.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/event/${eventId}/settings`}
          className="group block"
        >
          <Card className="cursor-pointer border-t-2 border-t-transparent shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-t-gold/40 group-hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-xs transition-transform duration-300 group-hover:scale-110">
                <Settings className="size-6 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Paramètres</CardTitle>
                <ArrowRight className="size-4 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Modifiez les informations et gérez les zones.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/event/${eventId}/dashboard`}
          className="group block"
        >
          <Card className="cursor-pointer border-t-2 border-t-transparent shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-t-gold/40 group-hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-xs transition-transform duration-300 group-hover:scale-110">
                <BarChart3 className="size-6 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Tableau de bord</CardTitle>
                <ArrowRight className="size-4 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualisez les statistiques et graphiques en temps réel.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link
          href={`/event/${eventId}/reports`}
          className="group block"
        >
          <Card className="cursor-pointer border-t-2 border-t-transparent shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-t-gold/40 group-hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-gold/70 shadow-xs transition-transform duration-300 group-hover:scale-110">
                <FileText className="size-6 text-white" />
              </div>
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Rapports</CardTitle>
                <ArrowRight className="size-4 text-gold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Générez des PDF et exports CSV professionnels.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
