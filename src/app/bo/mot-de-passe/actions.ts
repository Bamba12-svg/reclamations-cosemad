"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { changerMotDePasseProvisoire } from "@/server/compte";
import { db } from "@/server/db";
import { acteurCourant, slugParDefaut } from "@/server/session";

export interface EtatMotDePasse {
  erreur: string | null;
  champs?: { motDePasse?: string; confirmation?: string };
}

export async function choisirMotDePasse(_precedent: EtatMotDePasse, donnees: FormData): Promise<EtatMotDePasse> {
  const acteur = await acteurCourant();
  if (!acteur) redirect("/bo/connexion");
  const h = await headers();
  const ctx = { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
  const r = await changerMotDePasseProvisoire(
    db,
    acteur.id,
    { motDePasse: String(donnees.get("motDePasse") ?? ""), confirmation: String(donnees.get("confirmation") ?? "") },
    ctx,
  );
  if (!r.ok) return { erreur: r.erreur, champs: r.champs };
  const slug = await slugParDefaut(acteur);
  redirect(slug ? `/bo/${slug}` : "/bo");
}
