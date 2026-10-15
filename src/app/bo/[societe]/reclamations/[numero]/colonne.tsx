"use client";

import { useRef, useState } from "react";
import type { VueFiche } from "@/server/fiche/lecture";
import { actionAjouterPieces, actionCommenter } from "./actions";
import { BOUTON_SECONDAIRE, CarteLaterale, Pastille, useOperation, useToast } from "./outils";

const TAILLE_MAX = 10 * 1024 * 1024;

/** Colonne de droite : « Avant de clôturer », pièces jointes, commentaires internes, historique. */
export function Colonne({ vue, slug }: { vue: VueFiche; slug: string }) {
  return (
    <aside aria-label="Suivi de la fiche" className="flex max-w-full min-w-0 flex-[1_1_19rem] flex-col gap-5">
      {!vue.cloturee && vue.manquantes > 0 && <AvantDeCloturer vue={vue} />}
      <PiecesJointes vue={vue} slug={slug} />
      <Commentaires vue={vue} slug={slug} />
      <Historique vue={vue} />
    </aside>
  );
}

function AvantDeCloturer({ vue }: { vue: VueFiche }) {
  return (
    <CarteLaterale titre="Avant de clôturer">
      <ul id="avant-de-cloturer" className="m-0 flex list-none flex-col gap-2 p-0">
        {vue.conditions.map((c) => (
          <li key={c.cle} className={`flex items-start gap-2 text-sm ${c.remplie ? "text-encre-3" : "text-encre"}`}>
            {c.remplie ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#067647" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#98A2B3" strokeWidth="2" className="flex-none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
              </svg>
            )}
            <span>
              {c.libelle}
              <span className="sr-only">{c.remplie ? " : fait" : " : à faire"}</span>
            </span>
          </li>
        ))}
      </ul>
    </CarteLaterale>
  );
}

function PiecesJointes({ vue, slug }: { vue: VueFiche; slug: string }) {
  const [enCours, lancer] = useOperation();
  const annoncer = useToast();
  const choix = useRef<HTMLInputElement>(null);
  const base = `/bo/${slug}/reclamations/${vue.numero}/pieces`;

  const envoyer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichiers = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = ""; // permet de rechoisir le même fichier après une erreur
    if (fichiers.length === 0) return;
    const tropLourd = fichiers.find((f) => f.size > TAILLE_MAX);
    if (tropLourd) return annoncer(`« ${tropLourd.name} » dépasse 10 Mo.`, "erreur");
    const donnees = new FormData();
    for (const f of fichiers) donnees.append("fichiers", f);
    lancer(() => actionAjouterPieces(slug, vue.numero, donnees));
  };

  return (
    <CarteLaterale
      titre="Pièces jointes"
      action={
        vue.droits.pieces && (
          <>
            <button
              type="button"
              onClick={() => choix.current?.click()}
              disabled={enCours}
              aria-label="Ajouter une pièce jointe"
              title="Ajouter une pièce jointe (photo JPG, PNG ou PDF, 10 Mo maximum)"
              className="grid size-11 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-marque hover:bg-marque-pale disabled:cursor-wait"
            >
              {enCours ? (
                <Pastille />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h14M12 5v14" />
                </svg>
              )}
            </button>
            <input ref={choix} type="file" multiple accept="image/jpeg,image/png,application/pdf" onChange={envoyer} className="hidden" tabIndex={-1} aria-hidden="true" />
          </>
        )
      }
    >
      {vue.pieces.length === 0 ? (
        <p className="m-0 text-sm text-encre-3">Aucune pièce jointe.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {vue.pieces.map((p) => (
            <li key={p.id} className="min-w-0">
              <a href={`${base}/${p.id}`} target="_blank" rel="noopener" title={p.nom} className="group flex min-w-0 flex-col gap-1 no-underline">
                <span className="relative grid aspect-square place-items-center rounded-lg border border-bord bg-surface-3 text-encre-3 group-hover:border-marque group-hover:text-marque">
                  {p.image ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    </svg>
                  )}
                  <span className="absolute right-1 bottom-1 rounded bg-surface px-1 text-[0.625rem] font-bold text-encre-2">{p.ext}</span>
                </span>
                <span className="relative truncate text-xs text-encre-2 group-hover:text-marque">
                  {p.nom}
                  <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </CarteLaterale>
  );
}

function Commentaires({ vue, slug }: { vue: VueFiche; slug: string }) {
  const [texte, setTexte] = useState("");
  const [enCours, lancer] = useOperation();
  const publier = () => {
    if (!texte.trim()) return;
    lancer(() => actionCommenter(slug, vue.numero, texte), { reussite: () => setTexte("") });
  };
  return (
    <CarteLaterale titre="Commentaires internes">
      {vue.commentaires.length === 0 && <p className="m-0 text-sm text-encre-3">Aucun commentaire. Les commentaires ne sont jamais visibles par le client.</p>}
      {vue.commentaires.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-full bg-surface-3 text-[0.6875rem] font-bold text-encre-2">
            {c.initiales}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[0.8125rem]">
              <strong className="font-semibold">{c.auteur}</strong> <span className="text-encre-3 tabular-nums">· {c.quand}</span>
            </span>
            <span className="text-sm [overflow-wrap:anywhere] whitespace-pre-line">{c.texte}</span>
          </div>
        </div>
      ))}
      {vue.droits.commenter && (
        <>
          <textarea
            aria-label="Nouveau commentaire"
            rows={2}
            maxLength={2000}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) publier();
            }}
            placeholder="Écrire un commentaire interne…"
            className="resize-y rounded-champ border border-bord-fort px-3 py-2.5 text-sm"
          />
          <button type="button" onClick={publier} disabled={!texte.trim() || enCours} className={`${BOUTON_SECONDAIRE} self-end`}>
            {enCours ? "Publication…" : "Publier"}
          </button>
        </>
      )}
    </CarteLaterale>
  );
}

function Historique({ vue }: { vue: VueFiche }) {
  return (
    <CarteLaterale titre="Historique">
      <ol className="m-0 flex list-none flex-col p-0">
        {vue.historique.map((h, i) => (
          <li key={h.id} className="grid grid-cols-[0.75rem_1fr] gap-3">
            <div className="flex flex-col items-center" aria-hidden="true">
              <span className="mt-1.5 size-2 flex-none rounded-full bg-encre-5" />
              {i < vue.historique.length - 1 && <span className="w-px flex-1 bg-bord" />}
            </div>
            <div className="flex flex-col gap-0.5 pb-3.5">
              <span className="text-sm text-encre">{h.libelle}</span>
              <span className="text-xs text-encre-3 tabular-nums">
                {h.quand} · {h.qui}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </CarteLaterale>
  );
}
