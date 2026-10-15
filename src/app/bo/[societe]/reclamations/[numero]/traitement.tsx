"use client";

import { useState } from "react";
import { IconeTrace } from "@/components/icone";
import type { StatutAction } from "@/generated/prisma/client";
import { LIBELLE_STATUT_ACTION } from "@/lib/libelles";
import type { VueAction, VueFiche } from "@/server/fiche/lecture";
import type { ModificationAction } from "@/server/fiche/operations";
import { actionAffecter, actionAjouterAction, actionModifierAction } from "./actions";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, Carte, CHAMP, TitreSection, useOperation } from "@/components/bo/outils";

// Colonnes du tableau des actions (maquette B4) : écrites en entier pour que Tailwind les voie.
const GRILLE = "grid grid-cols-[2.25rem_minmax(13rem,2fr)_9.5rem_9.5rem_8.5rem_minmax(12rem,1.6fr)_7.5rem] gap-2";
const STATUTS: StatutAction[] = ["A_FAIRE", "EN_COURS", "REALISEE"];

interface Props {
  vue: VueFiche;
  slug: string;
  lectureSeule: boolean;
}

/** Section 3 : responsable de traitement, activité, tableau des actions modifiable sur place. */
export function SectionTraitement({ vue, slug, lectureSeule }: Props) {
  const [enCours, lancer] = useOperation();
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState("");

  const affecterA = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const champ = e.currentTarget;
    const avant = vue.responsableId ?? "";
    lancer(() => actionAffecter(slug, vue.numero, champ.value || null), { echec: () => (champ.value = avant) });
  };

  const commencer = () => {
    setErreur("");
    setBrouillon({ libelle: "", responsableId: vue.responsableParDefaut ?? "", echeance: "", statut: "A_FAIRE", critere: "" });
  };

  const enregistrer = () => {
    if (!brouillon) return;
    if (!brouillon.libelle.trim()) return setErreur("Décrivez l'action à mener.");
    if (!brouillon.echeance) return setErreur("Indiquez l'échéance de l'action.");
    lancer(() => actionAjouterAction(slug, vue.numero, brouillon), { reussite: () => setBrouillon(null) });
  };

  return (
    <Carte etiquette="Traitement de la réclamation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TitreSection numero={3}>Traitement de la réclamation</TitreSection>
        <label className="flex max-w-full min-w-0 flex-wrap items-center gap-2.5 text-sm text-encre-3 max-sm:w-full">
          Responsable de traitement
          <select
            key={vue.responsableId ?? "aucun"}
            defaultValue={vue.responsableId ?? ""}
            onChange={affecterA}
            disabled={!vue.droits.qualifier || enCours}
            className="min-h-11 max-w-full min-w-0 rounded-champ border border-bord-fort bg-surface px-3 max-sm:w-full text-[0.9375rem] font-medium text-encre disabled:cursor-not-allowed disabled:bg-surface-2"
          >
            <option value="">À désigner par le Service QHSE</option>
            {vue.responsables.map((p) => (
              <option key={p.id} value={p.id}>
                {p.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-champ bg-fond px-3.5 py-3 text-sm text-encre-2">
        <span className="flex items-center gap-2 font-semibold text-encre">
          <IconeTrace d={vue.activite.icone} taille={18} className="flex-none text-marque" />
          {vue.activite.nom}
        </span>
        {vue.activite.responsable && (
          <span>
            Responsable de l&apos;activité : <strong className="font-semibold">{vue.activite.responsable}</strong>
          </span>
        )}
        {vue.activite.equipes && <span className="text-encre-3">Équipes : {vue.activite.equipes}</span>}
      </div>

      {/* Zone défilante atteignable au clavier (flèches gauche/droite) même quand la fiche est en lecture seule. */}
      <div className="relative overflow-x-auto rounded-champ border border-bord" tabIndex={0} role="region" aria-label="Tableau des actions (défilement horizontal)">
        <div role="table" aria-label="Actions" aria-busy={enCours} className="min-w-[62rem] text-sm">
          <div role="row" className={`${GRILLE} border-b border-bord bg-fond px-3 py-2.5 text-xs font-semibold tracking-[0.03em] text-encre-3 uppercase`}>
            <span role="columnheader">#</span>
            <span role="columnheader">Action</span>
            <span role="columnheader">Responsable</span>
            <span role="columnheader">Échéance</span>
            <span role="columnheader">Statut</span>
            <span role="columnheader">Critère de vérification</span>
            <span role="columnheader">Efficace</span>
          </div>
          {vue.actions.length === 0 && !brouillon && (
            <p className="m-0 p-6 text-center text-encre-3">Aucune action pour l&apos;instant. Ajoutez la première action de prise en charge.</p>
          )}
          {vue.actions.map((a) => (
            <LigneAction key={a.id} action={a} vue={vue} slug={slug} />
          ))}
          {brouillon && (
            <div role="row" className={`${GRILLE} items-center bg-[#F5F8FC] px-3 py-2.5`}>
              <span role="cell" aria-hidden="true" className="font-bold text-marque">
                +
              </span>
              <span role="cell">
                <input
                  aria-label="Nouvelle action"
                  aria-invalid={erreur.startsWith("Décrivez") || undefined}
                  value={brouillon.libelle}
                  maxLength={300}
                  autoFocus
                  onChange={(e) => (setBrouillon({ ...brouillon, libelle: e.target.value }), setErreur(""))}
                  placeholder="Décrivez l'action"
                  className={`${CHAMP} ${erreur.startsWith("Décrivez") ? "border-retard" : ""}`}
                />
              </span>
              <span role="cell">
                <select aria-label="Responsable" value={brouillon.responsableId} onChange={(e) => setBrouillon({ ...brouillon, responsableId: e.target.value })} className={CHAMP}>
                  {vue.responsables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.libelle}
                    </option>
                  ))}
                </select>
              </span>
              <span role="cell">
                <input
                  aria-label="Échéance"
                  type="date"
                  aria-invalid={erreur.startsWith("Indiquez") || undefined}
                  value={brouillon.echeance}
                  onChange={(e) => (setBrouillon({ ...brouillon, echeance: e.target.value }), setErreur(""))}
                  className={`${CHAMP} tabular-nums ${erreur.startsWith("Indiquez") ? "border-retard" : ""}`}
                />
              </span>
              <span role="cell">
                <select aria-label="Statut" value={brouillon.statut} onChange={(e) => setBrouillon({ ...brouillon, statut: e.target.value as StatutAction })} className={CHAMP}>
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>
                      {LIBELLE_STATUT_ACTION[s]}
                    </option>
                  ))}
                </select>
              </span>
              <span role="cell">
                <input
                  aria-label="Critère"
                  value={brouillon.critere}
                  maxLength={300}
                  onChange={(e) => setBrouillon({ ...brouillon, critere: e.target.value })}
                  placeholder="Comment vérifier ?"
                  className={CHAMP}
                />
              </span>
              <span role="cell" className="text-xs text-encre-3">
                Après réalisation
              </span>
            </div>
          )}
        </div>
      </div>

      {erreur && (
        <p role="alert" className="m-0 flex items-center gap-1.5 text-sm text-retard">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {erreur}
        </p>
      )}

      {brouillon ? (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => (setBrouillon(null), setErreur(""))} className={BOUTON_SECONDAIRE}>
            Annuler
          </button>
          <button type="button" onClick={enregistrer} disabled={enCours} className={BOUTON_PRINCIPAL}>
            {enCours ? "Enregistrement…" : "Enregistrer l'action"}
          </button>
        </div>
      ) : (
        !lectureSeule &&
        vue.droits.traiter && (
          <button
            type="button"
            onClick={commencer}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-champ border border-dashed border-encre-5 bg-surface px-4 font-semibold text-marque hover:border-marque hover:bg-[#F5F8FC]"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
            Ajouter une action
          </button>
        )
      )}
    </Carte>
  );
}

