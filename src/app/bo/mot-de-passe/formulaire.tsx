"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef } from "react";
import { Icone } from "@/components/icone";
import { seDeconnecter } from "../actions";
import { choisirMotDePasse, type EtatMotDePasse } from "./actions";

const champ =
  "min-h-11.5 rounded-champ border bg-surface px-3.5 text-base outline-offset-0 focus-visible:outline-2 focus-visible:outline-marque";

export function FormulaireMotDePasse({
  nom,
  email,
  societe,
  longueurMin,
}: {
  nom: string;
  email: string;
  societe: { nom: string; logo: string } | null;
  longueurMin: number;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatMotDePasse, FormData>(choisirMotDePasse, { erreur: null });
  const refMotDePasse = useRef<HTMLInputElement>(null);
  const refConfirmation = useRef<HTMLInputElement>(null);
  const erreurMdp = etat.champs?.motDePasse;
  const erreurConf = etat.champs?.confirmation;

  // Focus sur le premier champ en erreur après l'envoi.
  useEffect(() => {
    if (erreurMdp) refMotDePasse.current?.focus();
    else if (erreurConf) refConfirmation.current?.focus();
  }, [etat, erreurMdp, erreurConf]);

  return (
    <main className="grid min-h-screen place-items-center bg-fond p-6 text-[0.9375rem]">
      <div className="flex w-full max-w-104 flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {societe && <Image src={societe.logo} alt={societe.nom} width={224} height={64} priority className="h-16 w-auto max-w-56 object-contain" />}
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Choisissez votre mot de passe</h1>
            <p className="m-0 text-encre-3 text-pretty">
              Bonjour {nom}, votre mot de passe actuel est provisoire. Remplacez-le par un mot de passe personnel pour continuer.
            </p>
          </div>
        </div>

        <form
          action={envoyer}
          noValidate
          className="flex flex-col gap-4.5 rounded-carte border border-bord bg-surface p-[clamp(1.25rem,4vw,2rem)] shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
        >
          {/* Identifiant pour les gestionnaires de mots de passe (non modifiable). */}
          <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="l-nouveau" className="font-semibold">
              Nouveau mot de passe
            </label>
            <input
              ref={refMotDePasse}
              id="l-nouveau"
              name="motDePasse"
              type="password"
              autoComplete="new-password"
              required
              minLength={longueurMin}
              aria-invalid={!!erreurMdp}
              aria-describedby={erreurMdp ? "aide-nouveau erreur-nouveau" : "aide-nouveau"}
              className={`${champ} ${erreurMdp ? "border-retard" : "border-bord-fort"}`}
            />
            <p id="aide-nouveau" className="m-0 text-[0.8125rem] text-encre-3">
              Au moins {longueurMin} caractères, avec au moins une lettre et un chiffre.
            </p>
            {erreurMdp && (
              <p id="erreur-nouveau" className="m-0 flex items-center gap-2 text-sm text-retard">
                <Icone nom="alerte" taille={16} epaisseur={2} className="flex-none" />
                {erreurMdp}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="l-confirmation" className="font-semibold">
              Confirmez le mot de passe
            </label>
            <input
              ref={refConfirmation}
              id="l-confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!erreurConf}
              aria-describedby={erreurConf ? "erreur-confirmation" : undefined}
              className={`${champ} ${erreurConf ? "border-retard" : "border-bord-fort"}`}
            />
            {erreurConf && (
              <p id="erreur-confirmation" className="m-0 flex items-center gap-2 text-sm text-retard">
                <Icone nom="alerte" taille={16} epaisseur={2} className="flex-none" />
                {erreurConf}
              </p>
            )}
          </div>

          {etat.erreur && (
            <p role="alert" className="m-0 flex items-center gap-2 text-sm text-retard">
              <Icone nom="alerte" taille={16} epaisseur={2} className="flex-none" />
              {etat.erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-champ border-0 bg-marque text-base font-semibold text-white hover:bg-marque-fonce disabled:cursor-not-allowed disabled:opacity-80"
          >
            {enCours && <span aria-hidden="true" className="size-4.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {enCours ? "Enregistrement…" : "Enregistrer et continuer"}
          </button>
        </form>

        <form action={seDeconnecter} className="text-center">
          <button type="submit" className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-marque hover:bg-marque-pale">
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
