"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import type { Resultat } from "@/server/fiche/operations";

// ───────── Message flottant (« toast ») de la maquette : bas à droite, 3 secondes ─────────

type Ton = "ok" | "erreur";
interface Toast {
  id: number;
  texte: string;
  ton: Ton;
}

const ContexteToast = createContext<(texte: string, ton?: Ton) => void>(() => undefined);

export function FournisseurToast({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout>>(undefined);
  const annoncer = useCallback((texte: string, ton: Ton = "ok") => {
    clearTimeout(minuterie.current);
    setToast({ id: Date.now(), texte, ton });
    minuterie.current = setTimeout(() => setToast(null), ton === "erreur" ? 6000 : 3000);
  }, []);
  useEffect(() => () => clearTimeout(minuterie.current), []);

  return (
    <ContexteToast.Provider value={annoncer}>
      {children}
      {/* Région annoncée par les lecteurs d'écran ; les erreurs sont « assertive ». */}
      <div aria-live="polite" className="sr-only">
        {toast?.ton === "ok" ? toast.texte : ""}
      </div>
      <div role="alert" className="sr-only">
        {toast?.ton === "erreur" ? toast.texte : ""}
      </div>
      {toast && (
        <div
          key={toast.id}
          aria-hidden="true"
          className="fixed right-6 bottom-6 z-60 flex max-w-[min(28rem,calc(100vw-2rem))] animate-[toastIn_0.25s_ease-out] items-center gap-2.5 rounded-carte bg-encre px-4.5 py-3.5 text-[0.9375rem] text-white shadow-flottant max-sm:right-4 max-sm:bottom-4"
        >
          {toast.ton === "ok" ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6CE9A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FDA29B" strokeWidth="2" strokeLinecap="round" className="flex-none">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          )}
          {toast.texte}
        </div>
      )}
    </ContexteToast.Provider>
  );
}

export const useToast = () => useContext(ContexteToast);

/**
 * Lance une action serveur : indicateur « en cours », message de réussite (celui du serveur par
 * défaut) ou d'erreur. `echec` permet de remettre un champ à sa valeur précédente.
 */
export function useOperation() {
  const annoncer = useToast();
  const [enCours, demarrer] = useTransition();
  const lancer = useCallback(
    (operation: () => Promise<Resultat>, options: { succes?: string | false; echec?: () => void; reussite?: () => void } = {}) =>
      demarrer(async () => {
        try {
          const r = await operation();
          if (r.ok) {
            const texte = options.succes === false ? null : (options.succes ?? r.message);
            if (texte) annoncer(texte);
            options.reussite?.();
          } else {
            annoncer(r.erreur, "erreur");
            options.echec?.();
          }
        } catch {
          annoncer("Connexion au serveur impossible. Vérifiez le réseau et réessayez.", "erreur");
          options.echec?.();
        }
      }),
    [annoncer],
  );
  return [enCours, lancer] as const;
}

// ───────── Éléments de mise en page communs ─────────

export function Carte({ children, className = "", etiquette }: { children: ReactNode; className?: string; etiquette?: string }) {
  return (
    <section aria-label={etiquette} className={`flex flex-col gap-4 rounded-carte border border-bord bg-surface px-6 py-5 shadow-carte max-sm:px-4 ${className}`}>
      {children}
    </section>
  );
}

export function TitreSection({ numero, children, id }: { numero: number; children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="m-0 flex items-center gap-2.5 text-[1.0625rem]">
      <span aria-hidden="true" className="grid size-6.5 place-items-center rounded-[0.4375rem] bg-marque-pale text-[0.8125rem] text-marque">
        {numero}
      </span>
      {children}
    </h2>
  );
}

export function CarteLaterale({ titre, action, children }: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-carte border border-bord bg-surface px-5 py-4.5 shadow-carte">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-base">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const BOUTON_PRINCIPAL =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-champ border-0 bg-marque px-4.5 font-semibold text-white hover:bg-marque-fonce disabled:cursor-not-allowed disabled:bg-bord disabled:text-encre-3";
export const BOUTON_SECONDAIRE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-champ border border-bord-fort bg-surface px-4 font-semibold text-encre-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-55";
export const BOUTON_LIEN =
  "inline-flex min-h-11 cursor-pointer items-center rounded-lg border-0 bg-transparent px-2 text-[0.8125rem] font-semibold text-marque hover:bg-marque-pale disabled:cursor-not-allowed disabled:opacity-55";
export const CHAMP =
  "w-full min-h-11 rounded-lg border border-bord-fort bg-surface px-2.5 text-sm text-encre disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-encre-2";

export function Pastille({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block size-3.5 animate-spin rounded-full border-2 border-bord-fort border-t-marque ${className}`} />;
}
