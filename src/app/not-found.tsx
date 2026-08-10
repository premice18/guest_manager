import Link from "next/link";
import { Button } from "@/components/ui/button";

// Page 404 personnalisée avec le branding de l'application
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold/70">
        <span className="font-serif text-3xl font-bold text-white">GM</span>
      </div>
      <p className="font-serif text-7xl font-bold text-gold">404</p>
      <h1 className="mt-4 font-serif text-2xl text-foreground">
        Page introuvable
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        La ressource demandée n&rsquo;existe pas ou a été déplacée.
      </p>
      <Link href="/dashboard" className="mt-8">
        <Button>Retour au tableau de bord</Button>
      </Link>
    </main>
  );
}