import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { analyserNumero } from "@/server/domaine/numerotation";
import { societesPortail } from "@/server/portail";

export const dynamic = "force-dynamic";

/**
 * Lien du SMS (reclamations.cosemad.sn/suivi) : ouvre le suivi de la bonne société.
 * Le préfixe du numéro (?numero=FLS-…) l'emporte, sinon la dernière société consultée.
 */
export default async function SuiviGenerique({ searchParams }: { searchParams: Promise<{ numero?: string }> }) {
  const [{ numero }, societes, jar] = await Promise.all([searchParams, societesPortail(), cookies()]);
  const prefixe = numero ? analyserNumero(numero)?.prefixe : undefined;
  const parPrefixe = prefixe ? await societeParCode(prefixe) : undefined;
  const memorisee = jar.get("cosemad_portail")?.value;
  const cible = parPrefixe ?? societes.find((s) => s.slug === memorisee)?.slug ?? societes[0]?.slug;
  redirect(`/${cible ?? ""}/suivi${numero ? `?numero=${encodeURIComponent(numero)}` : ""}`);
}

async function societeParCode(code: string): Promise<string | undefined> {
  return (await db.societe.findUnique({ where: { code }, select: { slug: true } }))?.slug;
}
