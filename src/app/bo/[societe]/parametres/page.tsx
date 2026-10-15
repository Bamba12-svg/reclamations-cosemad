import type { Metadata } from "next";
import Link from "next/link";
import { AccesReserve, EnTetePage } from "@/components/bo/en-tete-page";
import { modeDemo } from "@/server/demo";
import { aLaPermission } from "@/server/droits/permissions";
import { donneesParametres, personnesActivites } from "@/server/parametres";
import { exigerSociete } from "@/server/session";
import { OngletActivites } from "./onglet-activites";
import { OngletDelais } from "./onglet-delais";
import { OngletModeles } from "./onglet-modeles";
import { OngletUtilisateurs } from "./onglet-utilisateurs";
import { Reinitialiser, ZoneParametres } from "./zone";

export const metadata: Metadata = { title: "Paramètres" };

const ONGLETS = [
  { cle: "activites", libelle: "Activités et équipes" },
  { cle: "utilisateurs", libelle: "Utilisateurs et rôles" },
  { cle: "delais", libelle: "Délais cibles" },
  { cle: "modeles", libelle: "Modèles SMS et e-mail" },
] as const;

export default async function Parametres({ params, searchParams }: { params: Promise<{ societe: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  if (!aLaPermission(acteur, "parametres.gerer")) {
    return (
      <section className="flex max-w-256 flex-col gap-5">
        <EnTetePage titre="Paramètres" sousTitre="Réservé au Service QHSE." />
        <AccesReserve message="Les paramètres sont réservés au Service QHSE." />
      </section>
    );
  }
  const recherche = await searchParams;
  const onglet = ONGLETS.find((o) => o.cle === recherche.onglet)?.cle ?? "activites";
  const [d, personnes] = await Promise.all([donneesParametres(societe.id), onglet === "activites" ? personnesActivites(societe.id) : Promise.resolve([])]);

  return (
    <ZoneParametres annonce={recherche.reinitialise === "1" ? "Données de démonstration réinitialisées" : null}>
      <section className="flex max-w-256 flex-col gap-5">
        <EnTetePage titre="Paramètres" sousTitre="Réservé au Service QHSE." actions={modeDemo() ? <Reinitialiser slug={slug} /> : undefined} />
        <nav aria-label="Rubriques des paramètres" className="flex flex-wrap gap-1 self-start rounded-carte bg-[#EEF0F3] p-1">
          {ONGLETS.map((o) => (
            <Link
              key={o.cle}
              href={`/bo/${slug}/parametres${o.cle === "activites" ? "" : `?onglet=${o.cle}`}`}
              aria-current={o.cle === onglet ? "page" : undefined}
              scroll={false}
              className={`inline-flex min-h-11 items-center rounded-lg px-4 font-semibold no-underline ${
                o.cle === onglet ? "bg-surface text-encre shadow-[0_1px_2px_rgba(16,24,40,0.08)] hover:text-encre" : "text-encre-3 hover:text-encre"
              }`}
            >
              {o.libelle}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-5 rounded-carte border border-bord bg-surface p-[clamp(1.25rem,2.5vw,1.75rem)] shadow-carte">
          {onglet === "activites" && <OngletActivites slug={slug} societe={d.societe.nom} activites={d.activites} personnes={personnes} icones={d.icones} />}
          {onglet === "utilisateurs" && <OngletUtilisateurs slug={slug} utilisateurs={d.utilisateurs} moi={acteur.id} societe={d.societe.nom} />}
          {onglet === "delais" && <OngletDelais slug={slug} delais={d.delais} feries={d.feries} />}
          {onglet === "modeles" && <OngletModeles slug={slug} modeles={d.modeles} delai={d.delais.delaiReponseJO} societe={d.societe.code} />}
        </div>
      </section>
    </ZoneParametres>
  );
}
