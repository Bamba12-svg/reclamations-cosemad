"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";
import { db } from "@/server/db";
import { modeDemo } from "@/server/demo";
import { journaliser } from "@/server/journal";
import { acteurCourant, COOKIE_SOCIETE } from "@/server/session";

export async function seDeconnecter(): Promise<void> {
  const acteur = await acteurCourant();
  if (acteur) await journaliser(db, { action: "auth.deconnexion", entite: "User", entiteId: acteur.id, userId: acteur.id });
  await signOut({ redirectTo: "/bo/connexion" });
}

/** Mode démonstration : se reconnecter sous un autre profil (menu « Simuler un profil »). */
export async function simulerProfil(userId: string, slug: string): Promise<void> {
  if (!modeDemo()) throw new Error("Mode démonstration désactivé.");
  if (!(await acteurCourant())) throw new Error("Session expirée.");
  await signIn("demo", { userId, redirectTo: `/bo/${slug}` });
}

/** Mémorise la société choisie (préselectionnée à la prochaine connexion). */
export async function memoriserSociete(slug: string): Promise<void> {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return;
  (await cookies()).set(COOKIE_SOCIETE, slug, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax" });
}
