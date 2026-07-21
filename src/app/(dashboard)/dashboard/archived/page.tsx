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
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Archive, Calendar, MapPin } from "lucide-react";

// Page listant les événements archivés
export default async function ArchivedEventsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Récupère uniquement les événements archivés
  let events: { id: string; name: string; event_date: string; location: string | null }[] = [];
  try {
    const { data } = await supabase
      .from("events")
      .select("id, name, event_date, location")
      .eq("owner_id", user.id)
      .eq("is_archived", true)
      .order("event_date", { ascending: false });
    events = data ?? [];
  } catch {
    events = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Retour au tableau de bord
      </Link>

      {/* En-tête de page avec icône */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/20">
          <Archive className="size-6 text-gold" />
        </div>
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-deep-black">
            Événements archivés
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length} événement{events.length !== 1 ? "s" : ""} archivé
            {events.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {events.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.id}`}
              className="group block"
            >
              <Card className="h-full cursor-pointer border-l-2 border-l-transparent bg-white/80 shadow-sm ring-1 ring-foreground/5 transition-all duration-300 group-hover:border-l-gold/60 group-hover:-translate-y-1 group-hover:bg-white group-hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg text-deep-black/70 group-hover:text-deep-black">
                      <Archive className="size-4 text-muted-foreground/60" />
                      {event.name}
                    </CardTitle>
                    {/* Badge Archivé */}
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground ring-1 ring-border uppercase">
                      Archivé
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                    <Calendar className="size-4" />
                    {formatDate(event.event_date)}
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
                      <MapPin className="size-4" />
                      {event.location}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        // État vide : aucun événement archivé
        <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-white p-12 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br from-gold/8 to-transparent" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 size-28 rounded-full bg-gradient-to-tr from-gold/8 to-transparent" />
          <div className="relative">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-gold/20 to-gold/5 ring-1 ring-gold/20">
              <Archive className="size-8 text-gold" />
            </div>
            <h2 className="font-serif text-xl text-deep-black">
              Aucun événement archivé
            </h2>
            <p className="mt-2 text-muted-foreground">
              Les événements terminés apparaîtront ici une fois archivés.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block">
              <Button
                variant="outline"
                size="lg"
                className="transition-all duration-200 hover:shadow-md active:scale-[0.97]"
              >
                <ArrowLeft className="mr-2 size-4" />
                Retour au tableau de bord
              </Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
