"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FournisseurToast, useOperation, useToast } from "@/components/bo/outils";
import { actionReinitialiserDemo } from "./actions";

/** Fournit les messages flottants à tous les onglets ; annonce le résultat d'une réinitialisation. */
export function ZoneParametres({ children, annonce }: { children: ReactNode; annonce: string | null }) {
  return (
    <FournisseurToast>
      <Annonce texte={annonce} />
      {children}
    </FournisseurToast>
  );
}

function Annonce({ texte }: { texte: string | null }) {
  const annoncer = useToast();
  const fait = useRef(false);
  useEffect(() => {
    if (texte && !fait.current) {
      fait.current = true;
      annoncer(texte);
    }
  }, [texte, annoncer]);
  return null;
}

/** « Réinitialiser les données de démonstration » : un second clic confirme (l'opération vide la base). */
export function Reinitialiser({ slug }: { slug: string }) {
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, lancer] = useOperation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmer && !enCours && <span className="text-sm text-encre-3">Toutes les données seront remplacées.</span>}
      <button
        type="button"
        disabled={enCours}
        onClick={() => (confirmer ? lancer(() => actionReinitialiserDemo(slug), { succes: false }) : setConfirmer(true))}
        onBlur={() => !enCours && setConfirmer(false)}
        className={`min-h-11 cursor-pointer rounded-champ border-0 px-4 font-medium disabled:cursor-wait ${confirmer ? "bg-retard-fond text-retard" : "bg-transparent text-encre-3 hover:bg-surface-3"}`}
      >
        {enCours ? "Réinitialisation…" : confirmer ? "Confirmer la réinitialisation" : "Réinitialiser les données de démonstration"}
      </button>
    </div>
  );
}
