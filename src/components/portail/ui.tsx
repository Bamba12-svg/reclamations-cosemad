/** Petits éléments d'interface du portail, repris du design system des maquettes. */
import type { ReactNode } from "react";
import { Icone } from "@/components/icone";

export function MessageErreur({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="m-0 flex items-center gap-1.5 text-sm text-retard">
      <Icone nom="alerte" taille={16} epaisseur={2} className="flex-none" />
      {children}
    </p>
  );
}

export const classeChamp = (erreur?: string) =>
  `min-h-12 w-full rounded-champ border bg-surface px-3.5 text-base ${erreur ? "border-retard" : "border-bord-fort"}`;

/** Grande option à choix unique (activité, type, première fois). */
export function OptionChoix({
  actif,
  onClick,
  titre,
  detail,
  icone,
}: {
  actif: boolean;
  onClick: () => void;
  titre: string;
  detail?: string;
  icone?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex min-h-15 w-full cursor-pointer items-center gap-3.5 rounded-carte px-4 py-3 text-left hover:border-marque ${
        actif ? "border-2 border-marque bg-marque-pale" : "border border-bord-fort bg-surface"
      }`}
    >
      {icone && <span className="grid size-10 flex-none place-items-center rounded-champ bg-marque-pale text-marque">{icone}</span>}
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">{titre}</span>
        {detail && <span className="text-sm text-encre-3">{detail}</span>}
      </span>
      <span aria-hidden="true" className={`grid size-5.5 flex-none place-items-center rounded-full border-2 ${actif ? "border-marque" : "border-encre-5"}`}>
        <span className={`size-2.5 rounded-full ${actif ? "bg-marque" : "bg-transparent"}`} />
      </span>
    </button>
  );
}

/** Pastille de choix (secteur, qualité / prix / fonctionnement). */
export function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`min-h-11 cursor-pointer rounded-full border px-4 text-[0.9375rem] font-medium ${
        actif ? "border-marque bg-marque text-white" : "border-bord-fort bg-surface text-encre-2"
      }`}
    >
      {children}
    </button>
  );
}

export function BoutonPrincipal({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-carte border-0 bg-marque text-[1.0625rem] font-semibold text-white hover:bg-marque-fonce disabled:cursor-not-allowed disabled:opacity-80"
    >
      {children}
    </button>
  );
}

export function BoutonSecondaire({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-carte border border-bord-fort bg-surface text-base font-semibold text-encre hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

export function Roue() {
  return <span aria-hidden="true" className="size-4.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}
