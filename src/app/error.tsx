"use client";

import { Button } from "@/components/ui/button";

// Boundary d'erreur global, cohérent avec le branding
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold/70">
        <span className="font-serif text-3xl font-bold text-white">GM</span>
      </div>
      <p className="font-serif text-7xl font-bold text-gold">Oups</p>
      <h1 className="mt-4 font-serif text-2xl text-foreground">
        Une erreur est survenue
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Un problème inattendu s&rsquo;est produit. Vous pouvez réessayer.
      </p>
      <Button className="mt-8" onClick={reset}>
        Réessayer
      </Button>
    </main>
  );
}