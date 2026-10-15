"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import type { ZodError } from "zod";
import type { Canal, SousTypeProduit, TypeReclamation } from "@/generated/prisma/enums";
import { Icone, IconeTrace } from "@/components/icone";
import { formatDateHeure } from "@/lib/dates";
import { SECTEURS_PORTAIL, texteCanaux, texteType } from "@/lib/libelles";
import { formaterSaisie } from "@/lib/telephone";
import { erreursParChamp } from "@/lib/validation/communs";
import {
  schemaConsentement,
  schemaEtapeVous,
  schemaQuestionActivite,
  schemaQuestionDescription,
  schemaQuestionPremiereFois,
  schemaQuestionType,
} from "@/lib/validation/portail";
import type { ResultatDepot } from "@/server/portail";
import { deposer } from "@/app/[societe]/actions";
import { BoutonPrincipal, BoutonSecondaire, classeChamp, MessageErreur, OptionChoix, Pastille, Roue } from "./ui";

interface Activite {
  code: string;
  nom: string;
  nomCourt: string;
  description: string;
  icone: string;
}

interface Props {
  societe: { slug: string; nom: string };
  activites: Activite[];
  delais: { qualificationH: number; reponseJO: number };
}

type Secteur = (typeof SECTEURS_PORTAIL)[number];

interface Formulaire {
  profil: "PARTICULIER" | "SOCIETE";
  nom: string;
  secteur: Secteur | null;
  secteurAutre: string;
  contactNom: string;
  contactFonction: string;
  telephone: string; // affiché « 77 412 35 08 »
  email: string;
  canaux: Canal[];
  activiteCode: string;
  type: TypeReclamation | null;
  sousType: SousTypeProduit | null;
  description: string;
  premiereFois: boolean | null;
  consentement: boolean;
}

const VIDE: Formulaire = {
  profil: "PARTICULIER",
  nom: "",
  secteur: null,
  secteurAutre: "",
  contactNom: "",
  contactFonction: "",
  telephone: "",
  email: "",
  canaux: ["SMS"],
  activiteCode: "",
  type: null,
  sousType: null,
  description: "",
  premiereFois: null,
  consentement: false,
};

const TYPES: { cle: TypeReclamation; libelle: string; detail: string; trace: string }[] = [
  {
    cle: "PRODUIT",
    libelle: "Un produit",
    detail: "Qualité, prix ou fonctionnement",
    trace: "m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7l8.7 5 8.7-5M12 22V12",
  },
  {
    cle: "SERVICE",
    libelle: "Un service",
    detail: "Livraison, accueil, facturation, intervention…",
    trace: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14M17 16a2 2 0 1 0 0 4a2 2 0 1 0 0-4M7 16a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  },
  { cle: "AUTRE", libelle: "Autre chose", detail: "Tout autre sujet", trace: "M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2M19 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2M5 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2" },
];

const SOUS_TYPES: { cle: SousTypeProduit; libelle: string }[] = [
  { cle: "QUALITE", libelle: "La qualité" },
  { cle: "PRIX", libelle: "Le prix" },
  { cle: "FONCTIONNALITE", libelle: "Le fonctionnement" },
];

const TYPES_FICHIER = ["image/jpeg", "image/png", "application/pdf"];
const TAILLE_MAX = 10 * 1024 * 1024;

