"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconeTrace } from "@/components/icone";
import type { SuiviClient } from "@/server/portail";
import { suivre } from "@/app/[societe]/actions";
import { BoutonPrincipal, BoutonSecondaire, MessageErreur, Roue, classeChamp } from "./ui";

export function SuiviReclamation({
  numeroInitial,
  exemple,
  prefixe,
}: {
  numeroInitial: string;
  exemple: { numero: string; telephone: string } | null;
  prefixe: string;
}) {
  const [resultat, setResultat] = useState<SuiviClient | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const champNumero = useRef<HTMLInputElement>(null);
  const champTel = useRef<HTMLInputElement>(null);
  const titreResultat = useRef<HTMLHeadingElement>(null);

  // Téléphone transmis par l'écran de confirmation (jamais dans l'URL).
  useEffect(() => {
    try {
      const tel = sessionStorage.getItem("cosemad_suivi_tel");
      if (tel && champTel.current && !champTel.current.value) champTel.current.value = `+221 ${tel}`;
    } catch {
      /* stockage indisponible */
    }
  }, []);

  useEffect(() => {
    if (resultat) titreResultat.current?.focus();
  }, [resultat]);

  const rechercher = (donnees: FormData) => {
    setErreur(null);
    demarrer(async () => {
      const r = await suivre(String(donnees.get("numero") ?? ""), String(donnees.get("telephone") ?? ""));
      if (r.ok) setResultat(r.suivi);
      else setErreur(r.erreur);
    });
  };

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[clamp(1.625rem,1.3rem+1.6vw,2rem)] leading-tight tracking-[-0.02em]">Suivre ma réclamation</h1>
        <p className="m-0 text-encre-3">Saisissez le numéro reçu par SMS et votre téléphone.</p>
      </div>

      {!resultat && (
        <form action={rechercher} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="t-num" className="text-[0.9375rem] font-semibold">
              Numéro de réclamation
            </label>
            <input
              ref={champNumero}
              id="t-num"
              name="numero"
              defaultValue={numeroInitial}
              placeholder={exemple?.numero ?? `${prefixe}-2026-0001`}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!erreur}
              aria-describedby={erreur ? "t-erreur" : undefined}
              onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())}
              className={`${classeChamp(erreur ?? undefined)} tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="t-tel" className="text-[0.9375rem] font-semibold">
              Téléphone
            </label>
            <input
              ref={champTel}
              id="t-tel"
              name="telephone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+221 77 000 00 00"
              aria-invalid={!!erreur}
              aria-describedby={erreur ? "t-erreur" : undefined}
              className={`${classeChamp(erreur ?? undefined)} tabular-nums`}
            />
          </div>
          {erreur && (
            <div role="alert">
              <MessageErreur id="t-erreur">{erreur}</MessageErreur>
            </div>
          )}
          <BoutonPrincipal type="submit" disabled={enCours}>
            {enCours && <Roue />}
            {enCours ? "Recherche…" : "Voir où en est ma réclamation"}
          </BoutonPrincipal>
          {exemple && (
            <p className="m-0 text-[0.8125rem] text-encre-4">
              Exemple de démonstration : {exemple.numero} · {exemple.telephone}
            </p>
          )}
        </form>
      )}

      {resultat && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 rounded-carte border border-bord bg-surface p-4.5 shadow-carte">
            <p className="m-0 text-[0.8125rem] text-encre-4">{resultat.activite}</p>
            <h2 ref={titreResultat} tabIndex={-1} className="m-0 text-[1.375rem] font-bold text-marque tabular-nums outline-none">
              {resultat.numero}
            </h2>
            <p className="m-0 mt-1 text-[0.9375rem] text-pretty text-encre-2">{resultat.description}</p>
          </div>

          <ol className="m-0 flex list-none flex-col p-0" aria-label="Avancement de votre réclamation">
            {resultat.etapes.map((e, i) => {
              const courante = i === resultat.etapes.map((x) => x.faite).lastIndexOf(true);
              const suivanteFaite = resultat.etapes[i + 1]?.faite ?? false;
              return (
                <li key={e.libelle} className="grid grid-cols-[2rem_1fr] gap-3.5" aria-current={courante ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-8 place-items-center rounded-full border-2 text-[0.8125rem] font-bold ${
                        e.faite ? (courante ? "border-marque bg-marque text-white" : "border-marque bg-marque-pale text-marque") : "border-bord-fort bg-surface text-encre-3"
                      }`}
                    >
                      {e.faite ? <IconeTrace d="M20 6 9 17l-5-5" taille={16} /> : i + 1}
                    </span>
                    {i < resultat.etapes.length - 1 && <span className={`min-h-6 w-0.5 flex-1 ${suivanteFaite ? "bg-marque" : "bg-bord-fort"}`} />}
                  </div>
                  <div className="pb-6">
                    <p className={`m-0 font-semibold ${e.faite ? "text-encre" : "text-encre-3"}`}>
                      {e.libelle}
                      <span className="sr-only">{e.faite ? " (fait)" : " (à venir)"}</span>
                    </p>
                    <p className="m-0 text-sm text-encre-3 tabular-nums">{e.texte}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {resultat.reponse ? (
            <div className="flex flex-col gap-2 rounded-carte border border-bord bg-surface p-4.5">
              <p className="m-0 text-[0.8125rem] font-semibold text-marque">Réponse de COSEMAD · {resultat.reponse.date}</p>
              <p className="m-0 text-base text-pretty">{resultat.reponse.texte}</p>
            </div>
          ) : (
            <p className="m-0 rounded-carte bg-surface-3 p-4 text-[0.9375rem] text-encre-2">
              Nos équipes travaillent sur votre demande. Vous recevrez la réponse par SMS dès qu&apos;elle sera prête.
            </p>
          )}

          <BoutonSecondaire
            type="button"
            onClick={() => {
              setResultat(null);
              setErreur(null);
            }}
          >
            Suivre une autre réclamation
          </BoutonSecondaire>
        </div>
      )}
    </section>
  );
}

