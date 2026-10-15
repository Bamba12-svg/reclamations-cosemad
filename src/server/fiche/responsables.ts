import "server-only";
import type { Prisma } from "@/generated/prisma/client";

export interface ResponsablePossible {
  id: string;
  nom: string;
  libelle: string; // « Cheikh Sy (responsable) », « Fatou Sarr (QHSE) »
}

type Lecteur = Pick<Prisma.TransactionClient, "activite" | "user">;

/**
 * Personnes à qui confier une réclamation ou une action de l'activité (liste de la maquette) :
 * le responsable de l'activité d'abord, puis les membres de ses équipes, puis le Service QHSE.
 * Comptes actifs uniquement.
 */
export async function responsablesPossibles(
  client: Lecteur,
  activiteId: string,
): Promise<ResponsablePossible[]> {
  // Requêtes l'une après l'autre : dans une transaction, une connexion ne traite qu'une requête à la fois.
  const activite = await client.activite.findUnique({
    where: { id: activiteId },
    select: {
      responsable: { select: { id: true, nom: true, actif: true } },
      equipes: {
        orderBy: { ordre: "asc" },
        select: {
          membres: {
            select: { user: { select: { id: true, nom: true, actif: true } } },
          },
        },
      },
    },
  });
  const qhse = await client.user.findMany({
    where: { role: "QHSE", actif: true },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
  const liste: ResponsablePossible[] = [];
  const vus = new Set<string>();
  const ajouter = (u: { id: string; nom: string }, suffixe = "") => {
    if (vus.has(u.id)) return;
    vus.add(u.id);
    liste.push({ id: u.id, nom: u.nom, libelle: u.nom + suffixe });
  };
  if (activite?.responsable?.actif)
    ajouter(activite.responsable, " (responsable)");
  const membres = (activite?.equipes ?? [])
    .flatMap((e) => e.membres.map((m) => m.user))
    .filter((u) => u.actif)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  for (const u of membres) ajouter(u);
  for (const u of qhse) ajouter(u, " (QHSE)");
  return liste;
}
