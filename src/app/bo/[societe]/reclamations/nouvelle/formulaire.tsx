"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FournisseurToast, Pastille, useToast } from "@/components/bo/outils";
import { IconeTrace } from "@/components/icone";
import type { ModeTransmission, SousTypeProduit, TypeReclamation } from "@/generated/prisma/client";
import { LIBELLE_MODE, MODES_TRANSMISSION } from "@/lib/libelles";
import { chiffresNationaux, formaterSaisie } from "@/lib/telephone";
import { enregistrerReclamation } from "./actions";

interface ActiviteChoix {
  id: string;
  nom: string;
  icone: string;
  responsable: { id: string; nom: string } | null;
  responsables: { id: string; libelle: string }[];
}

interface Props {
  slug: string;
  activites: ActiviteChoix[];
  origines: string[];
  jour: string;
  heure: string;
}

const TYPES: { valeur: TypeReclamation; libelle: string }[] = [
  { valeur: "PRODUIT", libelle: "Produit" },
  { valeur: "SERVICE", libelle: "Service" },
  { valeur: "AUTRE", libelle: "Autre" },
];
const SOUS_TYPES: { valeur: SousTypeProduit; libelle: string }[] = [
  { valeur: "QUALITE", libelle: "Qualité" },
  { valeur: "PRIX", libelle: "Prix" },
  { valeur: "FONCTIONNALITE", libelle: "Fonctionnalité" },
];
const MAX_FICHIERS = 3;
const TAILLE_MAX = 10 * 1024 * 1024;

const CHAMP = "min-h-11.5 rounded-champ border bg-surface px-3.5 font-normal text-encre";
const bord = (erreur?: string) => (erreur ? "border-retard" : "border-bord-fort");
const choix = (actif: boolean) => (actif ? "border-2 border-marque bg-marque-pale text-marque" : "border border-bord-fort bg-surface text-encre-2 hover:bg-surface-2");

export function FormulaireNouvelle(props: Props) {
  return (
    <FournisseurToast>
      <Formulaire {...props} />
    </FournisseurToast>
  );
}

