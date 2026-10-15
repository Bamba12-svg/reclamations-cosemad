"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BadgeStatut } from "@/components/bo/badge-statut";
import { Icone } from "@/components/icone";
import type { Canal } from "@/generated/prisma/client";
import { LIBELLE_MODE, MODES_TRANSMISSION, texteCanaux } from "@/lib/libelles";
import type { VueFiche, VueVisa } from "@/server/fiche/lecture";
import { simulerProfil } from "../../../actions";
import { actionCauses, actionCloturer, actionRecurrent, actionRepondre, actionViser } from "./actions";
import { Colonne } from "./colonne";
import { BOUTON_LIEN, BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte, FournisseurToast, Pastille, TitreSection, useOperation, useToast } from "@/components/bo/outils";
import { SectionTraitement } from "./traitement";

const LONGUEUR_MIN_REPONSE = 20;
const LONGUEUR_MAX_REPONSE = 600;

export interface Confirmation {
  sms: string;
  email: string | null;
  adresse: string | null;
}

export function Fiche({ vue, slug, confirmation }: { vue: VueFiche; slug: string; confirmation: Confirmation | null }) {
  return (
    <FournisseurToast>
      <ContenuFiche vue={vue} slug={slug} confirmation={confirmation} />
    </FournisseurToast>
  );
}

