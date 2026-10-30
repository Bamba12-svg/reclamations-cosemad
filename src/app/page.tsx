import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icone } from "@/components/icone";
import { societesPortail } from "@/server/portail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Réclamations clients · Groupe COSEMAD" } };

/**
 * Racine (reclamations.cosemad.sn) : le client choisit SA société. Les filiales sont des sociétés
 * distinctes : on n'envoie jamais un client sur le portail d'une autre par défaut.
 */
export default async function ChoixSociete() {
  const societes = await societesPortail();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <main id="contenu" className="mx-auto flex w-full max-w-160 flex-1 flex-col gap-8 px-[clamp(1rem,4vw,1.5rem)] pt-[clamp(2rem,7vw,4.5rem)] pb-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <Image src="/logos/groupe-cosemad.png" alt="Groupe COSEMAD" width={300} height={349} priority className="h-20 w-auto" />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[clamp(1.625rem,1.3rem+1.6vw,2rem)] leading-tight tracking-[-0.02em]">Réclamations clients</h1>
            <p className="m-0 text-base text-encre-2 text-pretty">Choisissez la société concernée pour déposer une réclamation ou suivre une demande en cours.</p>
          </div>
        </div>

        {societes.length === 0 ? (
          <p className="m-0 rounded-carte border border-bord bg-surface p-4 text-center text-encre-2">Aucune société n&apos;est configurée.</p>
        ) : (
          <nav aria-label="Sociétés du Groupe COSEMAD">
            <ul className="m-0 grid list-none gap-3 p-0">
              {societes.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/${s.slug}`}
                    className="flex min-h-22 items-center gap-4 rounded-carte border border-bord-fort bg-surface px-[clamp(1rem,3vw,1.5rem)] py-3 text-encre no-underline shadow-carte hover:border-marque hover:text-encre focus-visible:border-marque"
                  >
                    <span className="grid h-14 w-28 flex-none place-items-center">
                      <Image src={s.logo} alt="" width={112} height={56} className="max-h-14 w-auto max-w-full object-contain" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[1.0625rem] font-semibold">{s.nom}</span>
                      <span className="text-sm text-encre-3">{s.domaine}</span>
                    </span>
                    <Icone nom="chevronDroite" taille={20} className="flex-none text-encre-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <footer className="border-t border-bord bg-surface">
        <p className="mx-auto m-0 max-w-160 px-[clamp(1rem,4vw,1.5rem)] py-5 text-[0.8125rem] text-encre-3">Groupe COSEMAD · Dakar, Sénégal</p>
      </footer>
    </div>
  );
}
