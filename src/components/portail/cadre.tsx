"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icone } from "@/components/icone";

export const COOKIE_PORTAIL = "cosemad_portail";

export function EnTetePortail({ slug, nom, logo }: { slug: string; nom: string; logo: string }) {
  const chemin = usePathname();
  const accueil = `/${slug}`;
  // Mémorise la société pour les liens génériques (cosemad.sn/suivi du SMS).
  useEffect(() => {
    document.cookie = `${COOKIE_PORTAIL}=${slug}; path=/; max-age=31536000; samesite=lax`;
  }, [slug]);
  return (
    <header className="border-b border-bord bg-surface">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <div className="mx-auto flex max-w-160 items-center justify-between gap-4 px-[clamp(1rem,4vw,1.5rem)] py-3">
        <Link href={accueil} aria-label={`Accueil ${nom}`} className="flex min-h-11 items-center">
          <Image src={logo} alt={nom} width={176} height={44} priority className="h-11 w-auto max-w-44 object-contain" />
        </Link>
        {chemin !== accueil && (
          <Link
            href={accueil}
            className="flex min-h-11 items-center gap-1.5 rounded-champ px-3 text-[0.9375rem] font-medium text-encre-2 no-underline hover:bg-surface-3 hover:text-encre-2"
          >
            <Icone nom="chevronGauche" taille={18} />
            Accueil
          </Link>
        )}
      </div>
    </header>
  );
}

export function PiedPortail({ slug, nom, telephone }: { slug: string; nom: string; telephone: string }) {
  return (
    <footer className="border-t border-bord bg-surface">
      <div className="mx-auto flex max-w-160 flex-wrap justify-between gap-x-6 gap-y-2 px-[clamp(1rem,4vw,1.5rem)] py-5 text-[0.8125rem] text-encre-3">
        <span>
          {nom} · Groupe COSEMAD · Dakar, Sénégal · <a href={`tel:${telephone.replace(/\s/g, "")}`}>{telephone}</a>
        </span>
        <Link href={`/bo/connexion?societe=${slug}`}>Espace collaborateurs</Link>
      </div>
    </footer>
  );
}