export function DepotReclamation({ societe, activites, delais }: Props) {
  const routeur = useRouter();
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [question, setQuestion] = useState(1);
  const [f, setF] = useState<Formulaire>(VIDE);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [resultat, setResultat] = useState<Extract<ResultatDepot, { ok: true }> | null>(null);
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const premierRendu = useRef(true);
  const piege = useRef<HTMLInputElement>(null);

  // Annonce de chaque nouvel écran aux lecteurs d'écran : le focus va sur son titre.
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    titre.current?.focus();
  }, [etape, question, resultat]);

  useEffect(() => () => {
    if (minuterie.current) clearTimeout(minuterie.current);
  }, []);

  const maj = <K extends keyof Formulaire>(cle: K, valeur: Formulaire[K]) => {
    setF((x) => ({ ...x, [cle]: valeur }));
    setErreurs((e) => ({ ...e, [cle === "secteurAutre" ? "secteur" : cle]: "" }));
  };

  const allerA = (nouvelleEtape: 1 | 2 | 3, nouvelleQuestion = 1) => {
    if (minuterie.current) clearTimeout(minuterie.current);
    setEtape(nouvelleEtape);
    setQuestion(nouvelleQuestion);
    setErreurs({});
    window.scrollTo(0, 0);
  };

  /** Choix qui fait passer automatiquement à la question suivante (comme la maquette). */
  const choisirPuisAvancer = (patch: Partial<Formulaire>) => {
    setF((x) => ({ ...x, ...patch }));
    setErreurs({});
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setQuestion((q) => Math.min(q + 1, 5)), 320);
  };

  const valider = (): boolean => {
    let r: { success: boolean; error?: ZodError } = { success: true };
    if (etape === 1) {
      r = schemaEtapeVous.safeParse({
        profil: f.profil,
        nom: f.nom,
        secteur: f.secteur,
        secteurAutre: f.secteurAutre,
        contactNom: f.contactNom,
        contactFonction: f.contactFonction,
        telephone: f.telephone,
        email: f.email,
        canaux: f.canaux,
      });
    } else if (etape === 2) {
      if (question === 1) r = schemaQuestionActivite.safeParse({ activiteCode: f.activiteCode });
      if (question === 2) r = schemaQuestionType.safeParse({ type: f.type ?? undefined, sousType: f.sousType });
      if (question === 3) r = schemaQuestionDescription.safeParse({ description: f.description });
      if (question === 4) r = schemaQuestionPremiereFois.safeParse({ premiereFois: f.premiereFois ?? undefined });
    } else {
      r = schemaConsentement.safeParse({ consentement: f.consentement });
    }
    const e = r.success || !r.error ? {} : erreursParChamp(r.error);
    setErreurs(e);
    return Object.keys(e).length === 0;
  };

  const suivant = async () => {
    if (!valider()) return;
    if (minuterie.current) clearTimeout(minuterie.current);
    if (etape === 1) return allerA(2, 1);
    if (etape === 2 && question < 5) {
      setQuestion(question + 1);
      window.scrollTo(0, 0);
      return;
    }
    if (etape === 2) return allerA(3);
    await envoyer();
  };

  const precedent = () => {
    if (minuterie.current) clearTimeout(minuterie.current);
    setErreurs({});
    if (etape === 1) return routeur.push(`/${societe.slug}`);
    if (etape === 2 && question > 1) return setQuestion(question - 1);
    if (etape === 2) return allerA(1);
    allerA(2, 5);
  };

  const envoyer = async () => {
    setEnvoi(true);
    setErreurGenerale(null);
    const donnees = new FormData();
    donnees.set(
      "donnees",
      JSON.stringify({
        societe: societe.slug,
        profil: f.profil,
        nom: f.nom,
        secteur: f.profil === "SOCIETE" ? f.secteur : null,
        secteurAutre: f.secteurAutre,
        contactNom: f.contactNom,
        contactFonction: f.contactFonction,
        telephone: f.telephone,
        email: f.email,
        canaux: f.canaux,
        activiteCode: f.activiteCode,
        type: f.type,
        sousType: f.type === "PRODUIT" ? f.sousType : null,
        description: f.description,
        premiereFois: f.premiereFois,
        consentement: f.consentement,
      }),
    );
    donnees.set("site", piege.current?.value ?? "");
    for (const fichier of fichiers) donnees.append("fichiers", fichier);
    try {
      const r = await deposer(donnees);
      if (r.ok) {
        setResultat(r);
        window.scrollTo(0, 0);
        return;
      }
      const champs = r.champs ?? {};
      const cles = Object.keys(champs);
      if (cles.some((c) => ["nom", "secteur", "contactNom", "telephone", "email", "canaux"].includes(c))) allerA(1);
      else if (cles.includes("activiteCode")) allerA(2, 1);
      else if (cles.includes("type")) allerA(2, 2);
      else if (cles.includes("description")) allerA(2, 3);
      else if (cles.includes("fichiers")) allerA(2, 5);
      setErreurs(champs);
      setErreurGenerale(r.erreur);
    } catch {
      setErreurGenerale("La connexion a été interrompue. Vérifiez votre réseau et réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  // ───────── Fichiers (question 5) ─────────
  const ajouterFichiers = (liste: FileList | null) => {
    if (!liste) return;
    const nouveaux = [...fichiers];
    let erreur = "";
    for (const fichier of Array.from(liste)) {
      if (nouveaux.length >= 3) {
        erreur = "Vous pouvez joindre 3 fichiers au maximum.";
        break;
      }
      if (!TYPES_FICHIER.includes(fichier.type)) {
        erreur = "Seuls les photos (JPG, PNG) et les PDF sont acceptés.";
        continue;
      }
      if (fichier.size > TAILLE_MAX) {
        erreur = `« ${fichier.name} » dépasse 10 Mo.`;
        continue;
      }
      nouveaux.push(fichier);
    }
    setFichiers(nouveaux);
    setErreurs((e) => ({ ...e, fichiers: erreur }));
  };
  const deposerFichiers = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    ajouterFichiers(e.dataTransfer.files);
  };

  if (resultat) return <Confirmation resultat={resultat} formulaire={f} societe={societe} delais={delais} titre={titre} />;

  const activite = activites.find((a) => a.code === f.activiteCode);
  const societeClient = f.profil === "SOCIETE";
  const telComplet = f.telephone ? `+221 ${f.telephone}` : "";
  const libelleSuivant = etape === 3 ? (envoi ? "Envoi en cours…" : "Envoyer ma réclamation") : etape === 2 && question === 5 && fichiers.length === 0 ? "Passer cette question" : "Continuer";
  const titreH1 = "m-0 text-[clamp(1.5rem,1.25rem+1.4vw,1.875rem)] leading-tight tracking-[-0.02em] text-balance outline-none";

  return (
    <section aria-labelledby="titre-etape" className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="m-0 text-sm font-semibold whitespace-nowrap text-marque">Étape {etape} sur 3</p>
          <p className="m-0 text-sm text-encre-3">{["Vous", "Votre réclamation", "Vérification"][etape - 1]}</p>
        </div>
        <div role="progressbar" aria-label="Avancement du dépôt" aria-valuemin={1} aria-valuemax={3} aria-valuenow={etape} className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 rounded-full ${i <= etape ? "bg-marque" : "bg-bord"}`} />
          ))}
        </div>
      </div>

      {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
      <input ref={piege} type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px opacity-0" />

      {erreurGenerale && (
        <div role="alert" className="flex items-start gap-2 rounded-carte border border-retard-bord bg-retard-fond px-4 py-3 text-[0.9375rem] text-retard">
          <Icone nom="alerte" taille={18} epaisseur={2} className="mt-0.5 flex-none" />
          {erreurGenerale}
        </div>
      )}

      {etape === 1 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 id="titre-etape" ref={titre} tabIndex={-1} className={titreH1}>
              Vous
            </h1>
            <p className="m-0 text-encre-3">Pour vous recontacter et vous envoyer votre numéro de suivi.</p>
          </div>

          <fieldset className="m-0 flex flex-col border-0 p-0">
            <legend className="mb-2.5 p-0 text-[0.9375rem] font-semibold">Vous êtes</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ["PARTICULIER", "Un particulier", "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8"],
                  ["SOCIETE", "Une société", "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"],
                ] as const
              ).map(([cle, libelle, trace]) => {
                const actif = f.profil === cle;
                return (
                  <button
                    key={cle}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => {
                      setF((x) => ({ ...x, profil: cle }));
                      setErreurs({});
                    }}
                    className={`flex min-h-21 cursor-pointer flex-col items-start gap-2 rounded-carte px-4 py-3.5 text-left ${
                      actif ? "border-2 border-marque bg-marque-pale text-marque" : "border border-bord-fort bg-surface text-encre-3"
                    }`}
                  >
                    <IconeTrace d={trace} taille={22} />
                    <span className="text-[0.9375rem] font-semibold text-encre">{libelle}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {!societeClient && (
            <Champ id="f-nom" libelle="Nom et prénom" erreur={erreurs.nom}>
              <input id="f-nom" value={f.nom} onChange={(e) => maj("nom", e.target.value)} autoComplete="name" placeholder="Ex. Aminata Diop" maxLength={120} className={classeChamp(erreurs.nom)} {...aria("f-nom", erreurs.nom)} />
            </Champ>
          )}

          {societeClient && (
            <div className="flex flex-col gap-5 rounded-carte border border-bord bg-surface p-4.5">
              <Champ id="f-soc" libelle="Nom de la société" erreur={erreurs.nom}>
                <input id="f-soc" value={f.nom} onChange={(e) => maj("nom", e.target.value)} autoComplete="organization" placeholder="Ex. Pharmacie Baobab" maxLength={120} className={classeChamp(erreurs.nom)} {...aria("f-soc", erreurs.nom)} />
              </Champ>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-[0.9375rem] font-semibold">Secteur d&apos;activité</legend>
                <div className="flex flex-wrap gap-2">
                  {SECTEURS_PORTAIL.map((s) => (
                    <Pastille key={s} actif={f.secteur === s} onClick={() => maj("secteur", s)}>
                      {s}
                    </Pastille>
                  ))}
                </div>
                {f.secteur === "Autre" && (
                  <input
                    aria-label="Précisez votre secteur d'activité"
                    value={f.secteurAutre}
                    onChange={(e) => maj("secteurAutre", e.target.value)}
                    placeholder="Précisez votre secteur, ex. Transport, Éducation…"
                    maxLength={80}
                    className={classeChamp(erreurs.secteur)}
                  />
                )}
                {erreurs.secteur && <MessageErreur>{erreurs.secteur}</MessageErreur>}
              </fieldset>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-5">
                <Champ id="f-contact" libelle="Nom du contact" erreur={erreurs.contactNom}>
                  <input id="f-contact" value={f.contactNom} onChange={(e) => maj("contactNom", e.target.value)} autoComplete="name" placeholder="Ex. Awa Ndiaye" maxLength={120} className={classeChamp(erreurs.contactNom)} {...aria("f-contact", erreurs.contactNom)} />
                </Champ>
                <Champ id="f-fonction" libelle="Fonction" facultatif>
                  <input id="f-fonction" value={f.contactFonction} onChange={(e) => maj("contactFonction", e.target.value)} autoComplete="organization-title" placeholder="Ex. Pharmacienne titulaire" maxLength={120} className={classeChamp()} />
                </Champ>
              </div>
            </div>
          )}

          <Champ id="f-tel" libelle="Téléphone" erreur={erreurs.telephone} aide="Vous recevrez votre numéro de suivi par SMS.">
            <div className={`flex min-h-12 overflow-hidden rounded-champ border bg-surface ${erreurs.telephone ? "border-retard" : "border-bord-fort"}`}>
              <span className="flex items-center border-r border-bord bg-surface-2 px-3 text-encre-3 tabular-nums" aria-hidden="true">
                +221
              </span>
              <input
                id="f-tel"
                value={f.telephone}
                onChange={(e) => maj("telephone", formaterSaisie(e.target.value))}
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="77 000 00 00"
                className="min-w-0 flex-1 border-0 px-3.5 text-base tabular-nums outline-offset-[-2px]"
                {...aria("f-tel", erreurs.telephone)}
              />
            </div>
          </Champ>

          <Champ id="f-mail" libelle="E-mail" indication={f.canaux.includes("EMAIL") ? "(pour recevoir la réponse)" : "(facultatif)"} erreur={erreurs.email}>
            <input id="f-mail" type="email" value={f.email} onChange={(e) => maj("email", e.target.value.trim())} autoComplete="email" placeholder="vous@exemple.sn" maxLength={254} className={classeChamp(erreurs.email)} {...aria("f-mail", erreurs.email)} />
          </Champ>

          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-2.5 p-0 text-[0.9375rem] font-semibold">Recevoir la réponse par</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ["SMS", "SMS", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
                  ["EMAIL", "E-mail", "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm18 3-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
                ] as const
              ).map(([cle, libelle, trace]) => {
                const coche = f.canaux.includes(cle);
                return (
                  <button
                    key={cle}
                    type="button"
                    role="checkbox"
                    aria-checked={coche}
                    onClick={() => {
                      setF((x) => ({ ...x, canaux: coche ? x.canaux.filter((c) => c !== cle) : [...x.canaux, cle] }));
                      setErreurs((e) => ({ ...e, canaux: "", email: "" }));
                    }}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-carte px-3.5 py-2.5 text-left ${coche ? "border-2 border-marque bg-marque-pale" : "border border-bord-fort bg-surface"}`}
                  >
                    <span aria-hidden="true" className={`grid size-5.5 flex-none place-items-center rounded-md border-2 text-white ${coche ? "border-marque bg-marque" : "border-encre-5 bg-surface"}`}>
                      {coche && (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    <IconeTrace d={trace} taille={20} className="flex-none text-encre-3" />
                    <span className="text-[0.9375rem] font-semibold text-encre">{libelle}</span>
                  </button>
                );
              })}
            </div>
            {erreurs.canaux && <MessageErreur>{erreurs.canaux}</MessageErreur>}
            <p className="m-0 text-[0.8125rem] text-encre-4">Vous pouvez choisir les deux. Le numéro de suivi est toujours envoyé par SMS.</p>
          </fieldset>
        </div>
      )}

      {etape === 2 && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[0.8125rem] font-semibold text-encre-3 tabular-nums">Question {question} sur 5</span>
            <span className="flex gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`h-2 rounded-full transition-[width] duration-200 ${i === question ? "w-6" : "w-2"} ${i <= question ? "bg-marque" : "bg-bord-fort"}`} />
              ))}
            </span>
          </div>

          {question === 1 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                {/* Bug de la maquette corrigé : le libellé suit la société choisie. */}
                <h1 id="titre-etape" ref={titre} tabIndex={-1} className={titreH1}>
                  Quel service de {societe.nom} est concerné ?
                </h1>
                <p className="m-0 text-encre-3">Choisissez l&apos;activité avec laquelle vous avez eu le problème.</p>
              </div>
              <div className="flex flex-col gap-2.5">
                {activites.map((a) => (
                  <OptionChoix key={a.code} actif={f.activiteCode === a.code} onClick={() => choisirPuisAvancer({ activiteCode: a.code })} titre={a.nomCourt} detail={a.description} icone={<IconeTrace d={a.icone} />} />
                ))}
              </div>
              {erreurs.activiteCode && <MessageErreur>{erreurs.activiteCode}</MessageErreur>}
            </div>
          )}

          {question === 2 && (
            <div className="flex flex-col gap-5">
              <h1 id="titre-etape" ref={titre} tabIndex={-1} className={titreH1}>
                Votre réclamation concerne…
              </h1>
              <div className="flex flex-col gap-2.5">
                {TYPES.map((t) => (
                  <OptionChoix
                    key={t.cle}
                    actif={f.type === t.cle}
                    onClick={() => (t.cle === "PRODUIT" ? (setF((x) => ({ ...x, type: "PRODUIT" })), setErreurs({})) : choisirPuisAvancer({ type: t.cle, sousType: null }))}
                    titre={t.libelle}
                    detail={t.detail}
                    icone={<IconeTrace d={t.trace} />}
                  />
                ))}
              </div>
              {f.type === "PRODUIT" && (
                <div className="flex flex-col gap-2.5 rounded-carte border border-bord bg-surface p-4">
                  <p className="m-0 text-[0.9375rem] font-semibold">Qu&apos;est-ce qui ne va pas avec le produit ?</p>
                  <div className="flex flex-wrap gap-2">
                    {SOUS_TYPES.map((s) => (
                      <Pastille key={s.cle} actif={f.sousType === s.cle} onClick={() => choisirPuisAvancer({ type: "PRODUIT", sousType: s.cle })}>
                        {s.libelle}
                      </Pastille>
                    ))}
                  </div>
                </div>
              )}
              {erreurs.type && <MessageErreur>{erreurs.type}</MessageErreur>}
            </div>
          )}

          {question === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h1 id="titre-etape" ref={titre} tabIndex={-1} className={titreH1}>
                  Que s&apos;est-il passé ?
                </h1>
                <p className="m-0 text-encre-3">Le produit ou le service concerné, la date, et ce que vous attendez de nous.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="f-desc" className="sr-only">
                  Description du problème
                </label>
                <textarea
                  id="f-desc"
                  value={f.description}
                  onChange={(e) => maj("description", e.target.value.slice(0, 1000))}
                  maxLength={1000}
                  rows={6}
                  placeholder="Ex. Le produit livré le 27/09 ne fonctionne pas. Je souhaite un échange."
                  className={`resize-y rounded-champ border bg-surface px-3.5 py-3 text-base leading-normal ${erreurs.description ? "border-retard" : "border-bord-fort"}`}
                  {...aria("f-desc", erreurs.description)}
                />
                <div className="flex justify-between gap-4">
                  {erreurs.description && <MessageErreur id="f-desc-erreur">{erreurs.description}</MessageErreur>}
                  <span className="ml-auto text-[0.8125rem] text-encre-4 tabular-nums">{f.description.length} / 1000</span>
                </div>
              </div>
            </div>
          )}

          {question === 4 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h1 id="titre-etape" ref={titre} tabIndex={-1} className={titreH1}>
                  Est-ce la première fois que ce problème vous arrive ?
                </h1>
                <p className="m-0 text-encre-3">Cela nous aide à repérer les problèmes qui se répètent.</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <OptionChoix actif={f.premiereFois === true} onClick={() => choisirPuisAvancer({ premiereFois: true })} titre="Oui, c'est la première fois" />
                <OptionChoix actif={f.premiereFois === false} onClick={() => choisirPuisAvancer({ premiereFois: false })} titre="Non, c'est déjà arrivé" />
              </div>
              {erreurs.premiereFois && <MessageErreur>{erreurs.premiereFois}</MessageErreur>}
            </div>
          )}

          {question === 5 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <h1 id="titre-etape" ref={titre} tabIndex={-1} className={titreH1}>
                  Avez-vous une photo ou un document ?
                </h1>
                <p className="m-0 text-encre-3">Facultatif, 3 fichiers maximum. Une photo, un bon de livraison ou une facture nous aide à répondre plus vite.</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSurvol(true);
                  }}
                  onDragLeave={() => setSurvol(false)}
                  onDrop={deposerFichiers}
                  className={`flex flex-col items-center gap-3 rounded-carte border-[1.5px] border-dashed px-4 py-5 text-center ${survol ? "border-marque bg-marque-pale" : "border-bord-fort bg-surface"}`}
                >
                  <p className="m-0 text-sm text-encre-3">Glissez vos fichiers ici, ou</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-champ border border-bord-fort bg-surface px-4 text-[0.9375rem] font-semibold focus-within:outline-2 focus-within:outline-marque">
                      <IconeTrace d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM12 10a3 3 0 1 0 0 6a3 3 0 1 0 0-6" taille={18} />
                      Prendre une photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="environment"
                        onChange={(e) => {
                          ajouterFichiers(e.target.files);
                          e.target.value = "";
                        }}
                        className="absolute h-px w-px opacity-0"
                      />
                    </label>
                    <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-champ border border-bord-fort bg-surface px-4 text-[0.9375rem] font-semibold focus-within:outline-2 focus-within:outline-marque">
                      <IconeTrace d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" taille={18} />
                      Choisir un fichier
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => {
                          ajouterFichiers(e.target.files);
                          e.target.value = "";
                        }}
                        className="absolute h-px w-px opacity-0"
                      />
                    </label>
                  </div>
                  <p className="m-0 text-[0.8125rem] text-encre-4">JPG, PNG ou PDF · 10 Mo maximum par fichier</p>
                </div>
                {erreurs.fichiers && <MessageErreur>{erreurs.fichiers}</MessageErreur>}
                {fichiers.length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Fichiers joints">
                    {fichiers.map((fichier, i) => (
                      <li key={`${fichier.name}-${i}`} className="flex items-center gap-3 rounded-champ border border-bord bg-surface py-2 pr-2 pl-3.5">
                        <IconeTrace d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4" taille={18} className="flex-none text-encre-3" />
                        <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{fichier.name}</span>
                        <button
                          type="button"
                          onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))}
                          aria-label={`Retirer ${fichier.name}`}
                          className="grid size-11 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-encre-3 hover:bg-surface-3"
                        >
                          <IconeTrace d="M18 6 6 18M6 6l12 12" taille={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {etape === 3 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 id="titre-etape" ref={titre} tabIndex={-1} className="m-0 text-[clamp(1.625rem,1.3rem+1.6vw,2rem)] leading-tight tracking-[-0.02em] outline-none">
              Vérification
            </h1>
            <p className="m-0 text-encre-3">Relisez avant d&apos;envoyer. Vous pouvez encore tout modifier.</p>
          </div>
          <Recap titre="Vous" modifier={() => allerA(1)}>
            <Ligne libelle={societeClient ? "Société" : "Nom"}>{f.nom}</Ligne>
            {societeClient && (
              <>
                <Ligne libelle="Secteur">{f.secteur === "Autre" ? f.secteurAutre || "Autre" : f.secteur}</Ligne>
                <Ligne libelle="Contact">{f.contactNom + (f.contactFonction ? ` (${f.contactFonction})` : "")}</Ligne>
              </>
            )}
            <Ligne libelle="Téléphone" chiffres>
              {telComplet}
            </Ligne>
            <Ligne libelle="E-mail">{f.email || "Non renseigné"}</Ligne>
            <Ligne libelle="Réponse par">{texteCanaux(f.canaux, true)}</Ligne>
          </Recap>
          <Recap titre="Votre réclamation" modifier={() => allerA(2, 1)}>
            <Ligne libelle="Activité">{activite?.nom}</Ligne>
            <Ligne libelle="Type">
              {f.type ? texteType(f.type, f.type === "PRODUIT" ? f.sousType : null) : ""}
            </Ligne>
            <Ligne libelle="Première fois">{f.premiereFois ? "Oui, première fois" : "Non, déjà arrivé"}</Ligne>
            <Ligne libelle="Description" normal>
              {f.description}
            </Ligne>
            <Ligne libelle="Fichiers">{fichiers.length ? fichiers.map((x) => x.name).join(", ") : "Aucun"}</Ligne>
          </Recap>
          <label className={`flex cursor-pointer items-start gap-3 rounded-carte border bg-surface p-4 ${erreurs.consentement ? "border-retard" : "border-bord"}`}>
            <input
              type="checkbox"
              checked={f.consentement}
              onChange={(e) => maj("consentement", e.target.checked)}
              className="mt-0.5 size-5.5 flex-none accent-marque"
              aria-invalid={!!erreurs.consentement}
            />
            <span className="text-[0.9375rem] text-pretty text-encre-2">
              J&apos;accepte que le Groupe COSEMAD utilise mes coordonnées uniquement pour traiter cette réclamation et me répondre.
            </span>
          </label>
          {erreurs.consentement && (
            <div className="-mt-2">
              <MessageErreur>{erreurs.consentement}</MessageErreur>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2">
        <BoutonSecondaire type="button" onClick={precedent}>
          {etape === 1 ? "Annuler" : "Retour"}
        </BoutonSecondaire>
        <BoutonPrincipal type="button" onClick={suivant} disabled={envoi}>
          {envoi && <Roue />}
          {libelleSuivant}
        </BoutonPrincipal>
      </div>
    </section>
  );
}

/** Relie un champ à son message d'erreur pour les lecteurs d'écran. */
function aria(id: string, erreur?: string) {
  return { "aria-invalid": !!erreur, "aria-describedby": erreur ? `${id}-erreur` : undefined } as const;
}

function Champ({
  id,
  libelle,
  erreur,
  aide,
  indication,
  facultatif,
  children,
}: {
  id: string;
  libelle: string;
  erreur?: string;
  aide?: string;
  indication?: string;
  facultatif?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.9375rem] font-semibold">
        {libelle} {(indication || facultatif) && <span className="font-normal text-encre-4">{indication ?? "(facultatif)"}</span>}
      </label>
      {children}
      {erreur && <MessageErreur id={`${id}-erreur`}>{erreur}</MessageErreur>}
      {aide && <p className="m-0 text-[0.8125rem] text-encre-4">{aide}</p>}
    </div>
  );
}

function Recap({ titre, modifier, children }: { titre: string; modifier: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-carte border border-bord bg-surface shadow-carte">
      <div className="flex items-center justify-between pt-3 pr-3 pb-1 pl-4.5">
        <h2 className="m-0 text-base">{titre}</h2>
        <button
          type="button"
          onClick={modifier}
          aria-label={`Modifier : ${titre}`}
          className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-3 text-[0.9375rem] font-semibold text-marque hover:bg-marque-pale"
        >
          <IconeTrace d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" taille={16} />
          Modifier
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-4.5 pb-4 text-[0.9375rem]">{children}</dl>
    </div>
  );
}

function Ligne({ libelle, children, chiffres, normal }: { libelle: string; children: React.ReactNode; chiffres?: boolean; normal?: boolean }) {
  return (
    <>
      <dt className="text-encre-4">{libelle}</dt>
      <dd className={`m-0 [overflow-wrap:anywhere] ${normal ? "font-normal text-pretty" : "font-medium"} ${chiffres ? "tabular-nums" : ""}`}>{children}</dd>
    </>
  );
}

// ───────────────────────── P3 — Confirmation ─────────────────────────

function Confirmation({
  resultat,
  formulaire,
  societe,
  delais,
  titre,
}: {
  resultat: Extract<ResultatDepot, { ok: true }>;
  formulaire: Formulaire;
  societe: { slug: string; nom: string };
  delais: { qualificationH: number; reponseJO: number };
  titre: React.RefObject<HTMLHeadingElement | null>;
}) {
  const routeur = useRouter();
  const [copie, setCopie] = useState(false);
  const telephone = `+221 ${formulaire.telephone}`;
  const prenom = (formulaire.profil === "SOCIETE" ? formulaire.contactNom || formulaire.nom : formulaire.nom).split(" ")[0];
  const canaux = texteCanaux(resultat.canaux);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(resultat.numero);
    } catch {
      /* presse-papiers indisponible : le numéro reste affiché */
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2500);
  };

  const suivre = () => {
    try {
      sessionStorage.setItem("cosemad_suivi_tel", formulaire.telephone);
    } catch {
      /* stockage indisponible : le client ressaisit son téléphone */
    }
    routeur.push(`/${societe.slug}/suivi?numero=${encodeURIComponent(resultat.numero)}`);
  };

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-traitee-fond text-traitee">
          <IconeTrace d="M20 6 9 17l-5-5" taille={32} />
        </span>
        <h1 ref={titre} tabIndex={-1} className="m-0 text-[clamp(1.625rem,1.3rem+1.6vw,2rem)] leading-tight tracking-[-0.02em] outline-none">
          Votre réclamation est bien reçue
        </h1>
        <p className="m-0 text-encre-3">Merci {prenom}. Conservez ce numéro pour suivre votre demande.</p>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-carte border border-bord bg-surface px-4 py-6 shadow-carte">
        <p className="m-0 text-sm font-medium text-encre-3">Votre numéro de réclamation</p>
        <p className="m-0 text-[clamp(1.875rem,1.4rem+2.4vw,2.5rem)] font-bold tracking-[0.02em] text-marque tabular-nums">{resultat.numero}</p>
        <button
          type="button"
          onClick={copier}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-champ border border-bord-fort bg-surface px-4 text-[0.9375rem] font-semibold hover:bg-surface-2"
        >
          <IconeTrace d="M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" taille={18} />
          {copie ? "Numéro copié" : "Copier le numéro"}
        </button>
        <span role="status" className="sr-only">
          {copie ? "Numéro copié" : ""}
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-carte bg-marque-pale px-4 py-3.5 text-[0.9375rem] text-marque-encre">
        <IconeTrace d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" taille={20} className="flex-none" />
        <span>
          Un SMS de confirmation vous a été envoyé au <span className="font-semibold tabular-nums">{telephone}</span>. Vous recevrez notre réponse par {canaux}.
        </span>
      </div>

      {resultat.messages && (
        <div className="flex flex-col gap-3 rounded-carte border border-bord bg-surface p-4.5 shadow-carte">
          <p className="m-0 text-[0.8125rem] font-semibold text-encre-3">
            SMS envoyé au {telephone} <span className="font-normal">(mode démonstration : non envoyé réellement)</span>
          </p>
          <p className="m-0 max-w-96 rounded-[0.75rem_0.75rem_0.75rem_0.25rem] bg-surface-3 px-3.5 py-3 text-[0.9375rem] text-pretty">{resultat.messages.sms}</p>
          {resultat.messages.email && (
            <>
              <p className="m-0 mt-1 text-[0.8125rem] font-semibold text-encre-3">E-mail envoyé à {formulaire.email}</p>
              <p className="m-0 rounded-champ border border-bord px-4 py-3.5 text-sm whitespace-pre-wrap text-encre-2">{resultat.messages.email}</p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="m-0 text-[1.0625rem]">Les prochaines étapes</h2>
        <ol className="m-0 flex list-none flex-col p-0">
          <EtapeSuivante numero={1} faite titre="Réclamation reçue" texte={`Aujourd'hui, ${formatDateHeure(new Date(resultat.recueLe))}`} />
          <EtapeSuivante numero={2} courante titre="Analyse par nos équipes" texte={`Un responsable prend en charge votre demande sous ${delais.qualificationH} h.`} />
          <EtapeSuivante numero={3} derniere titre={`Réponse par ${canaux}`} texte={`Sous ${delais.reponseJO} jours ouvrés au plus tard.`} />
        </ol>
      </div>

      <BoutonPrincipal type="button" onClick={suivre}>
        Suivre ma réclamation
      </BoutonPrincipal>
    </section>
  );
}

function EtapeSuivante({ numero, titre, texte, faite, courante, derniere }: { numero: number; titre: string; texte: string; faite?: boolean; courante?: boolean; derniere?: boolean }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] gap-3.5">
      <div className="flex flex-col items-center">
        <span
          className={`grid size-8 place-items-center rounded-full text-[0.8125rem] font-bold ${
            faite ? "bg-marque text-white" : courante ? "border-2 border-marque bg-surface text-marque" : "border-2 border-bord-fort bg-surface text-encre-3"
          }`}
        >
          {faite ? <IconeTrace d="M20 6 9 17l-5-5" taille={16} /> : numero}
        </span>
        {!derniere && <span className="min-h-5 w-0.5 flex-1 bg-bord-fort" />}
      </div>
      <div className={derniere ? "" : "pb-5"}>
        <p className="m-0 font-semibold">{titre}</p>
        <p className="m-0 text-sm text-encre-3">{texte}</p>
      </div>
    </li>
  );
}