interface Brouillon {
  libelle: string;
  responsableId: string;
  echeance: string;
  statut: StatutAction;
  critere: string;
}

/**
 * Une ligne du tableau : chaque champ est enregistré dès qu'on le quitte (texte, date) ou qu'on le
 * change (listes, boutons). Les champs ne sont pas « contrôlés » : la frappe n'est jamais
 * interrompue par le rafraîchissement de la page qui suit l'enregistrement.
 */
function LigneAction({ action: a, vue, slug }: { action: VueAction; vue: VueFiche; slug: string }) {
  const [enCours, lancer] = useOperation();
  const tout = a.modifiable === "tout";
  const statutSeul = a.modifiable !== "rien";

  const modifier = (m: ModificationAction, champ?: HTMLInputElement | HTMLSelectElement, avant?: string) =>
    lancer(() => actionModifierAction(slug, vue.numero, a.id, m), {
      echec: () => {
        if (champ && avant !== undefined) champ.value = avant;
      },
    });

  const surSortie = (cle: "libelle" | "critere" | "echeance", avant: string) => (e: React.FocusEvent<HTMLInputElement>) => {
    const champ = e.currentTarget;
    const valeur = cle === "echeance" ? champ.value : champ.value.trim();
    if (valeur === avant) return;
    if (cle === "echeance" && !valeur) {
      champ.value = avant; // une action garde toujours une échéance
      return;
    }
    modifier({ champ: cle, valeur }, champ, avant);
  };
  const entreeValide = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  const efficaceBouton = (valeur: boolean) => {
    const actif = a.efficace === valeur;
    const couleurs = actif ? (valeur ? "bg-traitee text-white" : "bg-encre-2 text-white") : "bg-surface text-encre-2 hover:bg-surface-2";
    return (
      <button
        type="button"
        aria-pressed={actif}
        disabled={!tout || a.statut !== "REALISEE" || enCours}
        title={a.statut !== "REALISEE" ? "Après réalisation" : undefined}
        onClick={() => modifier({ champ: "efficace", valeur })}
        className={`min-h-10.5 flex-1 cursor-pointer border-0 text-[0.8125rem] font-semibold disabled:cursor-not-allowed ${valeur ? "" : "border-l border-bord-fort"} ${couleurs} ${!actif ? "disabled:text-encre-5" : ""}`}
      >
        {valeur ? "Oui" : "Non"}
      </button>
    );
  };

  return (
    <div
      role="row"
      aria-busy={enCours}
      className={`${GRILLE} items-center border-b border-surface-3 px-3 py-2 ${a.enRetard ? "bg-retard-ligne shadow-[inset_3px_0_0_var(--color-retard)]" : "bg-surface"}`}
    >
      <span role="cell" className="font-semibold text-encre-3 tabular-nums">
        {a.n}
        {a.enRetard && <span className="sr-only"> (en retard)</span>}
      </span>
      <span role="cell">
        <input
          aria-label={`Action ${a.n}`}
          defaultValue={a.libelle}
          maxLength={300}
          disabled={!tout}
          onBlur={surSortie("libelle", a.libelle)}
          onKeyDown={entreeValide}
          title={a.libelle}
          className={CHAMP}
        />
      </span>
      <span role="cell">
        <select
          aria-label={`Responsable de l'action ${a.n}`}
          key={a.responsableId}
          defaultValue={a.responsableId}
          disabled={!tout}
          onChange={(e) => modifier({ champ: "responsableId", valeur: e.currentTarget.value }, e.currentTarget, a.responsableId)}
          className={CHAMP}
        >
          {vue.responsables.map((p) => (
            <option key={p.id} value={p.id}>
              {p.libelle}
            </option>
          ))}
        </select>
      </span>
      <span role="cell">
        <input
          aria-label={`Échéance de l'action ${a.n}`}
          type="date"
          defaultValue={a.echeance}
          disabled={!tout}
          onBlur={surSortie("echeance", a.echeance)}
          onKeyDown={entreeValide}
          className={`${CHAMP} tabular-nums ${a.enRetard ? "border-retard-bord text-retard" : ""}`}
        />
      </span>
      <span role="cell">
        <select
          aria-label={`Statut de l'action ${a.n}`}
          key={a.statut}
          defaultValue={a.statut}
          disabled={!statutSeul || enCours}
          onChange={(e) => modifier({ champ: "statut", valeur: e.currentTarget.value as StatutAction }, e.currentTarget, a.statut)}
          className={CHAMP}
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>
              {LIBELLE_STATUT_ACTION[s]}
            </option>
          ))}
        </select>
      </span>
      <span role="cell">
        <input
          aria-label={`Critère de vérification de l'action ${a.n}`}
          defaultValue={a.critere}
          maxLength={300}
          disabled={!tout}
          onBlur={surSortie("critere", a.critere)}
          onKeyDown={entreeValide}
          title={a.critere}
          className={CHAMP}
        />
      </span>
      <span role="cell">
        <span role="group" aria-label={`Action ${a.n} efficace`} className="flex overflow-hidden rounded-lg border border-bord-fort">
          {efficaceBouton(true)}
          {efficaceBouton(false)}
        </span>
      </span>
    </div>
  );
}
