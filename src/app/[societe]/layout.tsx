import { notFound } from "next/navigation";
import { modeDemo } from "@/server/demo";
import { societePortail } from "@/server/portail";
import { EnTetePortail, PiedPortail } from "@/components/portail/cadre";

/** Portail client d'une société : /carrefour-medical, /sonerco, /fls. Mobile d'abord, 40 rem de large. */
export default async function MiseEnPagePortail({ children, params }: { children: React.ReactNode; params: Promise<{ societe: string }> }) {
  const societe = await societePortail((await params).societe);
  if (!societe) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <EnTetePortail slug={societe.slug} nom={societe.nom} logo={societe.logo} />
      <main id="contenu" className="mx-auto w-full max-w-160 flex-1 px-[clamp(1rem,4vw,1.5rem)] pt-[clamp(1.5rem,5vw,3rem)] pb-12">
        {children}
      </main>
      <PiedPortail slug={societe.slug} nom={societe.nom} telephone={societe.telStandard} lienCollaborateurs={modeDemo()} />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ societe: string }> }) {
  const societe = await societePortail((await params).societe);
  return { title: { default: `Réclamations · ${societe?.nom ?? "Groupe COSEMAD"}`, template: `%s · ${societe?.nom ?? "Groupe COSEMAD"}` } };
}
