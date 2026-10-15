"use client";

import { useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, useOperation } from "@/components/bo/outils";
import { IconeTrace } from "@/components/icone";
import type { DonneesParametres } from "@/server/parametres";
import { actionCreerActivite, actionModifierActivite } from "./actions";

type Activite = DonneesParametres["activites"][number];
type Personne = { id: string; nom: string };

interface Props {
  slug: string;
  societe: string;
  activites: Activite[];
  personnes: Personne[];
  icones: string[];
}

const CHAMP = "min-h-11 w-full rounded-champ border border-bord-fort bg-surface px-3 font-normal";
const ETIQUETTE = "text-xs font-semibold tracking-[0.04em] text-encre-3 uppercase";

export function OngletActivites({ slug, societe, activites, personnes, icones }: Props) {
  const [enEdition, setEnEdition] = useState<string | null>(null);
  const [ajout, setAjout] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[1.0625rem]">Activités et équipes de {societe}</h2>
          <p className="m-0 text-sm text-encre-3">
            Chaque réclamation est rattachée à une activité. Son responsable reçoit les réclamations de l&apos;activité et répartit les actions entre ses équipes.
          </p>
        </div>
        {!ajout && (
          <button type="button" onClick={() => setAjout(true)} className={BOUTON_SECONDAIRE}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
            Ajouter une activité
          </button>
        )}
      </div>
      {ajout && <NouvelleActivite slug={slug} icones={icones} fermer={() => setAjout(false)} />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] items-start gap-4">
        {activites.map((a) =>
          enEdition === a.id ? (
            <EditionActivite key={a.id} slug={slug} activite={a} personnes={personnes} fermer={() => setEnEdition(null)} />
          ) : (
            <CarteActivite key={a.id} activite={a} modifier={() => setEnEdition(a.id)} />
          ),
        )}
      </div>
    </>
  );
}

