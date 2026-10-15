import "server-only";
import ExcelJS from "exceljs";
import type { StatutReclamation } from "@/lib/libelles";
import { COLONNES_SUIVI, type LigneSuivi } from "../requetes/suivi";

const LARGEURS = [15, 12, 28, 14, 45, 38, 45, 20, 14, 38, 11, 12, 32, 12];
const COULEURS_STATUT: Record<StatutReclamation, { fond: string; texte: string }> = {
  NOUVELLE: { fond: "FFEFF4FF", texte: "FF1D4ED8" },
  EN_COURS: { fond: "FFFFFAEB", texte: "FF93370D" },
  EN_RETARD: { fond: "FFFEF3F2", texte: "FFB42318" },
  TRAITEE: { fond: "FFECFDF3", texte: "FF067647" },
};

/**
 * Export Excel du tableau de suivi : mêmes colonnes et même ordre que le tableau Excel du QHSE,
 * dates en vraies dates Excel (triables), en-tête figé, filtres automatiques, mise en page paysage.
 */
export async function classeurSuivi(lignes: LigneSuivi[], titre: string): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "Plateforme réclamations — Groupe COSEMAD";
  classeur.created = new Date();
  classeur.title = titre;

  const feuille = classeur.addWorksheet("Suivi des réclamations", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" },
    headerFooter: { oddFooter: `&L${titre}&RPage &P / &N` },
  });
  feuille.columns = COLONNES_SUIVI.map((entete, i) => ({ header: entete, key: `c${i}`, width: LARGEURS[i] }));

  const entete = feuille.getRow(1);
  entete.height = 34;
  entete.eachCell((cellule) => {
    cellule.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
    cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B4A8B" } };
    cellule.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  for (const l of lignes) {
    const ligne = feuille.addRow([
      l.numero,
      jourExcel(l.dateReception),
      l.client,
      l.mode,
      l.description,
      l.causes,
      l.actions,
      l.responsable,
      l.echeances,
      l.criteres,
      l.efficacite,
      l.dateCloture ? jourExcel(l.dateCloture) : null,
      l.observations,
      l.libelleStatut,
    ]);
    ligne.alignment = { vertical: "top", wrapText: true };
    ligne.getCell(2).numFmt = "dd/mm/yyyy";
    ligne.getCell(12).numFmt = "dd/mm/yyyy";
    const couleurs = COULEURS_STATUT[l.statut];
    const statut = ligne.getCell(14);
    statut.fill = { type: "pattern", pattern: "solid", fgColor: { argb: couleurs.fond } };
    statut.font = { bold: true, color: { argb: couleurs.texte } };
    ligne.getCell(1).font = { bold: true, color: { argb: "FF0B4A8B" } };
  }

  feuille.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLONNES_SUIVI.length } };
  feuille.eachRow((ligne) =>
    ligne.eachCell({ includeEmpty: true }, (cellule) => {
      cellule.border = { bottom: { style: "thin", color: { argb: "FFE4E7EC" } } };
    }),
  );

  return Buffer.from(await classeur.xlsx.writeBuffer());
}

/** Date seule pour Excel (le jour de Dakar, sans décalage horaire). */
function jourExcel(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
