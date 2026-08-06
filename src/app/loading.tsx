// Écran de chargement global (remplace automatiquement le contenu pendant le fetch)
export default function Loading() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <div className="relative flex size-20 items-center justify-center rounded-2xl border border-gold/30 bg-white/50">
        <div className="size-10 animate-spin rounded-full border-3 border-gold/25 border-t-gold" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="font-serif text-lg text-deep-black">Chargement</p>
        <div className="flex gap-1.5">
          <span className="size-2 animate-pulse rounded-full bg-gold/70" />
          <span className="size-2 animate-pulse rounded-full bg-gold/70 [animation-delay:150ms]" />
          <span className="size-2 animate-pulse rounded-full bg-gold/70 [animation-delay:300ms]" />
        </div>
      </div>
    </main>
  );
}