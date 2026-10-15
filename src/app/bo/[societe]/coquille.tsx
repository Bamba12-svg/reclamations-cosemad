"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { Icone, type NomIcone } from "@/components/icone";
import type { Notification } from "@/server/requetes/coquille";
import { memoriserSociete, seDeconnecter, simulerProfil } from "../actions";

export interface ProfilDemo {
  id: string;
  nom: string;
  role: string;
  initiales: string;
}

interface Props {
  children: ReactNode;
  societe: { slug: string; nom: string; logo: string };
  societes: { slug: string; nom: string; domaine: string }[];
  utilisateur: ProfilDemo;
  compteurs: { ouvertes: number; mesActions: number; aViser: number };
  notifications: Notification[];
  peutCreer: boolean;
  peutParametrer: boolean;
  profils: ProfilDemo[] | null;
}

/** Ferme un menu déroulant au clic extérieur ou avec Échap (et rend le focus au bouton). */
function useFermeture(ouvert: boolean, fermer: () => void, zone: RefObject<HTMLElement | null>, bouton: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) fermer();
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fermer();
        bouton.current?.focus();
      }
    };
    document.addEventListener("mousedown", clic);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("mousedown", clic);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert, fermer, zone, bouton]);
}

export function Coquille({ children, societe, societes, utilisateur, compteurs, notifications, peutCreer, peutParametrer, profils }: Props) {
  const chemin = usePathname();
  const routeur = useRouter();
  const base = `/bo/${societe.slug}`;
  // null : largeur décidée par l'écran (replié sous 1024 px, comme la maquette) ; sinon choix de l'utilisateur.
  const [replie, setReplie] = useState<boolean | null>(null);
  const [notifOuvert, setNotifOuvert] = useState(false);
  const [profilOuvert, setProfilOuvert] = useState(false);
  const [changement, demarrer] = useTransition();
  const zoneNotif = useRef<HTMLDivElement>(null);
  const boutonNotif = useRef<HTMLButtonElement>(null);
  const zoneProfil = useRef<HTMLDivElement>(null);
  const boutonProfil = useRef<HTMLButtonElement>(null);
  useFermeture(notifOuvert, () => setNotifOuvert(false), zoneNotif, boutonNotif);
  useFermeture(profilOuvert, () => setProfilOuvert(false), zoneProfil, boutonProfil);

  const section = chemin.slice(base.length).split("/")[1] ?? "";
  const actif = (cle: string) =>
    cle === "" ? section === "" : cle === "reclamations" ? section === "reclamations" : section === cle;

  const liens: { cle: string; libelle: string; icone: NomIcone; compte?: number }[] = [
    { cle: "", libelle: "Tableau de bord", icone: "tableauDeBord" },
    { cle: "reclamations", libelle: "Réclamations", icone: "reclamations", compte: compteurs.ouvertes },
    { cle: "mes-actions", libelle: "Mes actions", icone: "mesActions", compte: compteurs.mesActions },
    { cle: "a-viser", libelle: "À viser", icone: "aViser", compte: compteurs.aViser },
    ...(peutParametrer ? [{ cle: "parametres", libelle: "Paramètres", icone: "parametres" as const }] : []),
  ];

  const changerSociete = (slug: string) => {
    // Même rubrique dans l'autre société ; une fiche (numéro propre à la société) renvoie à la liste.
    const sousChemin = section === "reclamations" ? "/reclamations" : section ? `/${section}` : "";
    demarrer(async () => {
      await memoriserSociete(slug);
      routeur.push(`/bo/${slug}${sousChemin}`);
    });
  };

  // Largeur du menu : classes réactives tant que l'utilisateur n'a rien choisi.
  const largeur = replie === null ? "w-18 lg:w-60" : replie ? "w-18" : "w-60";
  // Classes écrites en entier : Tailwind ne génère que les classes qu'il trouve telles quelles dans le code.
  const AFFICHAGE = {
    flex: { auto: "hidden lg:flex", ouvert: "flex" },
    block: { auto: "hidden lg:block", ouvert: "block" },
    inline: { auto: "hidden lg:inline", ouvert: "inline" },
  } as const;
  const montrer = (classe: keyof typeof AFFICHAGE) => (replie === null ? AFFICHAGE[classe].auto : replie ? "hidden" : AFFICHAGE[classe].ouvert);

  return (
    <div className="flex min-h-screen bg-fond text-[0.9375rem]">
      <a href="#bo-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Aller au contenu
      </a>

      <aside
        className={`sticky top-0 flex h-screen flex-none flex-col gap-6 overflow-hidden border-r border-bord bg-surface px-3 py-4 transition-[width] duration-200 print:hidden ${largeur}`}
      >
        <div className="flex min-h-11 items-center gap-2.5 px-1">
          <Image src={societe.logo} alt={societe.nom} width={96} height={40} className="h-10 w-auto max-w-full min-w-0 flex-[0_1_auto] object-contain" />
          <span className={`${montrer("flex")} flex-col leading-[1.1] whitespace-nowrap`}>
            <span className="text-[0.9375rem] font-bold text-encre">{societe.nom}</span>
            <span className="text-xs font-medium text-encre-3">Réclamations</span>
          </span>
        </div>

        {societes.length > 1 && (
          <label className={`${montrer("flex")} flex-col gap-1 px-1`}>
            <span className="text-xs font-semibold text-encre-3">Société</span>
            <select
              aria-label="Changer de société"
              value={societe.slug}
              disabled={changement}
              onChange={(e) => changerSociete(e.target.value)}
              className="min-h-11 cursor-pointer rounded-champ border border-bord-fort bg-surface px-2.5 text-sm font-semibold"
            >
              {societes.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.nom} · {s.domaine}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1">
          {liens.map((l) => {
            const estActif = actif(l.cle);
            return (
              <Link
                key={l.cle}
                href={l.cle ? `${base}/${l.cle}` : base}
                title={l.libelle}
                aria-current={estActif ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-champ px-3 text-[0.9375rem] whitespace-nowrap no-underline hover:bg-surface-3 hover:text-inherit ${
                  estActif ? "bg-marque-pale font-semibold text-marque hover:bg-marque-pale hover:text-marque" : "font-medium text-encre-2"
                } ${replie === true ? "justify-center" : replie === null ? "justify-center lg:justify-start" : "justify-start"}`}
              >
                <Icone nom={l.icone} className="flex-none" />
                <span className={`${montrer("block")} flex-1`}>{l.libelle}</span>
                {l.compte !== undefined && l.compte > 0 && (
                  <span className={`${montrer("block")} min-w-6 rounded-full bg-surface-3 px-1.75 text-center text-xs leading-5.5 font-semibold text-encre-2 tabular-nums`}>
                    {l.compte}
                  </span>
                )}
                {l.compte !== undefined && l.compte > 0 && <span className="sr-only"> ({l.compte})</span>}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setReplie((r) => !(r ?? window.innerWidth < 1024))}
          aria-label={replie ? "Déplier le menu" : "Replier le menu"}
          title={replie ? "Déplier le menu" : "Replier le menu"}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-champ border-0 bg-transparent px-3 text-sm font-medium whitespace-nowrap text-encre-3 hover:bg-surface-3"
        >
          <Icone nom="panneau" className="flex-none" />
          <span className={montrer("inline")}>Replier le menu</span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 border-b border-bord bg-white/92 px-[clamp(1rem,2.5vw,2rem)] py-2 backdrop-blur-sm print:hidden">
          <form action={`${base}/reclamations`} role="search" className="flex min-h-11 max-w-md flex-[1_1_14rem] items-center gap-2 rounded-champ border border-bord bg-fond px-3.5 text-encre-4 focus-within:outline-2 focus-within:outline-marque">
            <Icone nom="recherche" taille={18} className="flex-none" />
            <input
              name="q"
              type="search"
              aria-label="Recherche globale"
              placeholder="Rechercher un numéro, un client, un mot…"
              className="min-w-0 flex-1 border-0 bg-transparent text-[0.9375rem] text-encre outline-none"
            />
          </form>
          <div className="flex-1" />
          {peutCreer && (
            <Link
              href={`${base}/reclamations/nouvelle`}
              className="inline-flex min-h-11 items-center gap-2 rounded-champ bg-marque px-4.5 text-[0.9375rem] font-semibold whitespace-nowrap text-white no-underline hover:bg-marque-fonce hover:text-white"
            >
              <Icone nom="plus" taille={18} epaisseur={2} />
              Nouvelle réclamation
            </Link>
          )}

          <div ref={zoneNotif} className="relative">
            <button
              ref={boutonNotif}
              type="button"
              onClick={() => {
                setNotifOuvert((o) => !o);
                setProfilOuvert(false);
              }}
              aria-expanded={notifOuvert}
              aria-controls="panneau-notifications"
              aria-label={`Notifications (${notifications.length})`}
              className="relative grid size-11 cursor-pointer place-items-center rounded-champ border border-bord bg-surface text-encre-2 hover:bg-surface-2"
            >
              <Icone nom="cloche" />
              {notifications.length > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1.5 box-content grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-white bg-marque px-1 text-[0.6875rem] font-bold text-white"
                >
                  {notifications.length}
                </span>
              )}
            </button>
            {notifOuvert && (
              <div
                id="panneau-notifications"
                className="absolute top-[calc(100%+0.5rem)] right-0 z-40 w-[min(22rem,90vw)] rounded-carte border border-bord bg-surface p-2 shadow-[0_12px_32px_rgba(16,24,40,0.12)]"
              >
                <p className="m-0 px-3 py-2 text-[0.8125rem] font-semibold text-encre-3">Notifications · {notifications.length}</p>
                {notifications.length === 0 && <p className="m-0 px-3 pt-2 pb-3 text-sm text-encre-3">Aucune notification.</p>}
                <ul className="m-0 flex max-h-[min(24rem,60vh)] list-none flex-col overflow-auto p-0">
                  {notifications.map((n, i) => (
                    <li key={`${n.numero}-${i}`}>
                      <Link
                        href={`${base}/reclamations/${n.numero}`}
                        onClick={() => setNotifOuvert(false)}
                        className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-encre no-underline hover:bg-fond hover:text-encre"
                      >
                        <span className="text-sm font-semibold">{n.titre}</span>
                        <span className="text-[0.8125rem] text-encre-3">{n.detail}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div ref={zoneProfil} className="relative">
            <button
              ref={boutonProfil}
              type="button"
              onClick={() => {
                setProfilOuvert((o) => !o);
                setNotifOuvert(false);
              }}
              aria-expanded={profilOuvert}
              aria-controls="menu-profil"
              aria-label={`Profil : ${utilisateur.nom}, ${utilisateur.role}`}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-champ border border-bord bg-surface py-1 pr-2.5 pl-1 text-left hover:bg-surface-2"
            >
              <span aria-hidden="true" className="grid size-8.5 flex-none place-items-center rounded-full bg-marque-pale text-[0.8125rem] font-bold text-marque">
                {utilisateur.initiales}
              </span>
              <span className="hidden flex-col leading-[1.2] whitespace-nowrap sm:flex">
                <span className="text-sm font-semibold">{utilisateur.nom}</span>
                <span className="text-xs text-encre-3">{utilisateur.role}</span>
              </span>
              <Icone nom="chevronBas" taille={16} className="text-encre-3" />
            </button>
            {profilOuvert && (
              <div
                id="menu-profil"
                className="absolute top-[calc(100%+0.5rem)] right-0 z-40 w-[min(19rem,90vw)] rounded-carte border border-bord bg-surface p-2 shadow-[0_12px_32px_rgba(16,24,40,0.12)]"
              >
                <div className="px-3 pt-2 pb-1 sm:hidden">
                  <p className="m-0 text-sm font-semibold">{utilisateur.nom}</p>
                  <p className="m-0 text-xs text-encre-3">{utilisateur.role}</p>
                </div>
                {profils && (
                  <>
                    <p className="m-0 px-3 pt-2 pb-1 text-[0.8125rem] font-semibold text-encre-3">Simuler un profil (démonstration)</p>
                    <div className="flex max-h-[min(22rem,55vh)] flex-col overflow-auto">
                      {profils.map((p) => (
                        <form key={p.id} action={() => simulerProfil(p.id, societe.slug)} onSubmit={() => setProfilOuvert(false)}>
                          <button
                            type="submit"
                            aria-current={p.id === utilisateur.id ? "true" : undefined}
                            className={`flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 px-3 py-1.5 text-left hover:bg-fond ${
                              p.id === utilisateur.id ? "bg-marque-pale" : "bg-transparent"
                            }`}
                          >
                            <span aria-hidden="true" className="grid size-7.5 flex-none place-items-center rounded-full bg-surface-3 text-xs font-bold text-encre-2">
                              {p.initiales}
                            </span>
                            <span className="flex flex-col leading-[1.25]">
                              <span className="text-sm font-semibold">{p.nom}</span>
                              <span className="text-xs text-encre-3">{p.role}</span>
                            </span>
                          </button>
                        </form>
                      ))}
                    </div>
                    <div className="my-1.5 h-px bg-bord" />
                  </>
                )}
                <form action={seDeconnecter}>
                  <button
                    type="submit"
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 text-left text-sm font-medium hover:bg-fond"
                  >
                    <Icone nom="deconnexion" taille={18} />
                    Se déconnecter
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        <main id="bo-main" tabIndex={-1} className="mx-auto w-full max-w-368 flex-1 px-[clamp(1rem,2.5vw,2rem)] pt-[clamp(1.25rem,2.5vw,2rem)] pb-16 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
