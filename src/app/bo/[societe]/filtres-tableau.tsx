"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** Période et activité du tableau de bord : gardées dans l'URL (lien partageable, bouton « Précédent »). */
export function FiltresTableau({ periodes, activites }: { periodes: readonly { valeur: string; libelle: string }[]; activites: { code: string; nom: string }[] }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const [chargement, demarrer] = useTransition();
  const changer = (cle: string, valeur: string) => {
    const p = new URLSearchParams(params.toString());
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    demarrer(() => routeur.replace(`${chemin}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  const select = "min-h-11 cursor-pointer rounded-champ border border-bord-fort bg-surface px-3 text-[0.9375rem] text-encre";
  return (
    <div className="flex flex-wrap items-end gap-2" aria-busy={chargement}>
      <label className="flex flex-col gap-1 text-[0.8125rem] font-medium text-encre-3">
        Période
        <select value={params.get("periode") ?? "365"} onChange={(e) => changer("periode", e.target.value === "365" ? "" : e.target.value)} className={select}>
          {periodes.map((p) => (
            <option key={p.valeur} value={p.valeur}>
              {p.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[0.8125rem] font-medium text-encre-3">
        Activité
        <select value={params.get("activite") ?? ""} onChange={(e) => changer("activite", e.target.value)} className={select}>
          <option value="">Toutes les activités</option>
          {activites.map((a) => (
            <option key={a.code} value={a.code}>
              {a.nom}
            </option>
          ))}
        </select>
      </label>
      {chargement && <span aria-hidden="true" className="mb-3.5 size-3.5 animate-spin rounded-full border-2 border-bord-fort border-t-marque" />}
    </div>
  );
}
