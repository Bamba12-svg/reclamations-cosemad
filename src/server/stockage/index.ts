import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { contenuDemo } from "./demo";
import type { TypeAccepte } from "./controle";

/**
 * Stockage des pièces jointes derrière une interface : disque local en développement,
 * stockage objet (Infomaniak, compatible S3) en ligne — à brancher à la mise en ligne.
 * Les fichiers ne sont JAMAIS servis directement : ils passent par une route qui vérifie les droits.
 */
export interface Stockage {
  enregistrer(cle: string, octets: Uint8Array): Promise<void>;
  lire(cle: string): Promise<Uint8Array | null>;
  supprimer(cle: string): Promise<void>;
}

const CLE_VALIDE = /^[a-z0-9][a-z0-9/_.-]*$/;

class StockageDisque implements Stockage {
  private readonly racine = resolve(process.env.STOCKAGE_DOSSIER ?? "stockage");

  private chemin(cle: string): string {
    if (!CLE_VALIDE.test(cle) || cle.includes("..")) throw new Error(`Clé de stockage invalide : ${cle}`);
    const chemin = resolve(this.racine, cle);
    if (!chemin.startsWith(this.racine + sep)) throw new Error("Chemin hors du dossier de stockage");
    return chemin;
  }

  async enregistrer(cle: string, octets: Uint8Array) {
    const chemin = this.chemin(cle);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, octets, { flag: "wx" }); // jamais d'écrasement
  }

  async lire(cle: string) {
    try {
      return new Uint8Array(await readFile(this.chemin(cle)));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async supprimer(cle: string) {
    await rm(this.chemin(cle), { force: true });
  }
}

let instance: Stockage | null = null;
export function stockage(): Stockage {
  return (instance ??= new StockageDisque());
}

/** Clé aléatoire : le nom choisi par l'utilisateur n'apparaît jamais dans le chemin. */
export function nouvelleCle(type: TypeAccepte, maintenant = new Date()): string {
  const a = maintenant.getUTCFullYear();
  const m = String(maintenant.getUTCMonth() + 1).padStart(2, "0");
  return `pieces/${a}/${m}/${randomUUID()}.${type.extension}`;
}

export function empreinteSha256(octets: Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

/** Contenu d'une pièce jointe. Les pièces des données de démonstration (clé « demo/… ») sont générées. */
export async function lireContenu(piece: { cleStockage: string; typeMime: string; nomOriginal: string }): Promise<Uint8Array | null> {
  if (piece.cleStockage.startsWith("demo/")) return contenuDemo(piece.typeMime, piece.nomOriginal);
  return stockage().lire(piece.cleStockage);
}
