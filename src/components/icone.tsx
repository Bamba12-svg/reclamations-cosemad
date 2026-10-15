/**
 * Icônes au trait (1,75 px) reprises des maquettes. Décoratives par défaut (aria-hidden) :
 * le texte ou l'aria-label du bouton porte le sens.
 */
export const ICONES = {
  alerte: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20M12 8v4M12 16h.01",
  recherche: "M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16M21 21l-4.3-4.3",
  plus: "M5 12h14M12 5v14",
  cloche: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  chevronBas: "m6 9 6 6 6-6",
  chevronGauche: "m15 18-6-6 6-6",
  deconnexion: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  panneau: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 3v18",
  tableauDeBord:
    "M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM4 16h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z",
  reclamations:
    "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  mesActions: "m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8",
  aViser:
    "M12 20h9M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
  parametres: "M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4",
  cadenas: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4",
  chantier: "M2 20h20M5 20V9l7-5 7 5v11M9 20v-6h6v6",
} as const;

export type NomIcone = keyof typeof ICONES;

export function Icone({
  nom,
  taille = 20,
  epaisseur = 1.75,
  className,
  titre,
}: {
  nom: NomIcone;
  taille?: number;
  epaisseur?: number;
  className?: string;
  titre?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={titre ? undefined : true}
      role={titre ? "img" : undefined}
      focusable="false"
    >
      {titre && <title>{titre}</title>}
      <path d={ICONES[nom]} />
    </svg>
  );
}

/** Tracé fourni par la base (icône d'une activité). */
export function IconeTrace({ d, taille = 20, className }: { d: string; taille?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
