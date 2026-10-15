import { LIBELLE_STATUT, type StatutReclamation } from "@/lib/libelles";

const STYLES: Record<StatutReclamation, { classe: string; trace: string }> = {
  NOUVELLE: { classe: "bg-nouvelle-fond text-nouvelle border-nouvelle-bord", trace: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4" },
  EN_COURS: { classe: "bg-encours-fond text-encours border-encours-bord", trace: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 6v6l4 2" },
  EN_RETARD: {
    classe: "bg-retard-fond text-retard border-retard-bord",
    trace: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01",
  },
  TRAITEE: { classe: "bg-traitee-fond text-traitee border-traitee-bord", trace: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20m-3 10 2 2 4-4" },
};

/** Badge de statut (couleur + icône + texte : le statut ne repose jamais sur la couleur seule). */
export function BadgeStatut({ statut }: { statut: StatutReclamation }) {
  const s = STYLES[statut];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border py-0.75 pr-2.5 pl-2 text-[0.8125rem] leading-5 font-semibold whitespace-nowrap ${s.classe}`}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
        <path d={s.trace} />
      </svg>
      {LIBELLE_STATUT[statut]}
    </span>
  );
}
