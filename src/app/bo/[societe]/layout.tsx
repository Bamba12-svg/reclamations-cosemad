import { LIBELLE_ROLE } from "@/lib/libelles";
import { db } from "@/server/db";
import { modeDemo } from "@/server/demo";
import { aLaPermission } from "@/server/droits/permissions";
import { donneesCoquille } from "@/server/requetes/coquille";
import { exigerSociete, societesAccessibles } from "@/server/session";
import { Coquille, type ProfilDemo } from "./coquille";

export const dynamic = "force-dynamic";

function initiales(nom: string): string {
  return nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function MiseEnPageBackOffice({ children, params }: { children: React.ReactNode; params: Promise<{ societe: string }> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const [societes, coquille, profils] = await Promise.all([
    societesAccessibles(acteur),
    donneesCoquille(acteur, societe.id),
    modeDemo() ? profilsDemo(societe.id) : Promise.resolve(null),
  ]);

  return (
    <Coquille
      societe={{ slug: societe.slug, nom: societe.nom, logo: societe.logo }}
      societes={societes.map((s) => ({ slug: s.slug, nom: s.nom, domaine: s.domaine }))}
      utilisateur={{ id: acteur.id, nom: acteur.nom, role: LIBELLE_ROLE[acteur.role], initiales: initiales(acteur.nom) }}
      compteurs={coquille.compteurs}
      notifications={coquille.notifications}
      peutCreer={aLaPermission(acteur, "reclamation.creer")}
      peutParametrer={aLaPermission(acteur, "parametres.gerer")}
      profils={profils}
    >
      {children}
    </Coquille>
  );
}

/** Profils proposés par « Simuler un profil » : comptes du groupe + responsables des activités de la société. */
async function profilsDemo(societeId: string): Promise<ProfilDemo[]> {
  const [groupe, responsables] = await Promise.all([
    db.user.findMany({ where: { toutesSocietes: true, actif: true }, select: { id: true, nom: true, role: true } }),
    db.activite.findMany({
      where: { societeId },
      orderBy: { ordre: "asc" },
      select: { nom: true, responsable: { select: { id: true, nom: true, actif: true } } },
    }),
  ]);
  const ordre = ["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "DIRECTION_GENERALE"];
  const deGroupe = groupe
    .sort((a, b) => ordre.indexOf(a.role) - ordre.indexOf(b.role))
    .map((u) => ({ id: u.id, nom: u.nom, role: LIBELLE_ROLE[u.role], initiales: initiales(u.nom) }));
  const dg = deGroupe.filter((p) => p.role === LIBELLE_ROLE.DIRECTION_GENERALE);
  const resp = responsables
    .filter((a) => a.responsable?.actif)
    .map((a) => ({ id: a.responsable!.id, nom: a.responsable!.nom, role: `Responsable – ${a.nom}`, initiales: initiales(a.responsable!.nom) }));
  return [...deGroupe.filter((p) => !dg.includes(p)), ...resp, ...dg];
}
