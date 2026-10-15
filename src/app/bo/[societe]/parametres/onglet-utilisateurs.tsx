"use client";

import { useState } from "react";
import { BOUTON_PRINCIPAL, BOUTON_SECONDAIRE, useOperation, useToast } from "@/components/bo/outils";
import type { Role } from "@/generated/prisma/client";
import { LIBELLE_ROLE } from "@/lib/libelles";
import type { DonneesParametres } from "@/server/parametres";
import { actionActiver, actionCreerUtilisateur, actionMotDePasse, actionRole } from "./actions";

type Utilisateur = DonneesParametres["utilisateurs"][number];
const ROLES: Role[] = ["QHSE", "DIRECTION_COMMERCIALE", "AGENT_ACCUEIL", "RESPONSABLE_TRAITEMENT", "DIRECTION_GENERALE"];

const initiales = (nom: string) =>
  nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((m) => m[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function OngletUtilisateurs({ slug, utilisateurs, moi, societe }: { slug: string; utilisateurs: Utilisateur[]; moi: string; societe: string }) {
  const [secret, setSecret] = useState<{ nom: string; motDePasse: string; email: string } | null>(null);
  const [ajout, setAjout] = useState(false);
  const actifs = utilisateurs.filter((u) => u.actif).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[1.0625rem]">Utilisateurs et rôles</h2>
          <p className="m-0 text-sm text-encre-3">
            Comptes du groupe et responsables de traitement de {societe} · {actifs} actif{actifs > 1 ? "s" : ""}. Les responsables de traitement ne voient que leur société et
            leurs activités ; les autres rôles voient tout le groupe.
          </p>
        </div>
        {!ajout && (
          <button type="button" onClick={() => setAjout(true)} className={BOUTON_SECONDAIRE}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 12h14M12 5v14" />
            </svg>
            Ajouter un utilisateur
          </button>
        )}
      </div>

      {secret && <MotDePasseAffiche secret={secret} fermer={() => setSecret(null)} />}
      {ajout && <NouvelUtilisateur slug={slug} fermer={() => setAjout(false)} cree={(s) => (setSecret(s), setAjout(false))} />}

      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-champ border border-bord p-0">
        {utilisateurs.map((u) => (
          <Ligne key={u.id} u={u} slug={slug} moi={u.id === moi} montrer={(motDePasse) => setSecret({ nom: u.nom, email: u.email, motDePasse })} />
        ))}
      </ul>
    </>
  );
}

function Ligne({ u, slug, moi, montrer }: { u: Utilisateur; slug: string; moi: boolean; montrer: (motDePasse: string) => void }) {
  const [enCours, lancer] = useOperation();
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-surface-3 px-4 py-3 last:border-b-0 ${u.actif ? "" : "bg-surface-2"}`} aria-busy={enCours}>
      <span aria-hidden="true" className={`grid size-9 flex-none place-items-center rounded-full text-[0.8125rem] font-bold ${u.actif ? "bg-marque-pale text-marque" : "bg-surface-3 text-encre-4"}`}>
        {initiales(u.nom)}
      </span>
      <span className="flex min-w-0 flex-[1_1_14rem] flex-col leading-snug">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {u.nom}
          {moi && <span className="rounded-full bg-marque-pale px-2 text-xs font-semibold text-marque">Vous</span>}
          {!u.actif && <span className="rounded-full border border-bord-fort px-2 text-xs font-semibold text-encre-3">Désactivé</span>}
        </span>
        <span className="truncate text-sm text-encre-3">
          {u.email}
          {u.fonction && ` · ${u.fonction}`}
        </span>
        <span className="text-xs text-encre-4">{u.sansMotDePasse ? "Aucun mot de passe : ne peut pas se connecter" : u.connexion ? `Dernière connexion le ${u.connexion}` : "Jamais connecté"}</span>
      </span>
      <select
        aria-label={`Rôle de ${u.nom}`}
        key={u.role}
        defaultValue={u.role}
        disabled={moi || !u.actif || enCours}
        title={moi ? "Vous ne pouvez pas changer votre propre rôle." : undefined}
        onChange={(e) => {
          const champ = e.currentTarget;
          lancer(() => actionRole(slug, u.id, champ.value), { echec: () => (champ.value = u.role) });
        }}
        className="min-h-11 rounded-champ border border-bord-fort bg-surface px-3 disabled:cursor-not-allowed disabled:bg-surface-2"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {LIBELLE_ROLE[r]}
          </option>
        ))}
      </select>
      <span className="flex flex-wrap gap-1">
        {u.actif && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => lancer(() => actionMotDePasse(slug, u.id), { succes: false, reussite: (r) => r.motDePasse && montrer(r.motDePasse) })}
            className="min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold text-marque hover:bg-marque-pale"
          >
            Nouveau mot de passe<span className="sr-only"> pour {u.nom}</span>
          </button>
        )}
        {!moi && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => lancer(() => actionActiver(slug, u.id, !u.actif))}
            className={`min-h-11 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-sm font-semibold ${u.actif ? "text-retard hover:bg-retard-fond" : "text-traitee hover:bg-traitee-fond"}`}
          >
            {u.actif ? "Désactiver" : "Réactiver"}
            <span className="sr-only"> le compte de {u.nom}</span>
          </button>
        )}
      </span>
    </li>
  );
}

/** Mot de passe provisoire : affiché une seule fois, jamais stocké en clair ni envoyé par l'application. */
function MotDePasseAffiche({ secret, fermer }: { secret: { nom: string; email: string; motDePasse: string }; fermer: () => void }) {
  const annoncer = useToast();
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-carte border border-traitee-bord bg-traitee-fond px-5 py-4">
      <div className="flex flex-col gap-1">
        <p className="m-0 font-semibold text-[#05603A]">Mot de passe provisoire de {secret.nom}</p>
        <p className="m-0 text-sm text-encre-2">
          Identifiant : {secret.email} · Mot de passe : <code className="rounded bg-surface px-2 py-0.5 text-base font-semibold tracking-wide">{secret.motDePasse}</code>
        </p>
        <p className="m-0 text-[0.8125rem] text-encre-3">Communiquez-le en main propre. Il ne sera plus affiché après fermeture de ce message.</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(secret.motDePasse).then(() => annoncer("Mot de passe copié"), () => annoncer("Copie impossible : recopiez-le à la main.", "erreur"))}
          className={BOUTON_SECONDAIRE}
        >
          Copier
        </button>
        <button type="button" onClick={fermer} className={BOUTON_PRINCIPAL}>
          J&apos;ai noté
        </button>
      </div>
    </div>
  );
}

function NouvelUtilisateur({ slug, fermer, cree }: { slug: string; fermer: () => void; cree: (s: { nom: string; email: string; motDePasse: string }) => void }) {
  const [f, setF] = useState({ nom: "", email: "", fonction: "", role: "RESPONSABLE_TRAITEMENT" as Role });
  const [enCours, lancer] = useOperation();
  const champ = "min-h-11 rounded-champ border border-bord-fort px-3 font-normal";
  return (
    <form
      className="flex flex-col gap-4 rounded-carte border border-bord bg-fond p-5"
      onSubmit={(e) => {
        e.preventDefault();
        lancer(() => actionCreerUtilisateur(slug, f), { reussite: (r) => r.motDePasse && cree({ nom: f.nom, email: f.email.trim().toLowerCase(), motDePasse: r.motDePasse }) });
      }}
    >
      <h3 className="m-0 text-base">Nouvel utilisateur</h3>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Nom complet
          <input required minLength={2} maxLength={120} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          E-mail (identifiant)
          <input required type="email" maxLength={254} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Fonction <span className="font-normal text-encre-3">(facultatif)</span>
          <input maxLength={120} value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })} className={champ} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Rôle
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} className={`${champ} bg-surface`}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {LIBELLE_ROLE[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="m-0 text-[0.8125rem] text-encre-3">
        Un mot de passe provisoire sera généré et affiché une seule fois.
        {f.role === "RESPONSABLE_TRAITEMENT" ? " Ajoutez ensuite la personne à une équipe (onglet « Activités et équipes »)." : ""}
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={fermer} className={BOUTON_SECONDAIRE}>
          Annuler
        </button>
        <button type="submit" disabled={enCours} className={BOUTON_PRINCIPAL}>
          {enCours ? "Création…" : "Créer le compte"}
        </button>
      </div>
    </form>
  );
}
