import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeStatut } from "@/components/bo/badge-statut";
import { EnTetePage } from "@/components/bo/en-tete-page";
import { IconeTrace } from "@/components/icone";
import { LIBELLE_MODE, LIBELLE_STATUT, MODES_TRANSMISSION, STATUTS_RECLAMATION } from "@/lib/libelles";
import { aLaPermission } from "@/server/droits/permissions";
import { chargerSuivi, COLONNES_SUIVI, LIGNES_PAR_PAGE, lireFiltres, ongletsSuivi, responsablesSuivi } from "@/server/requetes/suivi";
import { exigerSociete } from "@/server/session";
import { BarreFiltres, LigneCliquable } from "./filtres";

export const metadata: Metadata = { title: "Tableau de suivi" };

// Largeurs des 14 colonnes (maquette B3).
const LARGEURS = ["8.75rem", "7.5rem", "12rem", "8rem", "16rem", "14rem", "16rem", "9rem", "8rem", "14rem", "6.5rem", "7.5rem", "12rem", "8.75rem"];

type Params = Record<string, string | string[] | undefined>;

export default async function TableauDeSuivi({ params, searchParams }: { params: Promise<{ societe: string }>; searchParams: Promise<Params> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const brut = await searchParams;
  const filtres = lireFiltres(brut);
  const [{ total, lignes }, onglets, responsables] = await Promise.all([
    chargerSuivi(acteur, societe.id, filtres),
    ongletsSuivi(acteur, societe.id),
    responsablesSuivi(societe.id),
  ]);

  const base = `/bo/${slug}/reclamations`;
  const requete = (surcharge: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtres, page: undefined, ...surcharge })) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    return p.size ? `?${p}` : "";
  };
  const pages = Math.max(1, Math.ceil(total / LIGNES_PAR_PAGE));
  const peutExporter = aLaPermission(acteur, "reclamation.exporter");

  const options = {
    statut: STATUTS_RECLAMATION.map((s) => ({ valeur: s, libelle: LIBELLE_STATUT[s] })),
    type: [
      { valeur: "PRODUIT", libelle: "Produit" },
      { valeur: "SERVICE", libelle: "Service" },
      { valeur: "AUTRE", libelle: "Autre" },
    ],
    mode: MODES_TRANSMISSION.map((m) => ({ valeur: m, libelle: LIBELLE_MODE[m] })),
    responsable: responsables.map((r) => ({ valeur: r.id, libelle: r.nom })),
    recurrent: [
      { valeur: "oui", libelle: "Récurrent : oui" },
      { valeur: "non", libelle: "Récurrent : non" },
    ],
  };

  const bouton =
    "inline-flex min-h-11 items-center gap-2 rounded-champ border border-bord-fort bg-surface px-4 text-[0.9375rem] font-semibold text-encre-2 no-underline hover:bg-surface-2 hover:text-encre-2";

  return (
    <section className="flex flex-col gap-5">
      <EnTetePage
        titre="Tableau de suivi des réclamations"
        sousTitre="Même structure que le tableau Excel. Cliquez sur une ligne pour ouvrir la fiche."
        actions={
          peutExporter && (
            <div className="flex flex-wrap gap-2">
              <a href={`${base}/export/excel${requete({})}`} className={bouton} download>
                <IconeTrace d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" taille={18} />
                Exporter Excel
              </a>
              <a href={`${base}/export/pdf${requete({})}`} className={bouton} download>
                <IconeTrace d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4" taille={18} />
                Exporter PDF
              </a>
            </div>
          )
        }
      />

      <nav aria-label="Activités" className="flex gap-1 overflow-x-auto border-b border-bord">
        {onglets.map((o) => {
          const actif = (filtres.activite ?? "") === o.code;
          return (
            <Link
              key={o.code || "toutes"}
              href={`${base}${requete({ activite: o.code || undefined })}`}
              aria-current={actif ? "page" : undefined}
              scroll={false}
              className={`-mb-px flex min-h-11.5 items-center gap-2 border-b-2 px-4 text-[0.9375rem] font-semibold whitespace-nowrap no-underline hover:text-marque ${
                actif ? "border-marque text-marque" : "border-transparent text-encre-3"
              }`}
            >
              {o.libelle}
              <span className="rounded-full bg-surface-3 px-1.75 text-xs leading-5.5 text-encre-2 tabular-nums">{o.nombre}</span>
            </Link>
          );
        })}
      </nav>

      <Suspense>
        <BarreFiltres options={options} total={total} />
      </Suspense>

      <div className="overflow-hidden rounded-carte border border-bord bg-surface shadow-carte">
        <div className="max-h-[calc(100vh-19rem)] min-h-72 overflow-auto text-sm">
          <table className="w-max min-w-full table-fixed border-collapse">
            <caption className="sr-only">
              Réclamations {societe.nom}, {total} résultat{total > 1 ? "s" : ""}
            </caption>
            <colgroup>
              {LARGEURS.map((l, i) => (
                <col key={i} style={{ width: l }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20 bg-fond text-left text-xs font-semibold tracking-[0.03em] text-encre-3 uppercase">
              <tr className="border-b border-bord">
                {COLONNES_SUIVI.map((c, i) => (
                  <th key={c} scope="col" className={`px-3.5 py-3 align-bottom font-semibold ${i === 0 ? "sticky left-0 z-10 bg-fond pl-4.25" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => {
                const enRetard = l.statut === "EN_RETARD";
                const tronque = "truncate px-3.5 text-encre-2";
                return (
                  <LigneCliquable key={l.numero} href={`${base}/${l.numero}`} enRetard={enRetard}>
                    <td className={`sticky left-0 z-10 h-13 border-l-3 bg-inherit px-3.5 font-semibold whitespace-nowrap tabular-nums ${enRetard ? "border-retard" : "border-transparent"}`}>
                      <Link href={`${base}/${l.numero}`} className="text-marque no-underline group-hover:underline">
                        {l.numero}
                      </Link>
                    </td>
                    <td className="px-3.5 tabular-nums">{l.date}</td>
                    <td className="truncate px-3.5 font-medium" title={l.client}>
                      {l.client}
                    </td>
                    <td className="truncate px-3.5 text-encre-2" title={l.mode}>{l.mode}</td>
                    <td className={tronque} title={l.description}>
                      {l.description}
                    </td>
                    <td className={tronque} title={l.causes || undefined}>
                      {l.causes || "—"}
                    </td>
                    <td className={tronque} title={l.actions || undefined}>
                      {l.actions || "—"}
                    </td>
                    <td className={`truncate px-3.5 ${l.responsable === "Non affectée" ? "text-encre-4 italic" : ""}`}>{l.responsable}</td>
                    <td className="truncate px-3.5 tabular-nums" title={l.echeances || undefined}>
                      {l.echeances || "—"}
                    </td>
                    <td className={tronque} title={l.criteres || undefined}>
                      {l.criteres || "—"}
                    </td>
                    <td className="px-3.5">{l.efficacite || "—"}</td>
                    <td className="px-3.5 tabular-nums">{l.cloture || "—"}</td>
                    <td className={tronque} title={l.observations || undefined}>
                      {l.observations || "—"}
                    </td>
                    <td className="px-3.5">
                      <BadgeStatut statut={l.statut} />
                    </td>
                  </LigneCliquable>
                );
              })}
            </tbody>
          </table>

          {lignes.length === 0 && (
            <div className="sticky left-0 flex w-[min(100%,calc(100vw-4rem))] flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-surface-3 text-encre-3">
                <IconeTrace d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" taille={22} />
              </span>
              <p className="m-0 text-base font-semibold">Aucune réclamation ne correspond</p>
              <p className="m-0 max-w-96 text-encre-3">Modifiez ou effacez les filtres pour voir plus de résultats.</p>
              <Link href={`${base}${filtres.activite ? `?activite=${filtres.activite}` : ""}`} className={bouton}>
                Effacer les filtres
              </Link>
            </div>
          )}
        </div>
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
          <span className="text-encre-3 tabular-nums">
            Page {filtres.page} sur {pages}
          </span>
          <div className="flex gap-2">
            {filtres.page > 1 && (
              <Link href={`${base}${requete({ page: String(filtres.page - 1) })}`} className={bouton}>
                Précédente
              </Link>
            )}
            {filtres.page < pages && (
              <Link href={`${base}${requete({ page: String(filtres.page + 1) })}`} className={bouton}>
                Suivante
              </Link>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}
