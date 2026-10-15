"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Icone } from "@/components/icone";
import { seConnecter, type EtatConnexion } from "./actions";

interface SocieteConnexion {
  slug: string;
  nom: string;
  domaine: string;
  logo: string;
}

const champ =
  "min-h-11.5 rounded-champ border bg-surface px-3.5 text-base outline-offset-0 focus-visible:outline-2 focus-visible:outline-marque";

export function FormulaireConnexion({
  societes,
  societeInitiale,
  compteDemo,
}: {
  societes: SocieteConnexion[];
  societeInitiale: string;
  compteDemo: { email: string; motDePasse: string } | null;
}) {
  const [slug, setSlug] = useState(societeInitiale);
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [aideOuverte, setAideOuverte] = useState(false);
  const [etat, envoyer, enCours] = useActionState<EtatConnexion, FormData>(seConnecter, { erreur: null });

  const societe = societes.find((s) => s.slug === slug) ?? societes[0];
  const bordure = etat.erreur ? "border-retard" : "border-bord-fort";

  const choisir = (nouveau: string) => {
    setSlug(nouveau);
    window.history.replaceState(null, "", `/bo/connexion?societe=${nouveau}`);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-fond p-6 text-[0.9375rem]">
      <div className="flex w-full max-w-104 flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {societe && (
            <Image src={societe.logo} alt={societe.nom} width={224} height={64} priority className="h-16 w-auto max-w-56 object-contain" />
          )}
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Gestion des réclamations</h1>
            <p className="m-0 text-encre-3">Espace réservé aux collaborateurs de {societe?.nom}.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span id="libelle-societe" className="text-center text-[0.8125rem] font-semibold text-encre-3">
            Votre société
          </span>
          <div role="group" aria-labelledby="libelle-societe" className="grid grid-cols-3 gap-2">
            {societes.map((s) => {
              const actif = s.slug === slug;
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => choisir(s.slug)}
                  aria-pressed={actif}
                  title={`${s.nom} · ${s.domaine}`}
                  className={`grid min-h-15 cursor-pointer place-items-center rounded-carte bg-surface p-2 hover:border-marque ${
                    actif ? "border-2 border-marque" : "border border-bord-fort"
                  }`}
                >
                  <Image src={s.logo} alt={s.nom} width={120} height={36} className="max-h-9 w-auto max-w-full object-contain" />
                </button>
              );
            })}
          </div>
        </div>

        <form
          action={envoyer}
          className="flex flex-col gap-4.5 rounded-carte border border-bord bg-surface p-[clamp(1.25rem,4vw,2rem)] shadow-[0_1px_3px_rgba(16,24,40,0.06)]"
        >
          <input type="hidden" name="societe" value={slug} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="l-mail" className="font-semibold">
              E-mail professionnel
            </label>
            <input
              id="l-mail"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!etat.erreur}
              aria-describedby={etat.erreur ? "erreur-connexion" : undefined}
              className={`${champ} ${bordure}`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="l-pwd" className="font-semibold">
                Mot de passe
              </label>
              <button
                type="button"
                onClick={() => setAideOuverte((v) => !v)}
                aria-expanded={aideOuverte}
                aria-controls="aide-mot-de-passe"
                className="cursor-pointer border-0 bg-transparent p-0 text-sm font-medium text-marque hover:text-marque-fonce hover:underline"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <input
              id="l-pwd"
              name="motDePasse"
              type="password"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              aria-invalid={!!etat.erreur}
              aria-describedby={etat.erreur ? "erreur-connexion" : undefined}
              className={`${champ} ${bordure}`}
            />
            {aideOuverte && (
              <p id="aide-mot-de-passe" className="m-0 rounded-champ bg-marque-pale px-3 py-2 text-sm text-marque-encre">
                Contactez le Service QHSE : il réinitialise votre mot de passe depuis les Paramètres.
              </p>
            )}
          </div>

          {etat.erreur && (
            <p id="erreur-connexion" role="alert" className="m-0 flex items-center gap-2 text-sm text-retard">
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
            {enCours ? "Connexion…" : "Se connecter"}
          </button>
          {compteDemo && (
            <button
              type="button"
              onClick={() => {
                setEmail(compteDemo.email);
                setMotDePasse(compteDemo.motDePasse);
              }}
              className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent text-sm font-semibold text-marque hover:bg-marque-pale"
            >
              Remplir avec le compte de démonstration
            </button>
          )}
        </form>

        <p className="m-0 text-center text-[0.8125rem] text-encre-4">
          <Link href="/">Portail client</Link>
        </p>
      </div>
    </main>
  );
}