function Formulaire({ slug, activites, origines, jour, heure }: Props) {
  const routeur = useRouter();
  const annoncer = useToast();
  const [enCours, demarrer] = useTransition();
  const [f, setF] = useState({
    mode: "TELEPHONE" as ModeTransmission,
    origine: origines[0] ?? "Client particulier",
    date: jour,
    heure,
    responsableId: "",
    nom: "",
    telephone: "",
    email: "",
    activiteId: "",
    type: "" as TypeReclamation | "",
    sousType: "" as SousTypeProduit | "",
    description: "",
  });
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const formulaire = useRef<HTMLDivElement>(null);
  const activite = activites.find((a) => a.id === f.activiteId);

  const maj = <K extends keyof typeof f>(cle: K, valeur: (typeof f)[K], champErreur: string = cle) => {
    setF((v) => ({ ...v, [cle]: valeur }));
    setErreurs((e) => ({ ...e, [champErreur]: "" }));
  };

  const choisirActivite = (a: ActiviteChoix) => {
    // Comme la maquette : on propose le responsable de l'activité, sans écraser un choix fait à la main.
    const responsablesActivite = activites.map((x) => x.responsable?.id);
    setF((v) => ({
      ...v,
      activiteId: a.id,
      responsableId: !v.responsableId || responsablesActivite.includes(v.responsableId) ? (a.responsable?.id ?? "") : a.responsables.some((p) => p.id === v.responsableId) ? v.responsableId : "",
    }));
    setErreurs((e) => ({ ...e, activiteId: "" }));
  };

  const ajouterFichiers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const choisis = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = "";
    const trop = choisis.find((x) => x.size > TAILLE_MAX);
    if (trop) return annoncer(`« ${trop.name} » dépasse 10 Mo.`, "erreur");
    if (fichiers.length + choisis.length > MAX_FICHIERS) annoncer("3 fichiers au maximum.", "erreur");
    setFichiers((liste) => [...liste, ...choisis].slice(0, MAX_FICHIERS));
  };

  /** Mêmes contrôles que la maquette (et que le serveur, qui revérifie tout). */
  const verifier = () => {
    const e: Record<string, string> = {};
    if (!f.activiteId) e.activiteId = "Choisissez l'activité concernée.";
    if (!f.type) e.type = "Choisissez le type.";
    else if (f.type === "PRODUIT" && !f.sousType) e.type = "Précisez qualité, prix ou fonctionnalité.";
    if (f.nom.trim().length < 2) e.nom = "Indiquez le nom du client ou de la société.";
    if (chiffresNationaux(f.telephone).length !== 9) e.telephone = "Le numéro doit comporter 9 chiffres.";
    if (f.description.trim().length < 15) e.description = "Décrivez le problème en au moins 15 caractères.";
    if (!f.date || !f.heure) e.date = "Indiquez la date et l’heure réelles de réception.";
    return e;
  };

  const afficherErreurs = (e: Record<string, string>, message?: string) => {
    setErreurs(e);
    const n = Object.keys(e).length;
    annoncer(message ?? `Le formulaire contient ${n} erreur${n > 1 ? "s" : ""} à corriger`, "erreur");
    // Le focus va au premier champ en erreur (clavier, lecteurs d'écran).
    requestAnimationFrame(() => formulaire.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
  };

  const enregistrer = () => {
    const e = verifier();
    if (Object.keys(e).length) return afficherErreurs(e);
    const donnees = new FormData();
    donnees.set(
      "saisie",
      JSON.stringify({
        mode: f.mode,
        origine: f.origine,
        dateReception: f.date,
        heureReception: f.heure,
        responsableId: f.responsableId || null,
        nom: f.nom,
        telephone: f.telephone,
        email: f.email,
        activiteId: f.activiteId,
        type: f.type,
        sousType: f.type === "PRODUIT" ? f.sousType || null : null,
        description: f.description,
      }),
    );
    for (const fichier of fichiers) donnees.append("fichiers", fichier);
    demarrer(async () => {
      try {
        const r = await enregistrerReclamation(slug, donnees);
        // En cas de réussite, le serveur ouvre directement la fiche (redirection).
        if (r && !r.ok) {
          const champs = r.champs ?? {};
          if (champs.dateReception || champs.heureReception) champs.date = champs.dateReception ?? champs.heureReception ?? "";
          if (Object.keys(champs).length) afficherErreurs(champs, r.erreur);
          else annoncer(r.erreur, "erreur");
        }
      } catch (err) {
        // La redirection de Next.js passe par une exception : on la laisse faire son travail.
        if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) throw err;
        annoncer("Connexion au serveur impossible. Vérifiez le réseau et réessayez.", "erreur");
      }
    });
  };

  const erreur = (cle: string) =>
    erreurs[cle] ? (
      <p id={`err-${cle}`} className="m-0 text-sm text-retard">
        {erreurs[cle]}
      </p>
    ) : null;
  const decrit = (cle: string) => (erreurs[cle] ? { "aria-invalid": true as const, "aria-describedby": `err-${cle}` } : {});

  return (
    <>
      <div ref={formulaire} className="flex flex-col gap-6 rounded-carte border border-bord bg-surface p-[clamp(1.25rem,2.5vw,1.75rem)] shadow-carte">
        <h2 className="m-0 text-[1.0625rem]">Réception</h2>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[0.9375rem] font-semibold">Mode de transmission</legend>
          <div className="flex flex-wrap gap-2">
            {MODES_TRANSMISSION.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={f.mode === m}
                onClick={() => maj("mode", m)}
                className={`min-h-11 cursor-pointer rounded-full border px-4 font-medium ${f.mode === m ? "border-marque bg-marque text-white" : "border-bord-fort bg-surface text-encre-2 hover:bg-surface-2"}`}
              >
                {LIBELLE_MODE[m]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-5">
          <label className="flex flex-col gap-1.5 text-[0.9375rem] font-semibold">
            Origine
            <select value={f.origine} onChange={(e) => maj("origine", e.target.value)} className={`${CHAMP} border-bord-fort`}>
              {origines.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[0.9375rem] font-semibold">
            Date réelle de réception
            <input type="date" value={f.date} max={jour} onChange={(e) => maj("date", e.target.value)} {...decrit("date")} className={`${CHAMP} tabular-nums ${bord(erreurs.date)}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.9375rem] font-semibold">
            Heure de réception
            <input type="time" value={f.heure} onChange={(e) => maj("heure", e.target.value, "date")} {...decrit("date")} className={`${CHAMP} tabular-nums ${bord(erreurs.date)}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-[0.9375rem] font-semibold">
            Responsable de traitement
            <select value={f.responsableId} onChange={(e) => maj("responsableId", e.target.value)} disabled={!activite} className={`${CHAMP} border-bord-fort disabled:bg-surface-2`}>
              {activite ? (
                <>
                  <option value="">À désigner par le Service QHSE</option>
                  {activite.responsables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.libelle}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Choisissez d&apos;abord l&apos;activité</option>
              )}
            </select>
          </label>
        </div>
        {erreurs.date && (
          <p id="err-date" className="-mt-3 mb-0 text-sm text-retard">
            {erreurs.date}
          </p>
        )}

        <div className="h-px bg-surface-3" />
        <h2 className="m-0 text-[1.0625rem]">Client</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-nom" className="text-[0.9375rem] font-semibold">
              Nom ou société
            </label>
            <input id="n-nom" value={f.nom} maxLength={120} autoComplete="off" onChange={(e) => maj("nom", e.target.value)} {...decrit("nom")} className={`${CHAMP} ${bord(erreurs.nom)}`} />
            {erreur("nom")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-tel" className="text-[0.9375rem] font-semibold">
              Téléphone
            </label>
            <div className={`flex min-h-11.5 overflow-hidden rounded-champ border focus-within:outline-2 focus-within:outline-marque ${bord(erreurs.telephone)}`}>
              <span className="flex items-center border-r border-bord bg-surface-2 px-3 text-encre-3 tabular-nums">+221</span>
              <input
                id="n-tel"
                value={f.telephone}
                inputMode="tel"
                autoComplete="off"
                placeholder="77 000 00 00"
                onChange={(e) => maj("telephone", formaterSaisie(e.target.value))}
                {...decrit("telephone")}
                className="min-w-0 flex-1 border-0 px-3.5 tabular-nums focus-visible:outline-none"
              />
            </div>
            {erreur("telephone")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="n-mail" className="text-[0.9375rem] font-semibold">
              E-mail <span className="font-normal text-encre-3">(facultatif)</span>
            </label>
            <input id="n-mail" type="email" value={f.email} maxLength={254} autoComplete="off" onChange={(e) => maj("email", e.target.value)} {...decrit("email")} className={`${CHAMP} ${bord(erreurs.email)}`} />
            {erreur("email")}
          </div>
        </div>

        <div className="h-px bg-surface-3" />
        <h2 className="m-0 text-[1.0625rem]">Réclamation</h2>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={erreurs.activiteId ? "err-activiteId" : undefined}>
          <legend className="mb-2 p-0 text-[0.9375rem] font-semibold">Activité concernée</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] gap-3">
            {activites.map((a, i) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={f.activiteId === a.id}
                aria-invalid={i === 0 && erreurs.activiteId ? true : undefined}
                onClick={() => choisirActivite(a)}
                className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-carte px-3.5 py-2 text-left ${choix(f.activiteId === a.id)} ${erreurs.activiteId ? "border-retard" : ""}`}
              >
                <span className="grid size-9 flex-none place-items-center rounded-lg bg-marque-pale text-marque">
                  <IconeTrace d={a.icone} taille={20} />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[0.9375rem] font-semibold text-encre">{a.nom}</span>
                  {a.responsable && <span className="text-xs text-encre-3">{a.responsable.nom}</span>}
                </span>
              </button>
            ))}
          </div>
          {erreur("activiteId")}
        </fieldset>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-describedby={erreurs.type ? "err-type" : undefined}>
          <legend className="mb-2 p-0 text-[0.9375rem] font-semibold">Type de réclamation</legend>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t, i) => (
              <button
                key={t.valeur}
                type="button"
                aria-pressed={f.type === t.valeur}
                aria-invalid={i === 0 && erreurs.type && !f.type ? true : undefined}
                onClick={() => {
                  setF((v) => ({ ...v, type: t.valeur, sousType: t.valeur === "PRODUIT" ? v.sousType : "" }));
                  setErreurs((e) => ({ ...e, type: "" }));
                }}
                className={`min-h-11.5 min-w-28 cursor-pointer rounded-champ px-4.5 font-semibold ${choix(f.type === t.valeur)}`}
              >
                {t.libelle}
              </button>
            ))}
            {f.type === "PRODUIT" && (
              <>
                <span aria-hidden="true" className="mx-1 w-px bg-bord" />
                {SOUS_TYPES.map((x, i) => (
                  <button
                    key={x.valeur}
                    type="button"
                    aria-pressed={f.sousType === x.valeur}
                    aria-invalid={i === 0 && erreurs.type ? true : undefined}
                    onClick={() => maj("sousType", x.valeur, "type")}
                    className={`min-h-11.5 cursor-pointer rounded-full border px-4 font-medium ${f.sousType === x.valeur ? "border-marque bg-marque text-white" : "border-bord-fort bg-surface text-encre-2 hover:bg-surface-2"}`}
                  >
                    {x.libelle}
                  </button>
                ))}
              </>
            )}
          </div>
          {erreur("type")}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="n-desc" className="text-[0.9375rem] font-semibold">
            Détails
          </label>
          <textarea
            id="n-desc"
            rows={4}
            maxLength={1000}
            value={f.description}
            onChange={(e) => maj("description", e.target.value)}
            {...decrit("description")}
            className={`resize-y rounded-champ border px-3.5 py-3 leading-normal ${bord(erreurs.description)}`}
          />
          <div className="flex justify-between gap-4">
            {erreur("description")}
            <span className="ml-auto text-[0.8125rem] text-encre-3 tabular-nums">{f.description.length} / 1000</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-champ border border-dashed border-encre-5 px-4 font-semibold text-marque focus-within:outline-2 focus-within:outline-marque hover:bg-[#F5F8FC] ${fichiers.length >= MAX_FICHIERS ? "pointer-events-none opacity-55" : ""}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            Joindre des fichiers (3 max.)
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              disabled={fichiers.length >= MAX_FICHIERS}
              onChange={ajouterFichiers}
              className="absolute size-px opacity-0"
            />
          </label>
          {fichiers.map((x, i) => (
            <span key={`${x.name}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-bord pl-3 text-sm">
              {x.name}
              <button
                type="button"
                aria-label={`Retirer ${x.name}`}
                onClick={() => setFichiers((liste) => liste.filter((_, j) => j !== i))}
                className="size-9 cursor-pointer rounded-full border-0 bg-transparent text-encre-3 hover:bg-surface-3"
              >
                ×
              </button>
            </span>
          ))}
          {erreur("fichiers")}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => routeur.push(`/bo/${slug}/reclamations`)} className="min-h-11.5 cursor-pointer rounded-champ border border-bord-fort bg-surface px-5 font-semibold hover:bg-surface-2">
          Annuler
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          className="inline-flex min-h-11.5 cursor-pointer items-center gap-2.5 rounded-champ border-0 bg-marque px-6 font-semibold text-white hover:bg-marque-fonce disabled:cursor-wait"
        >
          {enCours && <Pastille className="size-4 border-white/40 border-t-white" />}
          {enCours ? "Enregistrement…" : "Enregistrer la réclamation"}
        </button>
      </div>
    </>
  );
}
