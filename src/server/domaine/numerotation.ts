/**
 * Numéros de réclamation : PREFIXE-AAAA-NNNN (CM-2026-0042, SON-2026-0027, FLS-2026-0032).
 * Le compteur est incrémenté par une seule instruction SQL qui verrouille sa ligne : deux dépôts
 * simultanés ne peuvent pas obtenir le même numéro. Appelé dans la transaction qui crée la
 * réclamation, il est annulé avec elle en cas d'erreur : pas de trou dans la numérotation.
 */
import type { Prisma } from "@/generated/prisma/client";

const MOTIF = /^([A-Z]{2,5})-(\d{4})-(\d{4,})$/;

export function formaterNumero(prefixe: string, annee: number, sequence: number): string {
  return `${prefixe}-${annee}-${String(sequence).padStart(4, "0")}`;
}

export function analyserNumero(numero: string): { prefixe: string; annee: number; sequence: number } | null {
  const m = MOTIF.exec(numero.trim().toUpperCase());
  if (!m) return null;
  return { prefixe: m[1]!, annee: Number(m[2]), sequence: Number(m[3]) };
}

type ClientSql = Pick<Prisma.TransactionClient, "$queryRaw">;

export async function prochaineSequence(client: ClientSql, societeId: string, annee: number): Promise<number> {
  const [ligne] = await client.$queryRaw<{ dernier: number }[]>`
    INSERT INTO "CompteurNumero" ("societeId", "annee", "dernier")
    VALUES (${societeId}, ${annee}, 1)
    ON CONFLICT ("societeId", "annee")
    DO UPDATE SET "dernier" = "CompteurNumero"."dernier" + 1
    RETURNING "dernier"`;
  if (!ligne) throw new Error("Compteur de numérotation indisponible");
  return Number(ligne.dernier);
}

export async function prochainNumero(
  client: ClientSql,
  societe: { id: string; code: string },
  annee: number,
): Promise<{ numero: string; annee: number; sequence: number }> {
  const sequence = await prochaineSequence(client, societe.id, annee);
  return { numero: formaterNumero(societe.code, annee, sequence), annee, sequence };
}
