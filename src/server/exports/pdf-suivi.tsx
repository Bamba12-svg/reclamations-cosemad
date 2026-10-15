import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { StatutReclamation } from "@/lib/libelles";
import { COLONNES_SUIVI, celluleSuivi, type LigneSuivi } from "../requetes/suivi";

// Largeurs relatives des 14 colonnes (mêmes proportions qu'à l'écran).
const POIDS = [8.75, 7, 12, 7.5, 16, 14, 16, 9, 8, 14, 6.5, 7, 12, 7.5];
const SOMME = POIDS.reduce((a, b) => a + b, 0);
const COULEUR_STATUT: Record<StatutReclamation, string> = { NOUVELLE: "#1D4ED8", EN_COURS: "#93370D", EN_RETARD: "#B42318", TRAITEE: "#067647" };

const s = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 30, paddingHorizontal: 22, fontFamily: "Helvetica", fontSize: 6.5, color: "#101828" },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#E4E7EC" },
  marque: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { height: 30, objectFit: "contain" },
  titre: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0B4A8B" },
  sousTitre: { fontSize: 7.5, color: "#475467", marginTop: 2 },
  edition: { fontSize: 7, color: "#475467", textAlign: "right" },
  ligneEntete: { flexDirection: "row", backgroundColor: "#0B4A8B", color: "#FFFFFF", fontFamily: "Helvetica-Bold" },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E4E7EC" },
  ligneRetard: { backgroundColor: "#FFFBFA" },
  cellule: { paddingVertical: 3, paddingHorizontal: 3 },
  pied: { position: "absolute", bottom: 14, left: 22, right: 22, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: "#667085" },
});

const largeur = (i: number) => ({ width: `${((POIDS[i] ?? 1) / SOMME) * 100}%` });

/** Export PDF du tableau de suivi : A4 paysage, en-tête de colonnes répété sur chaque page. */
export async function pdfSuivi(args: { lignes: LigneSuivi[]; societe: { nom: string; logo: string }; perimetre: string; filtres: string; edition: string }): Promise<Buffer> {
  const logo = await readFile(join(/*turbopackIgnore: true*/ process.cwd(), "public", args.societe.logo.replace(/^\//, ""))).catch(() => null);
  const titre = `Tableau de suivi des réclamations · ${args.perimetre}`;

  const document = (
    <Document title={titre} author="Groupe COSEMAD" creator="Plateforme réclamations COSEMAD" language="fr">
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        <View style={s.entete} fixed>
          <View style={s.marque}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF (@react-pdf), pas une balise <img> HTML */}
            {logo && <Image src={{ data: logo, format: "png" }} style={s.logo} />}
            <View>
              <Text style={s.titre}>{titre}</Text>
              <Text style={s.sousTitre}>
                {args.societe.nom} · {args.filtres}
              </Text>
            </View>
          </View>
          <Text style={s.edition}>
            Édité le {args.edition}
            {"\n"}
            {args.lignes.length} réclamation{args.lignes.length > 1 ? "s" : ""}
          </Text>
        </View>

        <View style={s.ligneEntete} fixed>
          {COLONNES_SUIVI.map((c, i) => (
            <Text key={c} style={[s.cellule, largeur(i)]}>
              {c}
            </Text>
          ))}
        </View>

        {args.lignes.map((l) => (
          <View key={l.numero} style={l.statut === "EN_RETARD" ? [s.ligne, s.ligneRetard] : s.ligne} wrap={false}>
            {celluleSuivi(l).map((valeur, i) => (
              <Text
                key={i}
                style={[
                  s.cellule,
                  largeur(i),
                  i === 0 ? { fontFamily: "Helvetica-Bold", color: "#0B4A8B" } : {},
                  i === 13 ? { fontFamily: "Helvetica-Bold", color: COULEUR_STATUT[l.statut] } : {},
                ]}
              >
                {valeur || "—"}
              </Text>
            ))}
          </View>
        ))}

        {args.lignes.length === 0 && <Text style={{ marginTop: 20, textAlign: "center", color: "#475467" }}>Aucune réclamation ne correspond aux filtres.</Text>}

        <View style={s.pied} fixed>
          <Text>Groupe COSEMAD · Procédure PR06 · Suivi des réclamations</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} sur ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(document);
}
