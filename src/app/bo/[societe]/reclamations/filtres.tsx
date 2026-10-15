"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconeTrace } from "@/components/icone";

interface Option {
  valeur: string;
  libelle: string;
}

const SELECTS: { cle: string; libelle: string; tous: string }[] = [
  { cle: "statut", libelle: "Statut", tous: "Tous les statuts" },
  { cle: "type", libelle: "Type", tous: "Tous les types" },
  { cle: "mode", libelle: "Mode de transmission", tous: "Tous les modes" },
  { cle: "responsable", libelle: "Responsable", tous: "Tous les responsables" },
  { cle: "recurrent", libelle: "Récurrent", tous: "Récurrent : tous" },
];

/** Barre de filtres : chaque choix met à jour l'URL (lien partageable, bouton « Précédent » du navigateur). */
export function BarreFiltres({ options, total }: { options: Record<string, Option[]>; total: number }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const params = useSearchParams();
  const [chargement, demarrer] = useTransition();

  const changer = (cle: string, valeur: string) => {
    const p = new URLSearchParams(params.toString());
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    p.delete("page");
    demarrer(() => routeur.replace(`${chemin}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  const effacer = () => {
    const p = new URLSearchParams();
    const onglet = params.get("activite");
    if (onglet) p.set("activite", onglet);
    demarrer(() => routeur.replace(`${chemin}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  const actifs = [...SELECTS.map((s) => s.cle), "q"].some((c) => params.get(c));

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={chargement}>
      <span className="mr-1 flex items-center gap-1.5 text-sm font-semibold text-encre-2">
        <IconeTrace d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" taille={16} />
        Filtres
      </span>
      {SELECTS.map((s) => (
        <select
          key={s.cle}
          aria-label={s.libelle}
          value={params.get(s.cle) ?? ""}
          onChange={(e) => changer(s.cle, e.target.value)}
          className="min-h-11 cursor-pointer rounded-champ border border-bord-fort bg-surface px-3 text-sm"
        >
          <option value="">{s.tous}</option>
          {(options[s.cle] ?? []).map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
      ))}
      {params.get("q") && (
        <button
          type="button"
          onClick={() => changer("q", "")}
          aria-label={`Retirer la recherche « ${params.get("q")} »`}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-marque bg-marque-pale px-3 text-sm font-medium text-marque"
        >
          Recherche : « {params.get("q")} »
          <IconeTrace d="M18 6 6 18M6 6l12 12" taille={14} />
        </button>
      )}
      {actifs && (
        <button type="button" onClick={effacer} className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-marque hover:bg-marque-pale">
          Effacer les filtres
        </button>
      )}
      <span className="ml-auto flex items-center gap-2 text-sm text-encre-3 tabular-nums" role="status">
        {chargement && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-bord-fort border-t-marque" />}
        {total} {total > 1 ? "réclamations" : "réclamation"}
      </span>
    </div>
  );
}

/** Ligne cliquable : le lien du numéro reste le vrai lien (clavier, lecteurs d'écran, clic molette). */
export function LigneCliquable({ href, enRetard, children }: { href: string; enRetard: boolean; children: React.ReactNode }) {
  const routeur = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        routeur.push(href);
      }}
      className={`group cursor-pointer border-b border-surface-3 hover:bg-[#F5F8FC] ${enRetard ? "bg-retard-ligne" : "bg-surface"}`}
    >
      {children}
    </tr>
  );
}
