import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Archive, Calendar, MapPin, Users, UserCheck, UserX } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { EventStatusBadge } from "@/components/event/event-status-badge";

// Calcule la couleur de la barre de progression selon le taux de présence
function progressColor(rate: number): string {
  if (rate >= 75) return "bg-success";
  if (rate >= 50) return "bg-gold";
  if (rate >= 25) return "bg-warning";
  return "bg-error";
}

// Composant d'affichage des métriques pour une carte événement
function GuestMetrics({
  metrics,
}: {
  metrics: { total: number; present: number };
}) {
  const { total, present } = metrics;
  const remaining = total - present;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;
  const barColor = progressColor(rate);

  return (
    <div className="space-y-3">
      {/* Ligne des trois compteurs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="size-3.5 text-anthracite/60" />
          <span className="font-medium text-anthracite">{total}</span>
          <span className="text-muted-foreground">total</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <UserCheck className="size-3.5 text-success" />
          <span className="font-medium text-success">{present}</span>
          <span className="text-muted-foreground">présents</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <UserX className="size-3.5 text-warning" />
          <span className="font-medium text-warning">{remaining}</span>
          <span className="text-muted-foreground">restants</span>
        </div>
      </div>
      {/* Barre de progression et pourcentage */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-anthracite/10" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Taux de présence : ${rate}%`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${rate}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-anthracite/70">
            {rate}%
          </span>
        </div>
      )}
    </div>
  );
}

// Page d'accueil du dashboard : liste des événements de l'utilisateur
export default async function DashboardPage() {
  const supabase = await createClient();

  // Récupère l'utilisateur connecté
  let user;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    redirect("/login");
  }
  if (!user) redirect("/login");

  // Récupère les événements non archivés de l'utilisateur.
  // NB (fix audit) : ne PAS filtrer par owner_id — la RLS events_select_policy
  // autorise déjà owner ET staff (hosts/admins). Un filtre owner_id = user.id
  // rendait les événements partagés invisibles pour les staff non-propriétaires.
  let events: { id: string; name: string; event_date: string; location: string | null; is_archived: boolean }[] = [];
  try {
    const { data } = await supabase
      .from("events")
      .select("id, name, event_date, location, is_archived")
      .eq("is_archived", false)
      .order("event_date", { ascending: true });
    events = data ?? [];
  } catch {
    events = [];
  }

  // Récupère les métriques d'invités (total + présents) pour tous les événements
  const guestMetrics: Record<string, { total: number; present: number }> = {};
  try {
    const { data: counts } = await supabase
      .from("guests")
      .select("event_id, id, is_present")
      .in("event_id", events.map((e) => e.id));
    for (const g of counts ?? []) {
      if (!guestMetrics[g.event_id]) {
        guestMetrics[g.event_id] = { total: 0, present: 0 };
      }
      guestMetrics[g.event_id].total++;
      if (g.is_present) {
        guestMetrics[g.event_id].present++;
      }
    }
  } catch {
    // Silencieux
  }

  // Action serveur : déconnexion
  const handleLogout = async () => {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  };

    return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* En-tête avec titre et bouton de création */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-deep-black">
            Mes événements
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {events.length} événement{events.length !== 1 ? "s" : ""} à venir
          </p>
        </div>
        <div className="flex gap-3">
          <form action={handleLogout}>
            <Button type="submit" variant="outline" size="sm">
              Se déconnecter
            </Button>
          </form>
          <Link href="/dashboard/create">
            <Button
              size="sm"
              className="bg-gold text-deep-black shadow-sm transition-all duration-200 hover:bg-gold/90 hover:shadow-md active:scale-[0.97]"
            >
              <Plus className="mr-1.5 size-4" />
              Nouvel événement
            </Button>
          </Link>
        </div>
      </div>

      {/* Liste des événements sous forme de grille de cartes */}
      {events.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            return (
              <Link
                key={event.id}
                href={`/event/${event.id}`}
                className="group block"
              >
                <Card className="h-full cursor-pointer border-l-2 border-l-transparent bg-white shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:border-l-gold group-hover:-translate-y-1 group-hover:shadow-lg">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg font-semibold text-deep-black">
                        {event.name}
                      </CardTitle>
                      {/* Badge de statut (calculé côté client, fuseau de l'utilisateur) */}
                      <EventStatusBadge eventDate={event.event_date} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="size-4 text-gold/60" />
                      {formatDate(event.event_date)}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="size-4 text-gold/60" />
                        {event.location}
                      </div>
                    )}
                    {/* Métriques d'invités */}
                    <GuestMetrics metrics={guestMetrics[event.id] ?? { total: 0, present: 0 }} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        // État vide : premier événement
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-white p-12 text-center">
          {/* Éléments décoratifs en arrière-plan */}
          <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-gradient-to-br from-gold/8 to-transparent" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 size-28 rounded-full bg-gradient-to-tr from-gold/8 to-transparent" />
          <div className="relative">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/20">
              <Calendar className="size-8 text-gold" />
            </div>
            <h2 className="font-serif text-xl text-deep-black">
               Bienvenue sur Guest Manager
            </h2>
            <p className="mt-2 text-muted-foreground">
              Créez votre premier événement pour commencer à gérer vos invités.
            </p>
            <Link href="/dashboard/create" className="mt-6 inline-block">
              <Button
                size="lg"
                className="bg-gold text-deep-black shadow-sm transition-all duration-200 hover:bg-gold/90 hover:shadow-md active:scale-[0.97]"
              >
                <Plus className="mr-2 size-5" />
                Créer un événement
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Lien vers les événements archivés */}
      <div className="mt-10 text-center">
        <Link
          href="/dashboard/archived"
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-gold"
        >
          <Archive className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
          Voir les événements archivés
        </Link>
      </div>
    </main>
  );
}
