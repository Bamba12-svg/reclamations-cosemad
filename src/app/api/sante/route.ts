import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Point de contrôle utilisé après chaque mise en ligne : l'application répond et la base est joignable. */
export async function GET() {
  try {
    const [ligne] = await db.$queryRaw<{ version: string }[]>`SELECT current_setting('server_version') AS version`;
    return NextResponse.json({ statut: "ok", baseDeDonnees: { joignable: true, postgresql: ligne?.version.split(" ")[0] ?? null } });
  } catch (erreur) {
    console.error("[sante] base injoignable", erreur);
    return NextResponse.json({ statut: "degrade", baseDeDonnees: { joignable: false } }, { status: 503 });
  }
}
