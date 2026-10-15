import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ComponentProps } from "react";
import { REFERENCE_PR06, type DonneesPr06, type VisaPr06 } from "../fiche/pr06";

// Pas de césure automatique : elle couperait les noms propres.
// Attention : pas de « lineHeight » sur la page ni sur le pied : @react-pdf n'écrit alors plus le texte
// calculé « Page x sur n » (constaté avec la version 4.9).
Font.registerHyphenationCallback((mot) => [mot]);

/**
 * PDF de la fiche PR06-ENR-01, même grille que l'aperçu (formulaire papier, A4 portrait, Times).
 * Si les actions ou les textes dépassent une page, le contenu continue sur la suivante et le pied
 * « Page x sur n » est répété.
 */

const B = "1pt solid #000000";
const s = StyleSheet.create({
  page: { paddingTop: "8mm", paddingBottom: "25mm", paddingHorizontal: "7.5mm", fontFamily: "Times-Roman", fontSize: 12, color: "#000000" },
  entete: { flexDirection: "row", border: B, height: "17.5mm", marginHorizontal: "0.8mm" },
  logo: { width: "37mm", borderRight: B, alignItems: "center", justifyContent: "center", padding: "1mm" },
  titre: { width: "102mm", borderRight: B, fontFamily: "Helvetica-Bold", textAlign: "center" },
  reference: { flex: 1, justifyContent: "center", paddingHorizontal: "2mm", fontSize: 9.75, lineHeight: 1.3 },
  encadre: { border: B, marginTop: "3.5mm" },
  titreEncadre: { paddingVertical: "0.4mm", paddingHorizontal: "2mm", borderBottom: B, textAlign: "center", fontFamily: "Times-Bold" },
  ligne: { flexDirection: "row" },
  case: { width: "3.6mm", height: "3.6mm", border: B, alignItems: "center", justifyContent: "center", marginRight: "2.5mm" },
  x: { fontFamily: "Helvetica-Bold", fontSize: 8, lineHeight: 1 },
  cellule: { paddingVertical: "0.8mm", paddingHorizontal: "1.5mm", borderRight: B, fontSize: 10.5 },
  tampon: { alignSelf: "flex-start", marginTop: "0.6mm", paddingVertical: "0.3mm", paddingHorizontal: "1.5mm", border: "1pt solid #0B4A8B", color: "#0B4A8B", fontFamily: "Helvetica-Bold", fontSize: 6.75, letterSpacing: 0.3 },
  pied: { position: "absolute", left: "7.5mm", right: "7.5mm", bottom: "8mm", height: "15mm", flexDirection: "row", border: B },
});

const COLONNES = ["73mm", "45mm", "26mm", "26mm"] as const;

function Case({ cochee, libelle, style }: { cochee: boolean; libelle: string; style?: Exclude<ComponentProps<typeof View>["style"], unknown[] | undefined> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", marginRight: "7mm", marginBottom: "1mm" }, style ?? {}]}>
      <View style={s.case}>{cochee ? <Text style={s.x}>X</Text> : null}</View>
      <Text>{libelle}</Text>
    </View>
  );
}

function Signature({ visa }: { visa: VisaPr06 | null }) {
  if (!visa) return null;
  return (
    <View style={{ fontSize: 10.5 }}>
      <Text>{visa.nom}</Text>
      <Text>{visa.quand}</Text>
      <Text style={s.tampon}>VISÉ ÉLECTRONIQUEMENT</Text>
    </View>
  );
}

