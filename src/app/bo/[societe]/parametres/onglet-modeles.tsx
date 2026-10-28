"use client";

import { useState } from "react";
import { BOUTON_PRINCIPAL, useOperation } from "@/components/bo/outils";
import { formatDate } from "@/lib/dates";
import { analyserSms, remplirModele, variablesInconnues } from "@/lib/modeles";
import { actionModeles } from "./actions";

interface Props {
  slug: string;
  modeles: { modeleSms: string; modeleEmailObjet: string; modeleEmail: string; emailReponse: string };
  nomSociete: string;
  delai: number;
  societe: string; // code (CM, SON, FLS) pour le numéro d'exemple
}

const MAX_SMS = 160;

export function OngletModeles({ slug, modeles, delai, societe, nomSociete }: Props) {
  const [m, setM] = useState(modeles);
  const [enCours, lancer] = useOperation();
  const exemple = { numero: `${societe}-2026-0042`, nom: "Aminata Diop", date: formatDate(new Date()), delai };
  const sms = remplirModele(m.modeleSms, exemple);
  const analyse = analyserSms(sms);
  const inconnues = [...new Set([...variablesInconnues(m.modeleSms), ...variablesInconnues(m.modeleEmailObjet), ...variablesInconnues(m.modeleEmail)])];
  const trop = m.modeleSms.length > MAX_SMS;

  return (
    <>
      <h2 className="m-0 text-[1.0625rem]">Modèles de messages</h2>
      <p className="m-0 text-sm text-encre-3">
        Variables disponibles : {"{numero}"}, {"{nom}"}, {"{date}"}, {"{delai}"}. Envoyés au client à l&apos;enregistrement de sa réclamation (portail ou accueil).
      </p>
      {inconnues.length > 0 && (
        <p role="alert" className="m-0 rounded-champ border border-retard-bord bg-retard-fond px-3.5 py-2.5 text-sm text-retard">
          Variable inconnue : {inconnues.map((v) => `{${v}}`).join(", ")}. Elle serait envoyée telle quelle au client.
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="tpl-sms" className="font-semibold">
            SMS de confirmation
          </label>
          <textarea
            id="tpl-sms"
            rows={4}
            value={m.modeleSms}
            aria-describedby="sms-compteur sms-encodage"
            aria-invalid={trop || undefined}
            onChange={(e) => setM({ ...m, modeleSms: e.target.value })}
            className={`resize-y rounded-champ border px-3.5 py-3 leading-normal ${trop ? "border-retard" : "border-bord-fort"}`}
          />
          <span id="sms-compteur" className={`text-[0.8125rem] tabular-nums ${trop ? "font-semibold text-retard" : "text-encre-3"}`}>
            {m.modeleSms.length} / {MAX_SMS} caractères
          </span>
          {/* Le coût réel d'un SMS dépend de l'alphabet : un seul « é » ou « ç » le fait passer à 70 caractères. */}
          <p
            id="sms-encodage"
            className={`m-0 rounded-champ px-3.5 py-2.5 text-[0.8125rem] ${analyse.encodage === "Unicode" ? "border border-encours-bord bg-encours-fond text-encours" : "bg-surface-2 text-encre-3"}`}
          >
            {analyse.encodage === "GSM-7" ? (
              <>
                Alphabet SMS standard : 160 caractères par SMS. Avec l&apos;exemple ci-dessous : <strong>{analyse.caracteres} caractères</strong>, soit{" "}
                <strong>
                  {analyse.nombreSms} SMS
                </strong>{" "}
                par envoi.
              </>
            ) : (
              <>
                Caractères hors alphabet SMS standard ({analyse.horsAlphabet.map((c) => `« ${c} »`).join(", ")}) : le message part en Unicode, limité à 70 caractères par SMS.
                Avec l&apos;exemple : <strong>{analyse.caracteres} caractères</strong>, soit{" "}
                <strong>
                  {analyse.nombreSms} SMS
                </strong>{" "}
                facturés par envoi. Remplacez-les (par exemple ç → c, ê → e) pour réduire le nombre de SMS.
              </>
            )}
          </p>
          <div className="max-w-80 rounded-[0.75rem_0.75rem_0.75rem_0.25rem] bg-surface-3 px-3.5 py-3 text-sm">
            <span className="mb-1 block text-[0.6875rem] font-semibold text-encre-3">Aperçu</span>
            {sms}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="tpl-objet" className="font-semibold">
            Objet de l&apos;e-mail
          </label>
          <input id="tpl-objet" value={m.modeleEmailObjet} maxLength={150} onChange={(e) => setM({ ...m, modeleEmailObjet: e.target.value })} className="min-h-11 rounded-champ border border-bord-fort px-3.5" />
          <label htmlFor="tpl-mail" className="mt-2 font-semibold">
            E-mail de confirmation
          </label>
          <textarea id="tpl-mail" rows={8} value={m.modeleEmail} onChange={(e) => setM({ ...m, modeleEmail: e.target.value })} className="resize-y rounded-champ border border-bord-fort px-3.5 py-3 leading-normal" />
          <div className="rounded-champ border border-bord px-3.5 py-3 text-sm whitespace-pre-wrap text-encre-2">
            <span className="mb-1 block text-[0.6875rem] font-semibold whitespace-normal text-encre-3">Aperçu</span>
            <strong className="mb-2 block font-semibold text-encre">{remplirModele(m.modeleEmailObjet, exemple)}</strong>
            {remplirModele(m.modeleEmail, exemple)}
          </div>
        </div>
      </div>
      <div className="flex max-w-xl flex-col gap-2">
        <label htmlFor="tpl-reponse" className="font-semibold">
          Adresse qui reçoit les réponses des clients
        </label>
        <input
          id="tpl-reponse"
          type="email"
          value={m.emailReponse}
          maxLength={254}
          autoComplete="off"
          placeholder="prenom.nom@exemple.sn"
          aria-describedby="tpl-reponse-aide"
          onChange={(e) => setM({ ...m, emailReponse: e.target.value })}
          className="min-h-11 rounded-champ border border-bord-fort px-3.5"
        />
        <p id="tpl-reponse-aide" className="m-0 text-[0.8125rem] text-encre-3">
          Quand un client de {nomSociete} clique sur « Répondre » dans un e-mail de la plateforme, sa réponse arrive à cette adresse. Laissez vide pour qu&apos;elle
          arrive dans la boîte d&apos;envoi de la filiale.
        </p>
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={enCours || trop || inconnues.length > 0} onClick={() => lancer(() => actionModeles(slug, m))} className={BOUTON_PRINCIPAL}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </>
  );
}
