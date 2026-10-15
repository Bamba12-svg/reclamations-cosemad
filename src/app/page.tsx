import Image from "next/image";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

// Page provisoire de l'étape 0 : elle sera remplacée par le choix de la société (portail client, étape 4).
const SOCIETES = [
  { nom: "Carrefour Médical", domaine: "Santé", logo: "/logos/carrefour-medical.png" },
  { nom: "Sonerco", domaine: "Énergie, sécurité, construction", logo: "/logos/sonerco.png" },
  { nom: "FLS", domaine: "Agroalimentaire", logo: "/logos/fls.png" },
] as const;

async function etatBase(): Promise<{ ok: boolean; detail: string }> {
  try {
    const [ligne] = await db.$queryRaw<{ version: string }[]>`SELECT current_setting('server_version') AS version`;
    const tables = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public'`;
    return { ok: true, detail: `PostgreSQL ${ligne?.version.split(" ")[0] ?? "?"} · ${String(tables[0]?.n ?? 0)} tables` };
  } catch {
    return { ok: false, detail: "Base de données injoignable : vérifiez DATABASE_URL dans .env" };
  }
}

export default async function Accueil() {
  const base = await etatBase();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-160 flex-col gap-10 px-[clamp(1rem,4vw,1.5rem)] py-[clamp(1.5rem,5vw,3rem)]">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm font-semibold text-marque">Groupe COSEMAD · Réclamations clients</p>
        <h1 className="m-0 text-[clamp(2rem,1.4rem+3vw,2.75rem)] leading-[1.12] font-bold tracking-[-0.025em] text-balance">
          Le socle du projet est en place.
        </h1>
        <p className="m-0 text-[1.0625rem] text-encre-3">
          Cette page provisoire sera remplacée par le portail client à l&apos;étape 4.
        </p>
      </div>

      <div role="list" aria-label="Sociétés du groupe" className="grid grid-cols-3 gap-2">
        {SOCIETES.map((s) => (
          <div
            role="listitem"
            key={s.nom}
            className="flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-carte border border-bord-fort bg-surface px-1.5 py-2.5"
          >
            <Image src={s.logo} alt={s.nom} width={160} height={64} className="h-8 w-auto max-w-full object-contain" />
            <span className="text-center text-xs leading-tight font-medium text-encre-3">{s.domaine}</span>
          </div>
        ))}
      </div>

      <div
        role="status"
        className={`flex items-center gap-3 rounded-carte px-4 py-3.5 text-[0.9375rem] ${
          base.ok ? "bg-traitee-fond text-traitee" : "bg-retard-fond text-retard"
        }`}
      >
        <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${base.ok ? "bg-traitee" : "bg-retard"}`} />
        <span>
          <strong className="font-semibold">{base.ok ? "Base connectée" : "Base non connectée"}</strong> · {base.detail}
        </span>
      </div>
    </main>
  );
}