async function image(chemin: string): Promise<Buffer | null> {
  return readFile(join(/*turbopackIgnore: true*/ process.cwd(), "public", chemin.replace(/^\//, ""))).catch(() => null);
}

export async function pdfPr06(d: DonneesPr06): Promise<Buffer> {
  const [logoSociete, logoGroupe] = await Promise.all([image(d.societe.logo), image("/logos/groupe-cosemad-pdf.png")]);
  const ligneAction = (cellules: string[], i: number, vide = false) => (
    <View key={i} style={[s.ligne, { borderTop: B, minHeight: "7.3mm" }]} wrap={false}>
      {COLONNES.map((largeur, c) => (
        <Text key={c} style={[s.cellule, { width: largeur, textAlign: c === 0 ? "left" : "center" }]}>
          {vide ? "" : cellules[c]}
        </Text>
      ))}
      <Text style={[s.cellule, { flex: 1, borderRight: 0, textAlign: "center" }]}>{vide ? "" : cellules[4]}</Text>
    </View>
  );

  const document = (
    <Document title={`Fiche PR06-ENR-01 · ${d.numero}`} author="Groupe COSEMAD" creator="Plateforme réclamations COSEMAD" language="fr">
      <Page size="A4" style={s.page} wrap>
        <View style={s.entete}>
          <View style={s.logo}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF (@react-pdf), pas une balise <img> HTML */}
            {logoSociete && <Image src={{ data: logoSociete, format: "png" }} style={{ maxWidth: "30mm", maxHeight: "14mm", objectFit: "contain" }} />}
          </View>
          <View style={s.titre}>
            <Text style={{ height: "5mm", borderBottom: B, fontSize: 9, paddingTop: "1mm" }}>ENREGISTREMENT</Text>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ fontSize: 12 }}>FICHE TRAITEMENT DES RECLAMATIONS</Text>
            </View>
          </View>
          <View style={s.reference}>
            <Text>Référence :  {REFERENCE_PR06.reference}</Text>
            <Text>Version : {REFERENCE_PR06.version}</Text>
            <Text>
              Date de création : <Text style={{ fontSize: 12 }}>{REFERENCE_PR06.creation}</Text>
            </Text>
          </View>
        </View>

        <View style={[s.encadre, { marginTop: "4.5mm" }]} wrap={false}>
          <Text style={s.titreEncadre}>Réception de la réclamation client</Text>
          <View style={{ paddingTop: "3.5mm", paddingBottom: "3mm", paddingHorizontal: "2mm", gap: "4.4mm" }}>
            <View style={s.ligne}>
              <Text style={{ width: "99mm" }}>Origine de la réclamation : {d.origine}</Text>
              <Text style={{ flex: 1 }}>Filiale Concernée : {d.filiale}</Text>
            </View>
            <View style={s.ligne}>
              <Text style={{ width: "99mm" }}>Nom client : {d.client}</Text>
              <Text style={{ flex: 1 }}>Tél : {d.telephone}</Text>
            </View>
            <View style={s.ligne}>
              <Text style={{ width: "102mm" }}>Date de réception :  {d.date}</Text>
              <Text style={{ flex: 1 }}>Heure de réception : {d.heure}</Text>
            </View>
            <View style={[s.ligne, { flexWrap: "wrap", alignItems: "center" }]}>
              <Text style={{ marginRight: "7mm", marginBottom: "1mm" }}>Mode de transmission :</Text>
              {d.modes.map((m) => (
                <Case key={m.libelle} cochee={m.coche} libelle={m.libelle} />
              ))}
            </View>
          </View>
        </View>

        <View style={s.encadre} wrap={false}>
          <Text style={s.titreEncadre}>Objet de la réclamation</Text>
          <View style={{ paddingTop: "1mm", paddingBottom: "4mm", paddingHorizontal: "2mm" }}>
            <View style={[s.ligne, { flexWrap: "wrap", alignItems: "center" }]}>
              <Text style={{ marginRight: "4mm", marginBottom: "1mm" }}>Type de réclamation :</Text>
              {d.types.map((t) => (
                <Case key={t.libelle} cochee={t.coche} libelle={t.libelle} style={{ marginRight: "6mm" }} />
              ))}
            </View>
            <Text style={{ marginTop: "4.5mm", minHeight: "10mm" }}>Détails : {d.details}</Text>
            <View style={[s.ligne, { alignItems: "center", marginTop: "3mm" }]}>
              <Text style={{ width: "52mm" }}>Problème récurrent</Text>
              <Case cochee={d.recurrent} libelle="Oui" style={{ marginRight: "10mm" }} />
              <Case cochee={!d.recurrent} libelle="Non" />
            </View>
          </View>
        </View>

        <View style={s.encadre}>
          <Text style={s.titreEncadre}>Traitement de la réclamation</Text>
          <Text style={{ paddingVertical: "0.8mm", paddingHorizontal: "2mm", borderBottom: B, fontFamily: "Times-Bold" }}>
            Responsable de traitement : <Text style={{ fontFamily: "Times-Roman" }}>{d.responsable}</Text>
          </Text>
          <View style={[s.ligne, { minHeight: "10mm" }]} wrap={false}>
            {["Action immédiate", "Responsable", "Délai", "Statut"].map((t, c) => (
              <View key={t} style={{ width: COLONNES[c], borderRight: B, justifyContent: "center" }}>
                <Text style={{ textAlign: "center" }}>{t}</Text>
              </View>
            ))}
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={{ textAlign: "center", lineHeight: 1.1 }}>{"Efficace :\nOui /Non"}</Text>
            </View>
          </View>
          {d.actions.map((a, i) => ligneAction([a.libelle, a.responsable, a.delai, a.statut, a.efficace], i))}
          {Array.from({ length: d.lignesVides }, (_, i) => ligneAction([], 100 + i, true))}
        </View>

        <View style={s.encadre} wrap={false}>
          <Text style={s.titreEncadre}>Retour au client</Text>
          <View style={{ paddingTop: "0.5mm", paddingBottom: "3mm", paddingHorizontal: "2mm", gap: "4.2mm", minHeight: "19mm" }}>
            <Text>Date de la réponse au client : {d.reponse.date}</Text>
            <Text>Détail de la réponse : {d.reponse.detail}</Text>
          </View>
          <Text style={[s.titreEncadre, { borderBottom: 0, borderTop: B }]}>Amélioration continue</Text>
          <Text style={{ paddingHorizontal: "2mm", paddingBottom: "2mm", minHeight: "6mm" }}>Causes racine : {d.causes}</Text>
        </View>

        <View style={[s.ligne, { alignItems: "center", paddingTop: "1.8mm", paddingLeft: "17.5mm" }]} wrap={false}>
          <Text style={{ width: "48mm" }}>Réclamation clôturée</Text>
          <Case cochee={!!d.cloture} libelle="Oui" style={{ width: "21mm", marginRight: 0 }} />
          <Case cochee={!d.cloture} libelle="Non" style={{ width: "24mm", marginRight: 0 }} />
          <Text>Date de clôture :{d.cloture ? ` ${d.cloture}` : "… /…… /……"}</Text>
        </View>

        <View style={[s.encadre, { marginTop: "4.5mm" }]} wrap={false}>
          <Text style={{ paddingVertical: "0.4mm", borderBottom: B, textAlign: "center" }}>Nom et Signature</Text>
          <View style={[s.ligne, { borderBottom: B }]}>
            <Text style={{ flex: 1, borderRight: B, textAlign: "center", paddingVertical: "0.4mm" }}>Direction Commerciale</Text>
            <Text style={{ flex: 1, textAlign: "center", paddingVertical: "0.4mm" }}>Service QHSE</Text>
          </View>
          <View style={[s.ligne, { height: "17.5mm" }]}>
            <View style={{ flex: 1, borderRight: B, paddingVertical: "1.5mm", paddingHorizontal: "2.5mm" }}>
              <Signature visa={d.visas.dc} />
            </View>
            <View style={{ flex: 1, paddingVertical: "1.5mm", paddingHorizontal: "2.5mm" }}>
              <Signature visa={d.visas.qhse} />
            </View>
          </View>
        </View>

        <View style={s.pied} fixed>
          <View style={{ flex: 1, borderRight: B, justifyContent: "center", paddingHorizontal: "4mm" }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF (@react-pdf), pas une balise <img> HTML */}
            {logoGroupe && <Image src={{ data: logoGroupe, format: "png" }} style={{ height: "11.5mm", width: "15.5mm", objectFit: "contain" }} />}
          </View>
          <Text style={{ width: "50mm", paddingTop: "5mm", textAlign: "center" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} sur ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(document);
}
