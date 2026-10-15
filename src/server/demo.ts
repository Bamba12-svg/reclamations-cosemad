/**
 * Mode démonstration (MODE_DEMO=1) : bouton « Remplir avec le compte de démonstration » et menu
 * « Simuler un profil ». À désactiver (MODE_DEMO=0) dès que de vraies données sont saisies.
 */
export function modeDemo(): boolean {
  return process.env.MODE_DEMO === "1";
}

export const COMPTE_DEMO = { email: "fatou.sarr@cosemad.sn", motDePasse: "demo2026" } as const;

/** Exemples de suivi affichés sur le portail en mode démo (réclamations des maquettes). */
export const EXEMPLES_SUIVI: Record<string, { numero: string; telephone: string }> = {
  CM: { numero: "CM-2026-0042", telephone: "+221 77 412 35 08" },
  SON: { numero: "SON-2026-0027", telephone: "+221 33 879 40 12" },
  FLS: { numero: "FLS-2026-0032", telephone: "+221 33 822 61 37" },
};
