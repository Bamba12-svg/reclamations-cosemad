import type { Metadata } from "next";
import { AccesReserve, EcranAVenir, EnTetePage } from "@/components/bo/en-tete-page";
import { aLaPermission } from "@/server/droits/permissions";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Parametres({ params }: { params: Promise<{ societe: string }> }) {
  const { acteur } = await exigerSociete((await params).societe);
  return (
    <section className="flex max-w-256 flex-col gap-5">
      <EnTetePage titre="Paramètres" sousTitre="Réservé au Service QHSE." />
      {aLaPermission(acteur, "parametres.gerer") ? (
        <EcranAVenir etape={10} contenu="Activités et équipes, utilisateurs et rôles, délais cibles, modèles SMS et e-mail." />
      ) : (
        <AccesReserve message="Les paramètres sont réservés au Service QHSE." />
      )}
    </section>
  );
}
