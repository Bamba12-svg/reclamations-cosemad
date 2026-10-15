"use client";

import Link from "next/link";
import { BOUTON_SECONDAIRE, FournisseurToast, Pastille, useOperation } from "@/components/bo/outils";
import type { ActionAFaire } from "@/server/requetes/listes";
import { actionModifierAction } from "../reclamations/[numero]/actions";

export function ListeActions({ actions, slug }: { actions: ActionAFaire[]; slug: string }) {
  return (
    <FournisseurToast>
      {actions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-carte border border-bord bg-surface px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-traitee-fond text-traitee">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="m-0 text-base font-semibold">Aucune action à réaliser</p>
          <p className="m-0 max-w-104 text-encre-3">Les actions qui vous seront confiées apparaîtront ici, avec leur échéance.</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {actions.map((a) => (
            <Ligne key={a.id} action={a} slug={slug} />
          ))}
        </ul>
      )}
    </FournisseurToast>
  );
}

/** Pastille d'urgence de la maquette : « Dépassée », « Aujourd'hui », « J-n » (orange à 2 jours ou moins). */
function Urgence({ ecart }: { ecart: number }) {
  const couleurs =
    ecart < 0 ? "border-retard-bord bg-retard-fond text-retard" : ecart <= 2 ? "border-encours-bord bg-encours-fond text-encours" : "border-bord bg-surface-3 text-encre-2";
  return (
    <span className={`inline-flex min-w-22 items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-[0.8125rem] font-bold tabular-nums ${couleurs}`}>
      {ecart < 0 && (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01" />
        </svg>
      )}
      {ecart < 0 ? "Dépassée" : ecart === 0 ? "Aujourd'hui" : `J-${ecart}`}
    </span>
  );
}

function Ligne({ action: a, slug }: { action: ActionAFaire; slug: string }) {
  const [enCours, lancer] = useOperation();
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-carte border border-bord bg-surface px-5 py-4 shadow-carte" aria-busy={enCours}>
      <Urgence ecart={a.ecart} />
      <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-0.5">
        <span className="font-semibold">{a.libelle}</span>
        <span className="text-sm text-encre-3">
          <Link href={`/bo/${slug}/reclamations/${a.numero}`} className="font-semibold no-underline tabular-nums hover:underline">
            {a.numero}
          </Link>{" "}
          · {a.client} · Échéance {a.echeance}
        </span>
        {a.critere && <span className="text-[0.8125rem] text-encre-3">Critère : {a.critere}</span>}
      </div>
      <button
        type="button"
        disabled={enCours}
        onClick={() =>
          lancer(() => actionModifierAction(slug, a.numero, a.id, { champ: "statut", valeur: "REALISEE" }), {
            succes: "Action marquée comme réalisée. Pensez à évaluer son efficacité.",
          })
        }
        className={BOUTON_SECONDAIRE}
      >
        {enCours ? (
          <Pastille />
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
        Marquer comme réalisée
        <span className="sr-only"> : {a.libelle}</span>
      </button>
    </li>
  );
}
