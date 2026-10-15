/**
 * Mode démonstration (MODE_DEMO=1) : bouton « Remplir avec le compte de démonstration » et menu
 * « Simuler un profil ». À désactiver (MODE_DEMO=0) dès que de vraies données sont saisies.
 */
export function modeDemo(): boolean {
  return process.env.MODE_DEMO === "1";
}

export const COMPTE_DEMO = { email: "fatou.sarr@cosemad.sn", motDePasse: "demo2026" } as const;
