import type { Metadata } from "next";
import { AccesReserve, EnTetePage } from "@/components/bo/en-tete-page";
import { ORIGINES } from "@/lib/libelles";
import { db } from "@/server/db";
import { aLaPermission } from "@/server/droits/permissions";
import { responsablesPossibles } from "@/server/fiche/responsables";
import { exigerSociete } from "@/server/session";
import { FormulaireNouvelle } from "./formulaire";

export const metadata: Metadata = { title: "Nouvelle réclamation" };

export default async function NouvelleReclamation({ params }: { params: Promise<{ societe: string }> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const titre = (
    <EnTetePage
      titre="Nouvelle réclamation"
      sousTitre="Pour une réclamation reçue par téléphone, à l'oral, par courrier ou par mail. Le client recevra son numéro par SMS."
    />
  );
  if (!aLaPermission(acteur, "reclamation.creer")) {
    return (
      <section className="flex max-w-224 flex-col gap-6">
        {titre}
        <AccesReserve message="La saisie des réclamations est réservée à l'accueil et au Service QHSE." />
      </section>
    );
  }

  const activites = await db.activite.findMany({
    where: { societeId: societe.id, actif: true },
    orderBy: { ordre: "asc" },
    select: { id: true, nomCourt: true, icone: true, responsable: { select: { id: true, nom: true, actif: true } } },
  });
  const choix = await Promise.all(
    activites.map(async (a) => ({
      id: a.id,
      nom: a.nomCourt,
      icone: a.icone,
      responsable: a.responsable?.actif ? { id: a.responsable.id, nom: a.responsable.nom } : null,
      responsables: (await responsablesPossibles(db, a.id)).map((p) => ({ id: p.id, libelle: p.libelle })),
    })),
  );
  const maintenant = new Date(); // Dakar = UTC
  return (
    <section className="flex max-w-224 flex-col gap-6">
      {titre}
      <FormulaireNouvelle slug={slug} activites={choix} origines={[...ORIGINES]} jour={maintenant.toISOString().slice(0, 10)} heure={maintenant.toISOString().slice(11, 16)} />
    </section>
  );
}
