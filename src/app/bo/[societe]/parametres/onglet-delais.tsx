"use client";

import { useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, useOperation } from "@/components/bo/outils";
import { actionAjouterFerie, actionDelais, actionSupprimerFerie } from "./actions";

interface Props {
  slug: string;
  delais: { delaiQualificationH: number; delaiReponseJO: number; delaiClotureJ: number };
  feries: { date: string; affichage: string; libelle: string }[];
}

const CHAMP_NOMBRE = "min-h-11.5 w-24 rounded-champ border border-bord-fort px-3 tabular-nums";

export function OngletDelais({ slug, delais, feries }: Props) {
  const [valeurs, setValeurs] = useState(delais);
  const [enCours, lancer] = useOperation();

  const champ = (cle: keyof typeof valeurs, libelle: string, unite: string) => (
    <label className="flex flex-col gap-1.5 font-semibold">
      {libelle}
      <span className="flex items-center gap-2 font-normal">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={valeurs[cle]}
          onChange={(e) => setValeurs({ ...valeurs, [cle]: Math.max(0, Number(e.target.value) || 0) })}
          className={CHAMP_NOMBRE}
        />
        {unite}
      </span>
    </label>
  );

  return (
    <>
      <h2 className="m-0 text-[1.0625rem]">Délais cibles</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-5">
        {champ("delaiQualificationH", "Qualification et affectation", "heures")}
        {champ("delaiReponseJO", "Réponse au client", "jours ouvrés")}
        {champ("delaiClotureJ", "Clôture de la réclamation", "jours")}
      </div>
      <p className="m-0 text-sm text-encre-3">
        Une réclamation passe « En retard » dès qu&apos;une action dépasse son échéance. Le client ne voit jamais ce statut. Le délai de réponse est aussi annoncé au client
        dans le SMS de confirmation (variable {"{delai}"}).
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={enCours}
          onClick={() => lancer(() => actionDelais(slug, valeurs))}
          className={BOUTON_PRINCIPAL}
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <div className="h-px bg-surface-3" />
      <JoursFeries slug={slug} feries={feries} />
    </>
  );
}

/** Jours fériés exclus des jours ouvrés (fêtes religieuses à date variable : à saisir chaque année). */
function JoursFeries({ slug, feries }: { slug: string; feries: Props["feries"] }) {
  const [date, setDate] = useState("");
  const [libelle, setLibelle] = useState("");
  const [enCours, lancer] = useOperation();
  return (
    <section aria-labelledby="titre-feries" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="titre-feries" className="m-0 text-[1.0625rem]">
          Jours fériés
        </h2>
        <p className="m-0 text-sm text-encre-3">
          Ils ne comptent pas dans les jours ouvrés. Les fêtes à date variable (Korité, Tabaski, Tamkharit, Maouloud, Magal, lundi de Pâques, Ascension, Pentecôte) sont à ajouter
          chaque année. Valable pour tout le groupe.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          lancer(() => actionAjouterFerie(slug, { date, libelle }), { reussite: () => (setDate(""), setLibelle("")) });
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Date
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-champ border border-bord-fort px-3 font-normal tabular-nums" />
        </label>
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-semibold">
          Libellé
          <input required maxLength={80} value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Tabaski" className="min-h-11 rounded-champ border border-bord-fort px-3 font-normal" />
        </label>
        <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
          Ajouter
        </button>
      </form>
      {feries.length === 0 ? (
        <p className="m-0 text-sm text-encre-3">Aucun jour férié enregistré pour cette année.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-champ border border-bord p-0">
          {feries.map((f) => (
            <li key={f.date} className="flex items-center gap-4 border-b border-surface-3 px-4 py-1.5 last:border-b-0">
              <span className="w-24 font-medium tabular-nums">{f.affichage}</span>
              <span className="flex-1">{f.libelle}</span>
              <button
                type="button"
                disabled={enCours}
                onClick={() => lancer(() => actionSupprimerFerie(slug, f.date))}
                aria-label={`Retirer ${f.libelle} (${f.affichage})`}
                className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-retard hover:bg-retard-fond"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