function ContenuFiche({ vue, slug, confirmation }: { vue: VueFiche; slug: string; confirmation: Confirmation | null }) {
  const lectureSeule = !!vue.cloturee;
  const base = `/bo/${slug}/reclamations`;
  const routeur = useRouter();
  const annoncer = useToast();
  const annonce = useRef(false);
  useEffect(() => {
    if (confirmation && !annonce.current) {
      annonce.current = true;
      annoncer(`Réclamation ${vue.numero} enregistrée. Confirmation envoyée au client.`);
    }
  }, [confirmation, annoncer, vue.numero]);
  return (
    <div className="flex flex-col gap-5">
      <Link
        href={base}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg pr-3 pl-2 font-medium text-encre-3 no-underline hover:bg-surface-3 hover:text-encre"
      >
        <Icone nom="chevronGauche" taille={18} />
        Tableau de suivi
      </Link>

      {confirmation && (
        <div role="status" className="flex flex-col gap-3 rounded-carte border border-traitee-bord bg-traitee-fond px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="m-0 flex items-center gap-2 font-semibold text-[#05603A]">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Confirmation envoyée au client
            </p>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => routeur.replace(`${base}/${vue.numero}`, { scroll: false })}
              className="grid size-11 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[#05603A] hover:bg-[#D1FADF]"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.8125rem] font-semibold text-encre-2">SMS au {vue.client.telephone}</span>
              <p className="m-0 rounded-[0.75rem_0.75rem_0.75rem_0.25rem] bg-surface px-3.5 py-3 text-sm">{confirmation.sms}</p>
            </div>
            {confirmation.email && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[0.8125rem] font-semibold text-encre-2">E-mail à {confirmation.adresse}</span>
                <p className="m-0 rounded-champ bg-surface px-3.5 py-3 text-sm whitespace-pre-wrap">{confirmation.email}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <EnTete vue={vue} slug={slug} />
      <Frise vue={vue} />

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_36rem] flex-col gap-5">
          <SectionReception vue={vue} />
          <SectionObjet vue={vue} slug={slug} />
          <SectionTraitement vue={vue} slug={slug} lectureSeule={lectureSeule} />
          <SectionRetour vue={vue} slug={slug} />
          <SectionAmelioration vue={vue} slug={slug} />
          <SectionVisas vue={vue} slug={slug} />
        </div>
        <Colonne vue={vue} slug={slug} />
      </div>
    </div>
  );
}

// ───────────────────────── En-tête et frise ─────────────────────────

function EnTete({ vue, slug }: { vue: VueFiche; slug: string }) {
  const [enCours, lancer] = useOperation();
  const lienPdf = `/bo/${slug}/reclamations/${vue.numero}/pr06`;
  const complet = vue.manquantes === 0;
  return (
    <div className="flex flex-wrap items-start justify-between gap-5 rounded-carte border border-bord bg-surface px-6 py-5 shadow-carte max-sm:px-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-[clamp(1.5rem,1.2rem+1vw,1.875rem)] tracking-[-0.01em] tabular-nums">{vue.numero}</h1>
          <BadgeStatut statut={vue.statut} />
          <span className="rounded-full border border-bord px-2.5 py-0.5 text-[0.8125rem] font-medium text-encre-2">{vue.activite.nom}</span>
        </div>
        <p className="m-0 text-encre-3">
          <strong className="font-semibold text-encre">{vue.client.nom}</strong> · {vue.ageTexte} · {LIBELLE_MODE[vue.mode]}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 max-sm:items-stretch">
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={lienPdf} className={`${BOUTON_SECONDAIRE} text-[0.9375rem] no-underline hover:text-encre-2`}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4M12 18v-6M9 15l3 3 3-3" />
            </svg>
            Exporter la fiche PR06-ENR-01 (PDF)
          </Link>
          {!vue.cloturee &&
            (complet && vue.droits.cloturer ? (
              <button type="button" onClick={() => lancer(() => actionCloturer(slug, vue.numero))} disabled={enCours} className={`${BOUTON_PRINCIPAL} px-5 text-[0.9375rem]`}>
                {enCours ? (
                  <Pastille className="border-white/40 border-t-white" />
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                Clôturer la réclamation
              </button>
            ) : (
              <button type="button" disabled aria-describedby="pourquoi-cloture" className={`${BOUTON_PRINCIPAL} px-5 text-[0.9375rem]`}>
                <Icone nom="cadenas" taille={18} />
                Clôturer
              </button>
            ))}
        </div>
        {!vue.cloturee && (!complet || !vue.droits.cloturer) && (
          <p id="pourquoi-cloture" className="m-0 flex items-center gap-1.5 text-[0.8125rem] text-encre-3">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            {!complet
              ? `${vue.manquantes === 1 ? "1 élément manque pour clôturer" : `${vue.manquantes} éléments manquent pour clôturer`} (voir la liste à droite)`
              : "Clôture réservée au Service QHSE."}
          </p>
        )}
      </div>

      {vue.cloturee && (
        <div className="flex basis-full flex-wrap items-center justify-between gap-3 rounded-champ border border-traitee-bord bg-traitee-fond px-4 py-3 text-[#05603A]">
          <span className="flex items-center gap-2 font-semibold">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Réclamation clôturée le {vue.cloturee}. La fiche est en lecture seule.
          </span>
          <Link href={lienPdf} className={`${BOUTON_PRINCIPAL} px-4 no-underline hover:text-white`}>
            Voir l&apos;aperçu PDF
          </Link>
        </div>
      )}
    </div>
  );
}

function Frise({ vue }: { vue: VueFiche }) {
  return (
    <ol aria-label="Étapes de traitement" tabIndex={0} className="relative m-0 flex list-none overflow-x-auto rounded-carte border border-bord bg-surface px-5 py-4 shadow-carte">
      {vue.etapes.map((e, i) => {
        const pastille = e.faite ? "border-marque bg-marque text-white" : e.courante ? "border-marque bg-surface text-marque" : "border-bord-fort bg-surface text-encre-4";
        const libelle = e.courante ? "font-bold text-marque" : e.faite ? "font-medium text-encre" : "font-medium text-encre-4";
        return (
          <li key={e.numero} aria-current={e.courante ? "step" : undefined} className="flex min-w-30 flex-[1_0_7.5rem] flex-col gap-2">
            <div className="flex items-center">
              <span className={`grid size-7.5 flex-none place-items-center rounded-full border-2 text-[0.8125rem] font-bold ${pastille}`}>
                {e.faite ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  e.numero
                )}
              </span>
              {i < vue.etapes.length - 1 && <span aria-hidden="true" className={`mx-2 h-0.5 flex-1 ${e.faite ? "bg-marque" : "bg-bord"}`} />}
            </div>
            <span className={`pr-2 text-[0.8125rem] ${libelle}`}>
              {e.libelle}
              <span className="sr-only">{e.faite ? " (terminée)" : e.courante ? " (étape en cours)" : " (à venir)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ───────────────────────── 1. Réception ─────────────────────────

function Info({ terme, children, nombres }: { terme: string; children: React.ReactNode; nombres?: boolean }) {
  return (
    <div>
      <dt className="text-[0.8125rem] text-encre-3">{terme}</dt>
      <dd className={`m-0 mt-0.5 font-medium [overflow-wrap:anywhere] ${nombres ? "tabular-nums" : ""}`}>{children}</dd>
    </div>
  );
}

function SectionReception({ vue }: { vue: VueFiche }) {
  return (
    <Carte etiquette="Réception de la réclamation client">
      <TitreSection numero={1}>Réception de la réclamation client</TitreSection>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-x-6 gap-y-4">
        <Info terme="Origine de la réclamation">{vue.client.origine}</Info>
        <Info terme="Activité concernée">{vue.activite.nom}</Info>
        <Info terme="Nom client">{vue.client.nom}</Info>
        {vue.client.contact && <Info terme="Contact">{vue.client.contact}</Info>}
        <Info terme="Téléphone" nombres>
          {vue.client.telephone}
        </Info>
        <Info terme="E-mail">{vue.client.email ?? "—"}</Info>
        <Info terme="Date et heure de réception" nombres>
          {vue.recue.date} à {vue.recue.heure}
        </Info>
      </dl>
      <div className="flex flex-col gap-2">
        <span id="mode-transmission" className="text-[0.8125rem] text-encre-3">
          Mode de transmission
        </span>
        <ul aria-labelledby="mode-transmission" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {MODES_TRANSMISSION.map((m) => {
            const actif = vue.mode === m;
            return (
              <li
                key={m}
                aria-current={actif ? "true" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8125rem] ${actif ? "border-marque bg-marque font-semibold text-white" : "border-bord bg-surface font-medium text-encre-3"}`}
              >
                {actif && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
                {LIBELLE_MODE[m]}
              </li>
            );
          })}
        </ul>
      </div>
    </Carte>
  );
}

// ───────────────────────── 2. Objet ─────────────────────────

function SectionObjet({ vue, slug }: { vue: VueFiche; slug: string }) {
  const [enCours, lancer] = useOperation();
  const [ouvert, setOuvert] = useState(false);
  const bouton = (valeur: boolean) => {
    const actif = vue.recurrent === valeur;
    return (
      <button
        type="button"
        aria-pressed={actif}
        disabled={!vue.droits.qualifier || enCours}
        onClick={() => !actif && lancer(() => actionRecurrent(slug, vue.numero, valeur), { succes: false })}
        className={`min-h-11 min-w-16 cursor-pointer border-0 px-4 font-semibold disabled:cursor-not-allowed ${valeur ? "" : "border-l border-bord-fort"} ${actif ? "bg-marque text-white" : "bg-surface text-encre-2 hover:bg-surface-2"}`}
      >
        {valeur ? "Oui" : "Non"}
      </button>
    );
  };
  return (
    <Carte etiquette="Objet de la réclamation">
      <TitreSection numero={2}>Objet de la réclamation</TitreSection>
      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-x-6 gap-y-4">
        <Info terme="Type de réclamation">{vue.type}</Info>
        <div>
          <dt id="recurrent" className="text-[0.8125rem] text-encre-3">
            Problème récurrent
          </dt>
          <dd className="m-0 mt-1">
            <span role="group" aria-labelledby="recurrent" className="inline-flex overflow-hidden rounded-champ border border-bord-fort">
              {bouton(true)}
              {bouton(false)}
            </span>
          </dd>
        </div>
      </dl>
      <div>
        <p className="m-0 text-[0.8125rem] text-encre-3">Détails</p>
        <p className="m-0 mt-1 text-base text-pretty whitespace-pre-line">{vue.description}</p>
      </div>
      {vue.similaires.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-champ border border-nouvelle-bord bg-[#F5F8FF]">
          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls="similaires"
            onClick={() => setOuvert(!ouvert)}
            className="flex min-h-11 cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-2 text-left font-semibold text-[#1D3F8A] hover:bg-[#EEF3FF]"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true">
              <path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="flex-1">{vue.similairesTexte}</span>
            <Icone nom="chevronBas" taille={16} className={`transition-transform ${ouvert ? "rotate-180" : ""}`} />
          </button>
          {ouvert && (
            <ul id="similaires" className="m-0 flex list-none flex-col px-2 pb-2">
              {vue.similaires.map((s) => (
                <li key={s.numero}>
                  <Link
                    href={`/bo/${slug}/reclamations/${s.numero}`}
                    className="mt-1.5 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface p-2 text-encre no-underline hover:bg-fond hover:text-encre"
                  >
                    <span className="font-semibold text-marque tabular-nums">{s.numero}</span>
                    <span className="text-[0.8125rem] text-encre-3 tabular-nums">{s.date}</span>
                    <span className="min-w-40 flex-1 text-sm">{s.description}</span>
                    <BadgeStatut statut={s.statut} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Carte>
  );
}

// ───────────────────────── 4. Retour au client ─────────────────────────

function SectionRetour({ vue, slug }: { vue: VueFiche; slug: string }) {
  return (
    <Carte etiquette="Retour au client">
      <TitreSection numero={4}>Retour au client</TitreSection>
      {vue.reponse ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 flex items-center gap-2 text-sm font-semibold text-traitee">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Envoyée par {vue.reponse.canaux} le {vue.reponse.date}
          </p>
          <div>
            <p className="m-0 text-[0.8125rem] text-encre-3">Détail de la réponse</p>
            <p className="m-0 mt-1 text-pretty whitespace-pre-line">{vue.reponse.texte}</p>
          </div>
        </div>
      ) : vue.droits.repondre ? (
        <FormulaireReponse vue={vue} slug={slug} />
      ) : (
        <p className="m-0 text-sm text-encre-3">
          {vue.cloturee ? "Aucune réponse enregistrée." : "Réponse pas encore envoyée. Elle est rédigée par le responsable de traitement ou le Service QHSE."}
        </p>
      )}
    </Carte>
  );
}

function FormulaireReponse({ vue, slug }: { vue: VueFiche; slug: string }) {
  const [texte, setTexte] = useState("");
  const [canaux, setCanaux] = useState<Canal[]>(vue.canauxProposes);
  const [enCours, lancer] = useOperation();
  const longueur = canaux.length ? texte.trim().length : 0;
  const pret = longueur >= LONGUEUR_MIN_REPONSE && !enCours;
  const canauxTexte = canaux.length ? texteCanaux(canaux) : "";
  const indice = !canaux.length
    ? "Choisissez SMS, e-mail ou les deux."
    : longueur === 0
      ? "Rédigez la réponse pour pouvoir l’envoyer."
      : `Encore ${LONGUEUR_MIN_REPONSE - longueur} caractères minimum.`;

  const basculer = (c: Canal) => setCanaux((liste) => (liste.includes(c) ? liste.filter((x) => x !== c) : [...liste, c]));
  const envoyer = () => lancer(() => actionRepondre(slug, vue.numero, { texte, canaux }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor="reponse" className="text-sm font-semibold">
          Détail de la réponse
        </label>
        <button type="button" onClick={() => setTexte(vue.modeleReponse.slice(0, LONGUEUR_MAX_REPONSE))} className={BOUTON_LIEN}>
          Partir du modèle
        </button>
      </div>
      <textarea
        id="reponse"
        rows={4}
        value={texte}
        maxLength={LONGUEUR_MAX_REPONSE}
        onChange={(e) => setTexte(e.target.value.slice(0, LONGUEUR_MAX_REPONSE))}
        aria-describedby="reponse-compteur"
        placeholder="Expliquez au client ce qui a été fait, en termes simples."
        className="resize-y rounded-champ border border-bord-fort px-3.5 py-3 text-[0.9375rem] leading-normal"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span id="reponse-compteur" className="text-[0.8125rem] text-encre-3 tabular-nums">
            Date de la réponse : aujourd&apos;hui · {texte.length} / {LONGUEUR_MAX_REPONSE}
          </span>
          <div role="group" aria-label="Envoyer par" className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Envoyer par</span>
            {(["SMS", "EMAIL"] as const).map((c) => {
              const impossible = c === "EMAIL" && !vue.emailClient;
              const actif = !impossible && canaux.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="checkbox"
                  aria-checked={actif}
                  disabled={impossible}
                  title={impossible ? "Ce client n'a pas d'adresse e-mail" : undefined}
                  onClick={() => basculer(c)}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-champ border px-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${actif ? "border-marque bg-marque-pale" : "border-bord-fort bg-surface"}`}
                >
                  <span className={`grid size-4.5 place-items-center rounded-[0.3125rem] border-2 text-white ${actif ? "border-marque bg-marque" : "border-encre-5 bg-surface"}`}>
                    {actif && (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  {c === "SMS" ? "SMS" : "E-mail"}
                </button>
              );
            })}
            {!vue.emailClient && <span className="text-[0.8125rem] text-encre-3">Pas d&apos;e-mail pour ce client</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {longueur < LONGUEUR_MIN_REPONSE && <span className="text-[0.8125rem] text-encre-3">{indice}</span>}
          <button type="button" onClick={envoyer} disabled={!pret} className={BOUTON_PRINCIPAL}>
            {enCours ? (
              <Pastille className="border-white/40 border-t-white" />
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" />
              </svg>
            )}
            {canauxTexte ? `Envoyer au client (${canauxTexte})` : "Envoyer au client"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 5. Amélioration continue ─────────────────────────

/** Causes racines : enregistrement automatique (1,5 s après la dernière frappe, et en quittant le champ). */
function SectionAmelioration({ vue, slug }: { vue: VueFiche; slug: string }) {
  const [texte, setTexte] = useState(vue.causes);
  const [etat, setEtat] = useState<"" | "attente" | "ok">("");
  const enregistre = useRef(vue.causes.trim());
  const minuterie = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [enCours, lancer] = useOperation();
  const annoncer = useToast();
  const modifiable = vue.droits.traiter;

  const sauver = (valeur: string, toast: boolean) => {
    clearTimeout(minuterie.current);
    const net = valeur.trim();
    if (net === enregistre.current) return;
    setEtat("attente");
    lancer(() => actionCauses(slug, vue.numero, valeur), {
      succes: false,
      reussite: () => {
        enregistre.current = net;
        setEtat("ok");
        if (toast && net) annoncer("Causes racines enregistrées");
      },
      echec: () => setEtat(""),
    });
  };
  useEffect(() => () => clearTimeout(minuterie.current), []);

  return (
    <Carte etiquette="Amélioration continue" className="gap-3">
      <TitreSection numero={5}>Amélioration continue</TitreSection>
      <label htmlFor="causes" className="text-sm font-semibold">
        Causes racines
      </label>
      <textarea
        id="causes"
        rows={3}
        value={texte}
        maxLength={5000}
        disabled={!modifiable}
        aria-describedby="causes-etat"
        onChange={(e) => {
          const v = e.target.value;
          setTexte(v);
          setEtat("");
          clearTimeout(minuterie.current);
          minuterie.current = setTimeout(() => sauver(v, false), 1500);
        }}
        onBlur={() => sauver(texte, true)}
        placeholder="Pourquoi le problème est-il arrivé ? Que faut-il changer pour qu'il ne se reproduise pas ?"
        className="resize-y rounded-champ border border-bord-fort px-3.5 py-3 text-[0.9375rem] leading-normal disabled:cursor-not-allowed disabled:bg-surface-2"
      />
      <p id="causes-etat" role="status" className="m-0 text-[0.8125rem] text-encre-3 empty:hidden">
        {vue.cloturee ? "" : !modifiable ? "Renseignées par le responsable de traitement ou le Service QHSE." : etat === "attente" || enCours ? "Enregistrement…" : etat === "ok" ? "Enregistré." : "Enregistrement automatique."}
      </p>
    </Carte>
  );
}

// ───────────────────────── 6. Visas ─────────────────────────

function SectionVisas({ vue, slug }: { vue: VueFiche; slug: string }) {
  return (
    <Carte etiquette="Visas">
      <TitreSection numero={6}>Visas</TitreSection>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4">
        <CarteVisa titre="Direction Commerciale" fonction="Direction Commerciale" type="DIRECTION_COMMERCIALE" visa={vue.visas.dc} vue={vue} slug={slug} />
        <CarteVisa titre="Service QHSE" fonction="Service QHSE" type="QHSE" visa={vue.visas.qhse} vue={vue} slug={slug} />
      </div>
    </Carte>
  );
}

function CarteVisa({ titre, fonction, type, visa, vue, slug }: { titre: string; fonction: string; type: "DIRECTION_COMMERCIALE" | "QHSE"; visa: VueVisa; vue: VueFiche; slug: string }) {
  const [enCours, lancer] = useOperation();
  const retour = `/bo/${slug}/reclamations/${vue.numero}`;
  return (
    <div className="flex flex-col gap-3 rounded-champ border border-bord px-4.5 py-4">
      <p className="m-0 text-[0.8125rem] font-semibold tracking-[0.04em] text-encre-3 uppercase">{titre}</p>
      {visa.vise ? (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 font-semibold text-traitee">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Visé
          </span>
          <span className="font-semibold">{visa.vise.nom}</span>
          <span className="text-sm text-encre-3 tabular-nums">
            {visa.vise.fonction} · {visa.vise.quand}
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{visa.signataire}</span>
            <span className="text-sm text-encre-3">{fonction} · en attente</span>
          </div>
          {!vue.cloturee && (
            <button
              type="button"
              onClick={() => lancer(() => actionViser(slug, vue.numero, type))}
              disabled={!visa.peutViser || enCours}
              aria-describedby={visa.raison ? `raison-${type}` : undefined}
              className={`${BOUTON_PRINCIPAL} self-start`}
            >
              {enCours ? (
                <Pastille className="border-white/40 border-t-white" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                </svg>
              )}
              Viser
            </button>
          )}
          {visa.raison && !vue.cloturee && (
            <p id={`raison-${type}`} className="m-0 text-[0.8125rem] text-encre-3">
              {visa.raison}
            </p>
          )}
          {visa.simuler && (
            <form action={() => simulerProfil(visa.simuler!.userId, slug, retour)}>
              <button type="submit" className={`${BOUTON_LIEN} -ml-2 self-start`}>
                Simuler : passer au profil {visa.simuler.nom}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
