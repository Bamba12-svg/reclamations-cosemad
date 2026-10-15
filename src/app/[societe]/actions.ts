"use server";

import { headers } from "next/headers";
import { erreursParChamp } from "@/lib/validation/communs";
import { schemaDepotPortail, schemaSuivi } from "@/lib/validation/portail";
import { enregistrerTentative, estBloque } from "@/server/limiteur";
import { deposerReclamation, suivreReclamation, type FichierRecu, type ResultatDepot, type SuiviClient } from "@/server/portail";

const LIMITE_DEPOT = { maximum: 10, fenetreMs: 60 * 60_000 }; // 10 dépôts par heure et par adresse
const LIMITE_SUIVI = { maximum: 20, fenetreMs: 10 * 60_000 }; // 20 recherches par 10 minutes

async function contexte() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

/** Dépôt du portail : données JSON + fichiers, tout est revalidé ici. */
export async function deposer(formulaire: FormData): Promise<ResultatDepot> {
  const ctx = await contexte();
  // Champ piège invisible : seuls les robots le remplissent.
  if (String(formulaire.get("site") ?? "") !== "") return { ok: false, erreur: "Envoi refusé." };

  const cle = `depot:${ctx.ip ?? "inconnue"}`;
  if (estBloque(cle, LIMITE_DEPOT).bloque) {
    return { ok: false, erreur: "Trop de réclamations envoyées depuis cette connexion. Réessayez dans une heure ou appelez le service client." };
  }

  let brut: unknown;
  try {
    brut = JSON.parse(String(formulaire.get("donnees") ?? "{}"));
  } catch {
    return { ok: false, erreur: "Formulaire illisible. Rechargez la page." };
  }
  const lu = schemaDepotPortail.safeParse(brut);
  if (!lu.success) {
    const champs = erreursParChamp(lu.error);
    return { ok: false, erreur: Object.values(champs)[0] ?? "Vérifiez le formulaire.", champs };
  }

  const fichiers: FichierRecu[] = [];
  for (const f of formulaire.getAll("fichiers")) {
    if (f instanceof File && f.size > 0) fichiers.push({ nom: f.name, octets: new Uint8Array(await f.arrayBuffer()) });
  }

  enregistrerTentative(cle);
  try {
    return await deposerReclamation(lu.data, fichiers, ctx);
  } catch (erreur) {
    console.error("[portail] échec du dépôt", erreur);
    return { ok: false, erreur: "Votre réclamation n'a pas pu être enregistrée. Réessayez dans quelques instants." };
  }
}

export type ResultatSuivi = { ok: true; suivi: SuiviClient } | { ok: false; erreur: string };

export async function suivre(numero: string, telephone: string): Promise<ResultatSuivi> {
  const ctx = await contexte();
  const cle = `suivi:${ctx.ip ?? "inconnue"}`;
  if (estBloque(cle, LIMITE_SUIVI).bloque) return { ok: false, erreur: "Trop de recherches. Réessayez dans quelques minutes." };

  const lu = schemaSuivi.safeParse({ numero, telephone });
  if (!lu.success) return { ok: false, erreur: "Saisissez le numéro de réclamation et votre téléphone à 9 chiffres." };

  const suivi = await suivreReclamation(lu.data.numero, lu.data.telephone);
  if (!suivi) {
    enregistrerTentative(cle); // seuls les échecs comptent : on freine l'énumération des numéros
    return { ok: false, erreur: "Nous ne trouvons pas de réclamation avec ce numéro et ce téléphone. Vérifiez le SMS de confirmation." };
  }
  return { ok: true, suivi };
}
