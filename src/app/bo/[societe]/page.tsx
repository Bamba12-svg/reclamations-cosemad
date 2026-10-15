import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeStatut } from "@/components/bo/badge-statut";
import { LIBELLE_STATUT, type StatutReclamation } from "@/lib/libelles";
import { lireFiltresTableauDeBord, PERIODES, tableauDeBord, type TableauDeBord as Donnees } from "@/server/requetes/tableau-de-bord";
import { exigerSociete } from "@/server/session";
import { FiltresTableau } from "./filtres-tableau";

export const metadata: Metadata = { title: "Tableau de bord" };

const CARTE = "rounded-carte border border-bord bg-surface shadow-carte";
const CHEVRON = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default async function TableauDeBord({ params, searchParams }: { params: Promise<{ societe: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const filtres = lireFiltresTableauDeBord(await searchParams);
  const d = await tableauDeBord(acteur, societe.id, filtres);
  const periode = PERIODES.find((p) => p.valeur === filtres.periode)!;
  const nomActivite = d.activites.find((a) => a.code === filtres.activite)?.nom;
  const liste = (statut?: StatutReclamation) => {
    const p = new URLSearchParams();
    if (filtres.activite) p.set("activite", filtres.activite);
    if (statut) p.set("statut", statut);
    return `/bo/${slug}/reclamations${p.size ? `?${p}` : ""}`;
  };

  const cartesStatut: { statut: StatutReclamation; sousTitre: string; couleur: string }[] = [
    { statut: "EN_COURS", sousTitre: "Actions en cours", couleur: "text-encours" },
    { statut: "EN_RETARD", sousTitre: "Échéance dépassée", couleur: "text-retard" },
    { statut: "TRAITEE", sousTitre: "Clôturées et visées", couleur: "text-traitee" },
  ];
  const lienCarte = `${CARTE} flex min-h-34 flex-col items-start gap-3 px-5 py-4.5 text-left text-encre no-underline hover:border-encre-5 hover:text-encre hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)]`;

  return (
    <section className="@container flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[clamp(1.5rem,1.2rem+1vw,1.875rem)] tracking-[-0.02em]">Tableau de bord</h1>
          {/* Correction de la maquette : elle annonce « du Groupe » alors qu'elle n'affiche qu'une société. */}
          <p className="m-0 text-encre-3">
            Bonjour {acteur.nom}. Voici l&apos;état des réclamations de {societe.nom}.
          </p>
        </div>
        <Suspense>
          <FiltresTableau periodes={PERIODES} activites={d.activites} />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-4 @min-[32.5rem]:grid-cols-3 @min-[66rem]:grid-cols-6">
        <Link href={liste()} className={lienCarte}>
          <span className="text-sm leading-7 font-semibold text-encre-2">Reçues</span>
          <span className="text-4xl leading-none font-bold tracking-[-0.02em] text-marque tabular-nums">{d.recues}</span>
          <span className="flex items-center gap-1 text-[0.8125rem] text-encre-3">
            {nomActivite ?? "Toutes activités confondues"} {CHEVRON}
          </span>
        </Link>
        {cartesStatut.map((c) => (
          <Link key={c.statut} href={liste(c.statut)} className={lienCarte} aria-label={`${LIBELLE_STATUT[c.statut]} : ${d.parStatut[c.statut]}, ${c.sousTitre}`}>
            <BadgeStatut statut={c.statut} />
            <span className={`text-4xl leading-none font-bold tracking-[-0.02em] tabular-nums ${c.couleur}`}>{d.parStatut[c.statut]}</span>
            <span className="flex items-center gap-1 text-[0.8125rem] text-encre-3">
              {c.sousTitre} {CHEVRON}
            </span>
          </Link>
        ))}
        <div className={`${CARTE} flex min-h-34 flex-col items-start gap-3 px-5 py-4.5`}>
          <span className="text-sm leading-7 font-semibold text-encre-2">Délai moyen de clôture</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-4xl leading-none font-bold tracking-[-0.02em] tabular-nums">{d.delaiMoyen === null ? "—" : d.delaiMoyen.toFixed(1).replace(".", ",")}</span>
            <span className="text-base font-semibold text-encre-3">jours</span>
          </span>
          <span className="text-[0.8125rem] text-encre-3">Objectif : {d.objectifCloture} jours</span>
        </div>
        <div className={`${CARTE} flex min-h-34 flex-col items-start gap-3 px-5 py-4.5`}>
          <span className="text-sm leading-7 font-semibold text-encre-2">Actions efficaces</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-4xl leading-none font-bold tracking-[-0.02em] tabular-nums">{d.efficacite.pourcentage}</span>
            <span className="text-base font-semibold text-encre-3">%</span>
          </span>
          <span className="text-[0.8125rem] text-encre-3">
            {d.efficacite.evaluees} action{d.efficacite.evaluees > 1 ? "s" : ""} évaluée{d.efficacite.evaluees > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-4">
        <Courbe d={d} sousTitre={`${periode.court} · ${nomActivite ?? "Toutes les activités"} · ${d.recues} au total`} />
        <ParActivite d={d} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-4">
        <div className={`${CARTE} flex flex-col gap-4 p-5`}>
          <h2 className="m-0 text-base">Répartition par type</h2>
          <dl className="m-0 flex flex-col gap-4">
            {d.parType.map((t) => (
              <div key={t.libelle} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                <dt className="text-encre-2">{t.libelle}</dt>
                <dd className="m-0 h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                  <div className="h-full rounded-full bg-[#5B86BE]" style={{ width: `${t.pourcentage}%` }} />
                </dd>
                <dd className="m-0 text-right font-semibold tabular-nums">
                  {t.pourcentage} %<span className="sr-only"> ({t.nombre})</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <Priorites d={d} slug={slug} toutVoir={liste()} />
      </div>
    </section>
  );
}

/** Courbe de la maquette (SVG 700 × 200), doublée d'un tableau pour les lecteurs d'écran. */
function Courbe({ d, sousTitre }: { d: Donnees; sousTitre: string }) {
  const points = d.courbe.points;
  const L = points.length;
  const max = Math.max(...points.map((p) => p.nombre), 1) * 1.2;
  const plusHaut = Math.max(...points.map((p) => p.nombre));
  const x = (i: number) => (L === 1 ? 0.5 : i / (L - 1));
  const y = (n: number) => 1 - n / max;
  const ligne = points.map((p, i) => `${(x(i) * 700).toFixed(1)},${(y(p.nombre) * 200).toFixed(1)}`).join(" ");
  const tous = L <= 13;
  const pas = L > 7 ? Math.ceil(L / 7) : 1;
  return (
    <div className="flex flex-col gap-4 rounded-carte border border-bord bg-surface p-5 shadow-carte">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-base">{d.courbe.titre}</h2>
        <span className="text-right text-[0.8125rem] text-encre-3">{sousTitre}</span>
      </div>
      <div className="relative mx-2 mt-3 aspect-[7/2]" aria-hidden="true">
        <div className="absolute inset-0 flex flex-col justify-between">
          <span className="h-px bg-surface-3" />
          <span className="h-px bg-surface-3" />
          <span className="h-px bg-surface-3" />
          <span className="h-px bg-bord" />
        </div>
        <svg viewBox="0 0 700 200" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" fill="none">
          <polygon points={`0,200 ${ligne} 700,200`} fill="#EAF1FA" />
          <polyline points={ligne} stroke="#0B4A8B" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((p, i) => (
          <div key={p.cle} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${x(i) * 100}%`, top: `${y(p.nombre) * 100}%` }}>
            {(tous || p.nombre === plusHaut) && <span className="absolute bottom-3 text-xs font-semibold text-encre tabular-nums">{p.nombre}</span>}
            <span className="size-2.5 rounded-full border-2 border-marque bg-surface" />
          </div>
        ))}
      </div>
      <div className="relative mx-2 h-5 text-xs text-encre-3" aria-hidden="true">
        {points.map((p, i) =>
          i % pas === 0 ? (
            <span key={p.cle} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${x(i) * 100}%` }}>
              {p.libelle}
            </span>
          ) : null,
        )}
      </div>
      <table className="sr-only">
        <caption>{d.courbe.titre}</caption>
        <thead>
          <tr>
            <th scope="col">{d.courbe.titre.endsWith("jour") ? "Jour" : "Mois"}</th>
            <th scope="col">Réclamations reçues</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.cle}>
              <th scope="row">{p.libelle}</th>
              <td>{p.nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParActivite({ d }: { d: Donnees }) {
  const max = Math.max(...d.parActivite.map((a) => a.nombre), 1);
  return (
    <div className="flex flex-col gap-4.5 rounded-carte border border-bord bg-surface p-5 shadow-carte">
      <h2 className="m-0 text-base">Par activité</h2>
      <ul className="m-0 flex list-none flex-col gap-4.5 p-0">
        {d.parActivite.map((a) => (
          <li key={a.code} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-4 text-sm">
              <span className="min-w-0 truncate font-semibold">{a.nom}</span>
              <span className="whitespace-nowrap text-encre-3 tabular-nums">
                <strong className="text-encre">{a.nombre}</strong> · {a.enRetard ? `${a.enRetard} en retard` : "Aucun retard"}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
              <div className="flex h-full justify-end rounded-full bg-marque" style={{ width: `${(a.nombre / max) * 100}%` }}>
                <div className="h-full bg-retard opacity-85" style={{ width: a.nombre ? `${(a.enRetard / a.nombre) * 100}%` : "0%" }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex gap-4 text-xs text-encre-3" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-marque" />
          Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-retard" />
          dont en retard
        </span>
      </div>
    </div>
  );
}

function Priorites({ d, slug, toutVoir }: { d: Donnees; slug: string; toutVoir: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-carte border border-bord bg-surface px-5 pt-5 pb-3 shadow-carte">
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-base">À traiter en priorité</h2>
        <Link href={toutVoir} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold no-underline hover:bg-marque-pale">
          Tout voir
        </Link>
      </div>
      {d.priorites.length === 0 ? (
        <p className="m-0 py-8 text-center text-encre-3">Rien d&apos;urgent. Toutes les réclamations sont traitées.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {d.priorites.map((p) => {
            const bord = p.statut === "EN_RETARD" ? "border-l-retard" : p.alerte ? "border-l-alerte" : "border-l-transparent";
            return (
              <li key={p.numero}>
                <Link
                  href={`/bo/${slug}/reclamations/${p.numero}`}
                  className={`-mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-champ border-l-3 py-3 pr-3 pl-3.5 text-encre no-underline hover:bg-fond hover:text-encre ${bord}`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold tabular-nums">
                      {p.numero} · {p.client}
                    </span>
                    <span className="truncate text-[0.8125rem] text-encre-3">{p.description}</span>
                    {p.alerte && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-encours">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        {p.alerte}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[0.8125rem] text-encre-3 tabular-nums">
                      {p.age} j<span className="sr-only"> depuis la réception</span>
                    </span>
                    <BadgeStatut statut={p.statut} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
