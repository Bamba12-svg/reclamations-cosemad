import type { Metadata } from "next";
import { AccesReserve, EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { aLaPermission } from "@/server/droits/permissions";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "Nouvelle réclamation" };

export default async function NouvelleReclamation({ params }: { params: Promise<{ societe: string }> }) {
  const { acteur } = await exigerSociete((await params).societe);
  return (
    <section className="flex max-w-224 flex-col gap-6">
      <EnTetePage
        titre="Nouvelle réclamation"
        sousTitre="Pour une réclamation reçue par téléphone, à l'oral, par courrier ou par mail. Le client recevra son numéro par SMS."
      />
      {aLaPermission(acteur, "reclamation.creer") ? (
        <EcranAVenir etape={7} contenu="Mode de transmission, origine, date et heure réelles, activité (responsable proposé), type, détails, 3 pièces jointes, SMS au client." />
      ) : (
        <AccesReserve message="La saisie des réclamations est réservée à l'accueil et au Service QHSE." />
      )}
    </section>
  );
}
