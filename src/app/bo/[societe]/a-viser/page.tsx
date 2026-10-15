import type { Metadata } from "next";
import Link from "next/link";
import { EnTetePage } from "@/components/bo/en-tete-page";
import { fichesAViser } from "@/server/requetes/listes";
import { exigerSociete } from "@/server/session";

export const metadata: Metadata = { title: "À viser" };

function EtatVisa({ fait, libelle }: { fait: boolean; libelle: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.8125rem] font-semibold ${fait ? "border-traitee-bord bg-traitee-fond text-traitee" : "border-bord bg-surface-3 text-encre-2"}`}
    >
      <span aria-hidden="true">{fait ? "✓" : "○"}</span> {libelle}
      <span className="sr-only">{fait ? " : visé" : " : en attente"}</span>
    </span>
  );
}

export default async function AViser({ params }: { params: Promise<{ societe: string }> }) {
  const { societe: slug } = await params;
  const { acteur, societe } = await exigerSociete(slug);
  const fiches = await fichesAViser(acteur, societe.id);
  return (
    <section className="flex max-w-240 flex-col gap-5">
      <EnTetePage
        titre="À viser"
        sousTitre="Fiches dont le traitement est terminé et la réponse envoyée. Elles attendent le visa de la Direction Commerciale et du Service QHSE."
      />
      {fiches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-carte border border-bord bg-surface px-6 py-16 text-center">
          <p className="m-0 text-base font-semibold">Aucune fiche à viser</p>
          <p className="m-0 text-encre-3">Toutes les fiches terminées ont été visées.</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {fiches.map((f) => (
            <li key={f.numero}>
              <Link
                href={`/bo/${slug}/reclamations/${f.numero}`}
                className="flex flex-wrap items-center gap-4 rounded-carte border border-bord bg-surface px-5 py-4 text-encre no-underline shadow-carte hover:border-bord-fort hover:bg-surface-2 hover:text-encre"
              >
                <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-0.5">
                  <span className="font-semibold tabular-nums">
                    {f.numero} · {f.client}
                  </span>
                  <span className="text-sm text-encre-3">
                    {f.activite} · {f.description}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EtatVisa fait={f.viseeDC} libelle="Dir. Commerciale" />
                  <EtatVisa fait={f.viseeQHSE} libelle="QHSE" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
