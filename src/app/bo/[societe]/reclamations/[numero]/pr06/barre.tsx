"use client";

import Link from "next/link";
import { Icone } from "@/components/icone";

/** Barre de l'aperçu : retour, impression (feuille seule, voir globals.css) et téléchargement du PDF. */
export function BarreApercu({ retour, numero, pdf }: { retour: string; numero: string; pdf: string }) {
  return (
    <div data-print-hide="" className="flex w-full flex-wrap items-center justify-between gap-3">
      <Link href={retour} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg pr-3 pl-2 font-medium text-encre-3 no-underline hover:bg-surface-3 hover:text-encre">
        <Icone nom="chevronGauche" taille={18} />
        Retour à la fiche {numero}
      </Link>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-champ border border-bord-fort bg-surface px-4 font-semibold text-encre-2 hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
          Imprimer
        </button>
        <a href={pdf} download className="inline-flex min-h-11 items-center gap-2 rounded-champ bg-marque px-4.5 font-semibold text-white no-underline hover:bg-marque-fonce hover:text-white">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Télécharger le PDF
        </a>
      </div>
    </div>
  );
}
