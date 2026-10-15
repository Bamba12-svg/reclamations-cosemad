import Image from "next/image";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Page provisoire des étapes 0 et 1 : elle sera remplacée par le choix de la société (portail client, étape 4).

interface SocieteResume {
  code: string;
  nom: string;
  domaine: string;
  logo: string;
  activites: number;
  reclamations: number;
  ouvertes: number;
}

async function chargerEtat(): Promise<{ ok: boolean; detail: string; societes: SocieteResume[]; utilisateurs: number }> {
  try {
    const [ligne] = await db.$queryRaw<{ version: string }[]>`SELECT current_setting('server_version') AS version`;
    const tables = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public'`;
    const [societes, utilisateurs] = await Promise.all([
      db.societe.findMany({
        orderBy: { ordre: "asc" },
        select: {
          code: true,
          nom: true,
          domaine: true,
          logo: true,
          _count: { select: { activites: true, reclamations: true } },
          reclamations: { where: { clotureLe: null }, select: { id: true } },
        },
      }),
      db.user.count(),
    ]);
    return {
      ok: true,
      detail: `PostgreSQL ${ligne?.version.split(" ")[0] ?? "?"} · ${String(tables[0]?.n ?? 0)} tables`,
      utilisateurs,
      societes: societes.map((s) => ({
        code: s.code,
        nom: s.nom,
        domaine: s.domaine,
        logo: s.logo,
        activites: s._count.activites,
        reclamations: s._count.reclamations,
        ouvertes: s.reclamations.length,
      })),
    };
  } catch {
    return { ok: false, detail: "Base de données injoignable : vérifiez DATABASE_URL dans .env", societes: [], utilisateurs: 0 };
  }
}

export default async function Accueil() {
  const etat = await chargerEtat();
  const vide = etat.ok && etat.societes.length === 0;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-160 flex-col gap-10 px-[clamp(1rem,4vw,1.5rem)] py-[clamp(1.5rem,5vw,3rem)]">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm font-semibold text-marque">Groupe COSEMAD · Réclamations clients</p>
        <h1 className="m-0 text-[clamp(2rem,1.4rem+3vw,2.75rem)] leading-[1.12] font-bold tracking-[-0.025em] text-balance">
          {vide ? "La base est prête, sans données." : "Les données de démonstration sont chargées."}
        </h1>
        <p className="m-0 text-[1.0625rem] text-encre-3">
          Page provisoire : elle sera remplacée par le portail client à l&apos;étape 4.
        </p>
      </div>

      {etat.societes.length > 0 && (
        <ul aria-label="Sociétés du groupe" className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
          {etat.societes.map((s) => (
            <li key={s.code} className="flex flex-col gap-3 rounded-carte border border-bord bg-surface p-4 shadow-carte">
              <Image src={s.logo} alt={s.nom} width={160} height={64} className="h-9 w-auto max-w-full self-start object-contain" />
              <div className="flex flex-col gap-0.5">
                <span className="text-[0.9375rem] font-semibold">{s.nom}</span>
                <span className="text-[0.8125rem] text-encre-3">{s.domaine}</span>
              </div>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.875rem] tabular-nums">
                <dt className="text-encre-4">Réclamations</dt>
                <dd className="m-0 font-semibold">{s.reclamations}</dd>
                <dt className="text-encre-4">Ouvertes</dt>
                <dd className="m-0 font-semibold">{s.ouvertes}</dd>
                <dt className="text-encre-4">Activités</dt>
                <dd className="m-0 font-semibold">{s.activites}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <div
        role="status"
        className={`flex items-center gap-3 rounded-carte px-4 py-3.5 text-[0.9375rem] ${
          etat.ok ? "bg-traitee-fond text-traitee" : "bg-retard-fond text-retard"
        }`}
      >
        <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${etat.ok ? "bg-traitee" : "bg-retard"}`} />
        <span>
          <strong className="font-semibold">{etat.ok ? "Base connectée" : "Base non connectée"}</strong> · {etat.detail}
          {etat.ok && ` · ${etat.utilisateurs} utilisateurs`}
        </span>
      </div>

      {vide && (
        <p className="m-0 text-[0.9375rem] text-encre-3">
          Chargez les données de démonstration avec <code className="rounded bg-surface-3 px-1.5 py-0.5">npm run db:seed</code>.
        </p>
      )}
    </main>
  );
}