function CarteActivite({ activite: a, modifier }: { activite: Activite; modifier: () => void }) {
  return (
    <article className={`flex flex-col gap-3.5 rounded-carte border border-bord p-4.5 ${a.actif ? "" : "bg-surface-2"}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-champ bg-marque-pale text-marque">
          <IconeTrace d={a.icone} taille={20} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="font-bold">{a.nom}</span>
          <span className="text-xs text-encre-3 tabular-nums">
            Code {a.code} · {a.total} réclamation{a.total > 1 ? "s" : ""} · {a.ouvertes} ouverte{a.ouvertes > 1 ? "s" : ""}
          </span>
        </span>
      </div>
      {!a.actif && <span className="self-start rounded-full border border-bord-fort px-2 text-xs font-semibold text-encre-3">Désactivée : n&apos;apparaît plus sur le portail</span>}
      {a.description && <p className="m-0 text-[0.8125rem] text-encre-3">{a.description}</p>}
      <div className="flex flex-col gap-0.5">
        <span className={ETIQUETTE}>Responsable</span>
        <span className={a.responsable ? "font-semibold" : "text-encre-4 italic"}>{a.responsable ?? "À désigner"}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className={ETIQUETTE}>Équipes</span>
        {a.equipes.length === 0 && <span className="text-sm text-encre-4 italic">Aucune équipe</span>}
        {a.equipes.map((e) => (
          <div key={e.id} className="flex flex-col gap-1 rounded-lg bg-fond px-3 py-2">
            <span className="text-sm font-semibold">{e.nom}</span>
            <span className="text-[0.8125rem] text-encre-2">{e.membres.length ? e.membres.map((m) => m.nom + (m.actif ? "" : " (désactivé)")).join(", ") : "Aucun membre"}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={modifier} className={`${BOUTON_SECONDAIRE} self-start`}>
        Modifier<span className="sr-only"> {a.nom}</span>
      </button>
    </article>
  );
}

function EditionActivite({ slug, activite: a, personnes, fermer }: { slug: string; activite: Activite; personnes: Personne[]; fermer: () => void }) {
  const [f, setF] = useState({
    nom: a.nom,
    nomCourt: a.nomCourt,
    description: a.description,
    responsableId: a.responsableId,
    actif: a.actif,
    equipes: a.equipes.map((e) => ({ id: e.id as string | null, nom: e.nom, membres: e.membres.filter((m) => m.actif).map((m) => m.id) })),
  });
  const [enCours, lancer] = useOperation();
  const majEquipe = (i: number, changement: Partial<(typeof f.equipes)[number]>) =>
    setF({ ...f, equipes: f.equipes.map((e, j) => (j === i ? { ...e, ...changement } : e)) });

  return (
    <form
      aria-label={`Modifier ${a.nom}`}
      className="flex flex-col gap-4 rounded-carte border-2 border-marque p-4.5 [grid-column:1/-1]"
      onSubmit={(e) => {
        e.preventDefault();
        lancer(() => actionModifierActivite(slug, a.id, f), { reussite: fermer });
      }}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-champ bg-marque-pale text-marque">
          <IconeTrace d={a.icone} taille={20} />
        </span>
        <h3 className="m-0 text-base">
          Modifier l&apos;activité <span className="text-encre-3 tabular-nums">· code {a.code}</span>
        </h3>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nom
          <input required minLength={2} maxLength={80} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nom court (portail client)
          <input required minLength={2} maxLength={40} value={f.nomCourt} onChange={(e) => setF({ ...f, nomCourt: e.target.value })} className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Responsable
          <select value={f.responsableId ?? ""} onChange={(e) => setF({ ...f, responsableId: e.target.value || null })} className={CHAMP}>
            <option value="">À désigner</option>
            {personnes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Description <span className="font-normal text-encre-3">(affichée au client sur le portail)</span>
        <textarea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`${CHAMP} resize-y py-2`} />
      </label>
      <label className="flex items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} className="size-5 accent-marque" />
        Activité active (proposée sur le portail et à l&apos;accueil)
      </label>

      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className={`${ETIQUETTE} mb-2 p-0`}>Équipes</legend>
        {personnes.length === 0 && <p className="m-0 text-sm text-encre-3">Créez d&apos;abord des comptes « Responsable de traitement » (onglet Utilisateurs et rôles).</p>}
        {f.equipes.map((e, i) => (
          <div key={e.id ?? `nouvelle-${i}`} className="flex flex-col gap-2.5 rounded-lg bg-fond p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Nom de l'équipe ${i + 1}`}
                required
                minLength={2}
                maxLength={80}
                value={e.nom}
                onChange={(ev) => majEquipe(i, { nom: ev.target.value })}
                placeholder="Nom de l'équipe"
                className={`${CHAMP} flex-1 font-semibold`}
              />
              <button
                type="button"
                onClick={() => setF({ ...f, equipes: f.equipes.filter((_, j) => j !== i) })}
                className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-retard hover:bg-retard-fond"
              >
                Supprimer l&apos;équipe<span className="sr-only"> {e.nom}</span>
              </button>
            </div>
            <div role="group" aria-label={`Membres de l'équipe ${e.nom || i + 1}`} className="flex flex-wrap gap-1.5">
              {personnes.map((p) => {
                const membre = e.membres.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${membre ? "border-marque bg-marque-pale font-semibold text-marque" : "border-bord-fort bg-surface text-encre-2"}`}
                  >
                    <input
                      type="checkbox"
                      checked={membre}
                      onChange={() => majEquipe(i, { membres: membre ? e.membres.filter((x) => x !== p.id) : [...e.membres, p.id] })}
                      className="size-4 accent-marque"
                    />
                    {p.nom}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setF({ ...f, equipes: [...f.equipes, { id: null, nom: "", membres: [] }] })} className={`${BOUTON_SECONDAIRE} self-start border-dashed`}>
          Ajouter une équipe
        </button>
      </fieldset>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={fermer} className={BOUTON_SECONDAIRE}>
          Annuler
        </button>
        <button type="submit" disabled={enCours} className={BOUTON_PRINCIPAL}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function NouvelleActivite({ slug, icones, fermer }: { slug: string; icones: string[]; fermer: () => void }) {
  const [f, setF] = useState({ code: "", nom: "", nomCourt: "", description: "", icone: icones[0] ?? "" });
  const [enCours, lancer] = useOperation();
  return (
    <form
      aria-label="Nouvelle activité"
      className="flex flex-col gap-4 rounded-carte border border-bord bg-fond p-5"
      onSubmit={(e) => {
        e.preventDefault();
        lancer(() => actionCreerActivite(slug, f), { reussite: fermer });
      }}
    >
      <h3 className="m-0 text-base">Nouvelle activité</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Code
          <input
            required
            pattern="[A-Za-z0-9]{2,8}"
            maxLength={8}
            value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })}
            placeholder="OXY"
            title="2 à 8 lettres ou chiffres"
            className={`${CHAMP} uppercase`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nom
          <input required minLength={2} maxLength={80} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="CM Oxygène médical" className={CHAMP} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nom court (portail)
          <input required minLength={2} maxLength={40} value={f.nomCourt} onChange={(e) => setF({ ...f, nomCourt: e.target.value })} placeholder="Oxygène médical" className={CHAMP} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Description <span className="font-normal text-encre-3">(affichée au client sur le portail)</span>
        <textarea rows={2} maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`${CHAMP} resize-y py-2`} />
      </label>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-semibold">Pictogramme</legend>
        <div className="flex flex-wrap gap-2">
          {icones.map((d, i) => (
            <label
              key={d}
              className={`grid size-11 cursor-pointer place-items-center rounded-champ border ${f.icone === d ? "border-2 border-marque bg-marque-pale text-marque" : "border-bord-fort bg-surface text-encre-3"}`}
            >
              <input type="radio" name="icone" checked={f.icone === d} onChange={() => setF({ ...f, icone: d })} className="sr-only" aria-label={`Pictogramme ${i + 1}`} />
              <IconeTrace d={d} taille={20} />
            </label>
          ))}
        </div>
      </fieldset>
      <p className="m-0 text-[0.8125rem] text-encre-3">Désignez ensuite le responsable et les équipes avec « Modifier ».</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={fermer} className={BOUTON_SECONDAIRE}>
          Annuler
        </button>
        <button type="submit" disabled={enCours} className={BOUTON_PRINCIPAL}>
          {enCours ? "Création…" : "Créer l'activité"}
        </button>
      </div>
    </form>
  );
}
