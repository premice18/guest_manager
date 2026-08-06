// Valide que la cible de redirection est un chemin local (évite l'open redirect).
// Rejette les URLs absolues, les protocoles et les chemins protocol-relative (//...)
// ainsi que tout chemin qui imite une URL absolue (ex: /\/evil.com).
export function isSafeRedirect(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\")) return false;
  try {
    const url = new URL(value, "http://localhost");
    return url.origin === "http://localhost";
  } catch {
    return false;
  }
}