"use client";

import { useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, useOperation } from "@/components/bo/outils";
import { actionMessagerie, actionTesterMessagerie } from "./actions";

interface Props {
  slug: string;
  societe: string;
  messagerie: {
    emailEnvoi: string;
    nomExpediteur: string;
    hote: string;
    port: number;
    emailReponse: string;
    motDePasseEnregistre: boolean;
    motDePasseIllisible: boolean;
    source: "parametres" | "serveur" | "aucune";
    bloqueeDemo: boolean;
  };
}

const CHAMP = "min-h-11 rounded-champ border border-bord-fort bg-surface px-3.5 disabled:bg-surface-2";

/** Boîte d'envoi de la filiale : le QHSE la saisit, la change et la teste sans toucher au serveur. */
export function OngletMessagerie({ slug, societe, messagerie }: Props) {
  const [m, setM] = useState({ ...messagerie, motDePasse: "" });
  const [adresseTest, setAdresseTest] = useState("");
  const [enCours, lancer] = useOperation();
  const bloquee = messagerie.bloqueeDemo;
  const memeBoite = m.emailEnvoi.trim().toLowerCase() === messagerie.emailEnvoi;
  const garderMotDePasse = messagerie.motDePasseEnregistre && !messagerie.motDePasseIllisible && memeBoite;

  const etat = {
    parametres: { classe: "border-traitee-bord bg-traitee-fond text-[#05603A]", texte: `Les e-mails de ${societe} partent de ${messagerie.emailEnvoi}.` },
    serveur: { classe: "border-bord bg-surface-2 text-encre-2", texte: `Aucune boîte saisie ici : les e-mails de ${societe} utilisent la configuration du serveur.` },
    aucune: { classe: "border-encours-bord bg-encours-fond text-encours", texte: `Aucune boîte d'envoi : les clients de ${societe} ne reçoivent pas d'e-mail.` },
  }[messagerie.source];

  const enregistrer = () =>
    lancer(() => actionMessagerie(slug, { emailEnvoi: m.emailEnvoi, motDePasse: m.motDePasse, nomExpediteur: m.nomExpediteur, hote: m.hote, port: m.port, emailReponse: m.emailReponse }), {
      reussite: () => setM((x) => ({ ...x, motDePasse: "" })),
    });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[1.0625rem]">Messagerie de {societe}</h2>
        <p className="m-0 text-sm text-encre-3">
          L&apos;adresse depuis laquelle la plateforme écrit aux clients de {societe} (accusé de réception, réponse), et celle qui est prévenue de chaque nouvelle
          réclamation.
        </p>
      </div>

      <p role="status" className={`m-0 rounded-champ border px-3.5 py-2.5 text-sm ${etat.classe}`}>
        {etat.texte}
        {messagerie.motDePasseIllisible && " Le mot de passe enregistré n'est plus lisible (clé du serveur changée) : saisissez-le à nouveau."}
      </p>
      {bloquee && (
        <p className="m-0 rounded-champ border border-bord bg-surface-2 px-3.5 py-2.5 text-sm text-encre-2">
          Démonstration publique : la messagerie ne peut pas être modifiée ni testée.
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="msg-envoi" className="font-semibold">
            Adresse d&apos;envoi
          </label>
          <input
            id="msg-envoi"
            type="email"
            value={m.emailEnvoi}
            maxLength={254}
            autoComplete="off"
            placeholder="prenom.nom@filiale.sn"
            disabled={bloquee}
            aria-describedby="msg-envoi-aide"
            onChange={(e) => setM({ ...m, emailEnvoi: e.target.value })}
            className={CHAMP}
          />
          <p id="msg-envoi-aide" className="m-0 text-[0.8125rem] text-encre-3">
            Une vraie boîte de la filiale. Videz ce champ et enregistrez pour la retirer.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="msg-mdp" className="font-semibold">
            Mot de passe de cette boîte
          </label>
          <input
            id="msg-mdp"
            type="password"
            value={m.motDePasse}
            maxLength={200}
            autoComplete="new-password"
            placeholder={garderMotDePasse ? "••••••••••" : ""}
            disabled={bloquee}
            aria-describedby="msg-mdp-aide"
            onChange={(e) => setM({ ...m, motDePasse: e.target.value })}
            className={CHAMP}
          />
          <p id="msg-mdp-aide" className="m-0 text-[0.8125rem] text-encre-3">
            {garderMotDePasse ? "Enregistré et chiffré. Laissez vide pour le conserver." : "Il est enregistré chiffré et n'est plus jamais affiché."}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="msg-nom" className="font-semibold">
            Nom affiché au client
          </label>
          <input
            id="msg-nom"
            value={m.nomExpediteur}
            maxLength={120}
            disabled={bloquee}
            onChange={(e) => setM({ ...m, nomExpediteur: e.target.value })}
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="msg-reponse" className="font-semibold">
            Adresse de la filiale pour les réclamations
          </label>
          <input
            id="msg-reponse"
            type="email"
            value={m.emailReponse}
            maxLength={254}
            autoComplete="off"
            placeholder="Vide : la boîte d'envoi"
            disabled={bloquee}
            aria-describedby="msg-reponse-aide"
            onChange={(e) => setM({ ...m, emailReponse: e.target.value })}
            className={CHAMP}
          />
          <p id="msg-reponse-aide" className="m-0 text-[0.8125rem] text-encre-3">
            Reçoit un e-mail à chaque nouvelle réclamation, ainsi que les réponses des clients. Vide : la boîte d&apos;envoi.
          </p>
        </div>
      </div>

      <details className="rounded-champ border border-bord px-4 py-3">
        <summary className="cursor-pointer font-semibold text-encre-2">Serveur de messagerie (Infomaniak par défaut)</summary>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="msg-hote" className="font-semibold">
              Serveur SMTP
            </label>
            <input id="msg-hote" value={m.hote} maxLength={253} autoComplete="off" disabled={bloquee} onChange={(e) => setM({ ...m, hote: e.target.value })} className={CHAMP} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="msg-port" className="font-semibold">
              Port
            </label>
            <select id="msg-port" value={m.port} disabled={bloquee} onChange={(e) => setM({ ...m, port: Number(e.target.value) })} className={CHAMP}>
              <option value={465}>465 (SSL)</option>
              <option value={587}>587 (STARTTLS)</option>
            </select>
          </div>
        </div>
        <p className="m-0 mt-3 text-[0.8125rem] text-encre-3">Infomaniak : mail.infomaniak.com, port 465. Microsoft 365 : smtp.office365.com, port 587.</p>
      </details>

      <div className="flex justify-end">
        <button type="button" disabled={enCours || bloquee} onClick={enregistrer} className={BOUTON_PRINCIPAL}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <div className="h-px bg-surface-3" />
      <section aria-labelledby="titre-test-messagerie" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="titre-test-messagerie" className="m-0 text-base">
            Vérifier l&apos;envoi
          </h3>
          <p className="m-0 text-sm text-encre-3">Envoie un vrai e-mail depuis la boîte enregistrée. Enregistrez d&apos;abord vos modifications.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-1.5">
            <label htmlFor="msg-test" className="font-semibold">
              Adresse qui reçoit l&apos;e-mail de test
            </label>
            <input
              id="msg-test"
              type="email"
              value={adresseTest}
              maxLength={254}
              autoComplete="email"
              placeholder="Vide : l'adresse de votre compte"
              disabled={bloquee}
              onChange={(e) => setAdresseTest(e.target.value)}
              className={CHAMP}
            />
          </div>
          <button
            type="button"
            disabled={enCours || bloquee || messagerie.source === "aucune"}
            onClick={() => lancer(() => actionTesterMessagerie(slug, adresseTest))}
            title={messagerie.source === "aucune" ? "Enregistrez d'abord une boîte d'envoi." : undefined}
            className={BOUTON_SECONDAIRE}
          >
            Envoyer un e-mail de test
          </button>
        </div>
      </section>
    </>
  );
}
