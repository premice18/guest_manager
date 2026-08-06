import { NextResponse } from "next/server";

// Endpoint de healthcheck : vérifie que la plateforme (Supabase) répond.
// Utilisé par le monitoring / l'orchestrateur pour détecter les 500 au plus vite.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return NextResponse.json({ status: "error", db: "MISSING_URL" }, { status: 503 });
  }
  try {
    // Un appel HEAD/REST vers Supabase vérifie la connectivité sans transmettre
    // de PII. Une réponse 4xx signale quand même que le backend est joignable.
    const res = await fetch(`${url}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      signal: AbortSignal.timeout(5000),
    });
    const reachable = res.status >= 200 && res.status < 500;
    return NextResponse.json({ status: reachable ? "ok" : "error", db: reachable ? "ok" : "unreachable" }, {
      status: reachable ? 200 : 503,
    });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}