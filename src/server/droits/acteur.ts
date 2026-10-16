import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Acteur } from "./permissions";

/** Charge l'utilisateur et son périmètre. Renvoie null si le compte n'existe pas ou est désactivé. */
export async function chargerActeur(db: PrismaClient, userId: string): Promise<Acteur | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nom: true,
      role: true,
      actif: true,
      toutesSocietes: true,
      doitChangerMotDePasse: true,
      acces: { select: { societeId: true } },
      activitesDirigees: { select: { id: true } },
      equipes: { select: { equipe: { select: { activiteId: true } } } },
    },
  });
  if (!u || !u.actif) return null;
  const dirigees = u.activitesDirigees.map((a) => a.id);
  const membre = u.equipes.map((e) => e.equipe.activiteId);
  return {
    id: u.id,
    nom: u.nom,
    role: u.role,
    toutesSocietes: u.toutesSocietes,
    societeIds: u.acces.map((a) => a.societeId),
    activiteIds: [...new Set([...dirigees, ...membre])],
    activitesDirigeesIds: dirigees,
    doitChangerMotDePasse: u.doitChangerMotDePasse,
  };
}
