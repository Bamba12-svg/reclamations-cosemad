"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { cookies } from "next/headers";
import { signIn } from "@/auth";
import { COOKIE_SOCIETE } from "@/server/session";

export interface EtatConnexion {
  erreur: string | null;
}

const SLUG = /^[a-z0-9-]{2,40}$/;

export async function seConnecter(_precedent: EtatConnexion, donnees: FormData): Promise<EtatConnexion> {
  const email = String(donnees.get("email") ?? "").trim();
  const motDePasse = String(donnees.get("motDePasse") ?? "");
  const societe = String(donnees.get("societe") ?? "");
  if (!email || !motDePasse) return { erreur: !motDePasse ? "Saisissez votre mot de passe." : "Saisissez votre e-mail professionnel." };

  const slug = SLUG.test(societe) ? societe : "";
  if (slug) {
    (await cookies()).set(COOKIE_SOCIETE, slug, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax", httpOnly: false });
  }

  try {
    await signIn("identifiants", { email, motDePasse, redirectTo: slug ? `/bo/${slug}` : "/bo" });
    return { erreur: null };
  } catch (erreur) {
    if (erreur instanceof CredentialsSignin && erreur.code === "bloque") {
      return { erreur: "Trop de tentatives. Réessayez dans 15 minutes ou contactez le Service QHSE." };
    }
    if (erreur instanceof AuthError) return { erreur: "E-mail ou mot de passe incorrect." };
    throw erreur; // redirection après succès (NEXT_REDIRECT) ou erreur inattendue
  }
}
