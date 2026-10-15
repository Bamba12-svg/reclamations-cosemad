import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icone, IconeTrace } from "@/components/icone";
import { societePortail, societesPortail } from "@/server/portail";

const ETAPES = [
  { libelle: "Je dépose", trace: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M16 13H8M16 17H8" },
  { libelle: "COSEMAD traite", trace: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { libelle: "Je reçois la réponse", trace: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm18 3-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" },
];

/** P1 — Accueil du portail. */
export default async function AccueilPortail({ params }: { params: Promise<{ societe: string }> }) {
  const [societe, societes] = await Promise.all([societePortail((await params).societe), societesPortail()]);
  if (!societe) notFound();

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-2.5">
        <p id="choix-societe" className="m-0 text-[0.8125rem] font-semibold text-encre-3">
          Vous êtes client de :
        </p>
        <nav aria-labelledby="choix-societe" className="grid grid-cols-3 gap-2">
          {societes.map((s) => {
            const actif = s.slug === societe.slug;
            return (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                aria-current={actif ? "page" : undefined}
                title={`${s.nom} · ${s.domaine}`}
                className={`flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-carte px-1.5 py-2.5 no-underline hover:border-marque ${
                  actif ? "border-2 border-marque bg-marque-pale" : "border border-bord-fort bg-surface"
                }`}
              >
                <Image src={s.logo} alt={s.nom} width={120} height={32} className="max-h-8 w-auto max-w-full object-contain" />
                <span className="text-center text-xs leading-tight font-medium text-encre-3">{s.domaine}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm font-semibold text-marque">Service client · {societe.nom}</p>
        <h1 className="m-0 text-[clamp(2rem,1.4rem+3vw,2.75rem)] leading-[1.12] font-bold tracking-[-0.025em] text-balance">
          Une réclamation ? Nous vous écoutons.
        </h1>
        <p className="m-0 text-[1.0625rem] text-pretty text-encre-3">
          Décrivez votre problème en quelques minutes. Vous recevez un numéro de suivi par SMS et une réponse de nos équipes.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href={`/${societe.slug}/reclamation`}
          className="flex min-h-13 items-center justify-center gap-2 rounded-carte bg-marque text-[1.0625rem] font-semibold text-white no-underline hover:bg-marque-fonce hover:text-white"
        >
          <Icone nom="plus" />
          Déposer une réclamation
        </Link>
        <Link
          href={`/${societe.slug}/suivi`}
          className="flex min-h-13 items-center justify-center gap-2 rounded-carte border border-bord-fort bg-surface text-[1.0625rem] font-semibold text-encre no-underline hover:border-encre-5 hover:bg-surface-2 hover:text-encre"
        >
          <Icone nom="recherche" />
          Suivre ma réclamation
        </Link>
      </div>

      <ol className="m-0 grid list-none grid-cols-3 gap-3 p-0">
        {ETAPES.map((e) => (
          <li key={e.libelle} className="flex flex-col items-center gap-2.5 rounded-carte border border-bord bg-surface px-2 py-5 text-center shadow-carte">
            <span className="grid size-11 place-items-center rounded-full bg-marque-pale text-marque">
              <IconeTrace d={e.trace} taille={22} />
            </span>
            <span className="text-sm leading-[1.3] font-semibold">{e.libelle}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3.5">
        <h2 className="m-0 text-[0.8125rem] font-semibold text-encre-3">Nos activités</h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-2.5 p-0">
          {societe.activites.map((a) => (
            <li key={a.code} className="flex items-center gap-2.5 rounded-carte border border-bord bg-surface p-3">
              <span className="grid size-9 flex-none place-items-center rounded-lg bg-marque-pale text-marque">
                <IconeTrace d={a.icone} taille={18} />
              </span>
              <span className="text-[0.8125rem] leading-[1.3] font-semibold">{a.nomCourt}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
