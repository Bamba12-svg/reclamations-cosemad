import { notFound, redirect } from "next/navigation";
import { exigerActeur, slugParDefaut } from "@/server/session";

/** /bo → société mémorisée ou première société accessible. */
export default async function Accueil() {
  const acteur = await exigerActeur();
  const slug = await slugParDefaut(acteur);
  if (!slug) notFound();
  redirect(`/bo/${slug}`);
}
