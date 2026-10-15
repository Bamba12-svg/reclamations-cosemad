"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { saisirReclamation, type ResultatSaisie } from "@/server/saisie";
import { exigerSociete } from "@/server/session";
import { TAILLE_MAX_OCTETS } from "@/server/stockage/controle";

/** Enregistre la réclamation saisie à l'accueil, puis ouvre sa fiche avec la confirmation envoyée au client. */
export async function enregistrerReclamation(slug: string, donnees: FormData): Promise<ResultatSaisie> {
  const { acteur, societe } = await exigerSociete(slug);
  let saisie: unknown;
  try {
    saisie = JSON.parse(String(donnees.get("saisie") ?? "{}"));
  } catch {
    return { ok: false, erreur: "Formulaire illisible. Rechargez la page." };
  }
  const fichiers = donnees.getAll("fichiers").filter((f): f is File => f instanceof File && f.size > 0);
  if (fichiers.some((f) => f.size > TAILLE_MAX_OCTETS)) return { ok: false, erreur: "Chaque fichier doit faire 10 Mo au maximum." };
  const lus = await Promise.all(fichiers.map(async (f) => ({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) })));
  const h = await headers();
  let resultat: ResultatSaisie;
  try {
    resultat = await saisirReclamation(acteur, societe.id, saisie, lus, {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent"),
    });
  } catch (e) {
    console.error("[saisie]", e);
    return { ok: false, erreur: "La réclamation n'a pas pu être enregistrée. Réessayez dans un instant." };
  }
  if (!resultat.ok) return resultat;
  revalidatePath(`/bo/${slug}`, "layout");
  redirect(`/bo/${slug}/reclamations/${resultat.numero}?nouvelle=1`);
}
