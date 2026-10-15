import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { societesPortail } from "@/server/portail";

export const dynamic = "force-dynamic";

/** Racine du portail : dernière société consultée, sinon la première (Carrefour Médical). */
export default async function Racine() {
  const [societes, jar] = await Promise.all([societesPortail(), cookies()]);
  const memorisee = jar.get("cosemad_portail")?.value;
  const cible = societes.find((s) => s.slug === memorisee) ?? societes[0];
  if (!cible) return <p className="p-6">Aucune société n&apos;est configurée : lancez « npm run db:seed ».</p>;
  redirect(`/${cible.slug}`);
}
