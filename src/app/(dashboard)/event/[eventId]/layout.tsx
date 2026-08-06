import { notFound, redirect } from "next/navigation";
import { AuthError, requireEventAccess } from "@/lib/auth";

// Garde d'accès : toutes les pages d'un événement vérifient que l'utilisateur
// courant est propriétaire ou membre du staff avant de rendre le contenu.
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  try {
    await requireEventAccess(eventId, "any");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/login");
      if (err.status === 404) notFound();
      redirect("/dashboard");
    }
    redirect("/dashboard");
  }

  return <>{children}</>;
}