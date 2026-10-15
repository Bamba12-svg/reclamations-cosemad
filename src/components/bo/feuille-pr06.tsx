import type { CSSProperties, ReactNode } from "react";
import { REFERENCE_PR06, type DonneesPr06, type VisaPr06 } from "@/server/fiche/pr06";

/**
 * Aperçu à l'écran de la fiche PR06-ENR-01 : reproduction du formulaire papier (A4, Times, cadres
 * noirs), dimensions en millimètres reprises de la maquette. Le PDF téléchargé suit la même grille.
 */

const NOIR = "1px solid #000000";
const ENCADRE: CSSProperties = { border: NOIR, marginTop: "4.2mm" };
const TITRE: CSSProperties = { padding: "0.4mm 2mm", borderBottom: NOIR, textAlign: "center", fontWeight: 700 };
const ACTIONS: CSSProperties = { display: "grid", gridTemplateColumns: "73mm 45mm 26mm 26mm minmax(0,1fr)" };
const CELLULE: CSSProperties = { padding: "0.8mm 1.5mm", borderRight: NOIR, overflowWrap: "anywhere" };

function Case({ cochee, children, ecart = "2.5mm", style }: { cochee: boolean; children: ReactNode; ecart?: string; style?: CSSProperties }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ecart, ...style }}>
      <span
        aria-hidden="true"
        style={{
          width: "3.6mm",
          height: "3.6mm",
          flex: "none",
          border: NOIR,
          display: "inline-grid",
          placeItems: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: "0.75rem",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {cochee ? "X" : ""}
      </span>
      <span>
        {children}
        <span className="sr-only">{cochee ? " (coché)" : " (non coché)"}</span>
      </span>
    </span>
  );
}

function Signature({ visa }: { visa: VisaPr06 | null }) {
  if (!visa) return null;
  return (
    <>
      <span>{visa.nom}</span>
      <span>{visa.quand}</span>
      <span
        style={{
          alignSelf: "flex-start",
          padding: "0.3mm 1.5mm",
          border: "1px solid #0B4A8B",
          color: "#0B4A8B",
          fontFamily: "Arial, sans-serif",
          fontSize: "0.5625rem",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        VISÉ ÉLECTRONIQUEMENT
      </span>
    </>
  );
}

export function FeuillePr06({ d }: { d: DonneesPr06 }) {
  return (
    <article
      data-print-page=""
      aria-label={`Fiche PR06-ENR-01 de la réclamation ${d.numero}`}
      style={{
        width: "210mm",
        minHeight: "297mm",
        flex: "none",
        padding: "8mm 7.5mm 10mm",
        background: "#FFFFFF",
        boxShadow: "0 4px 24px rgba(16,24,40,0.12)",
        color: "#000000",
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: "1rem",
        lineHeight: 1.25,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "37mm 102mm minmax(0,1fr)", border: NOIR, height: "17.5mm", margin: "0 0.8mm" }}>
        <div style={{ display: "grid", placeItems: "center", borderRight: NOIR, padding: "1mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- image fixe imprimée telle quelle, sans optimisation */}
          <img src={d.societe.logo} alt={d.societe.nom} style={{ maxWidth: "30mm", maxHeight: "14mm", objectFit: "contain" }} />
        </div>
        <div style={{ display: "grid", gridTemplateRows: "5mm 1fr", borderRight: NOIR, fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700, textAlign: "center" }}>
          <div style={{ display: "grid", placeItems: "center", borderBottom: NOIR, fontSize: "0.75rem" }}>ENREGISTREMENT</div>
          <h1 style={{ display: "grid", placeItems: "center", fontSize: "1rem", margin: 0 }}>FICHE TRAITEMENT DES RECLAMATIONS</h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 2mm", fontSize: "0.8125rem", lineHeight: 1.3 }}>
          <span>Référence :&nbsp; {REFERENCE_PR06.reference}</span>
          <span>Version : {REFERENCE_PR06.version}</span>
          <span>
            Date de création : <span style={{ fontSize: "1rem" }}>{REFERENCE_PR06.creation}</span>
          </span>
        </div>
      </div>

      <section style={{ ...ENCADRE, marginTop: "4.5mm" }}>
        <h2 style={{ ...TITRE, margin: 0, fontSize: "1rem" }}>Réception de la réclamation client</h2>
        <div style={{ padding: "3.5mm 2mm 3mm", display: "flex", flexDirection: "column", gap: "4.4mm" }}>
          <div style={{ display: "grid", gridTemplateColumns: "99mm 1fr" }}>
            <span>Origine de la réclamation : {d.origine}</span>
            <span>Filiale Concernée : {d.filiale}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "99mm 1fr" }}>
            <span>Nom client : {d.client}</span>
            <span>Tél : {d.telephone}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "102mm 1fr" }}>
            <span>Date de réception :&nbsp; {d.date}</span>
            <span>Heure de réception : {d.heure}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5mm 7mm", flexWrap: "wrap" }}>
            <span>Mode de transmission :</span>
            {d.modes.map((m) => (
              <Case key={m.libelle} cochee={m.coche}>
                {m.libelle}
              </Case>
            ))}
          </div>
        </div>
      </section>

      <section style={ENCADRE}>
        <h2 style={{ ...TITRE, margin: 0, fontSize: "1rem" }}>Objet de la réclamation</h2>
        <div style={{ padding: "1mm 2mm 4mm", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5mm 4mm", flexWrap: "wrap" }}>
            <span>Type de réclamation :</span>
            {d.types.map((t) => (
              <Case key={t.libelle} cochee={t.coche} style={{ marginRight: "2mm" }}>
                {t.libelle}
              </Case>
            ))}
          </div>
          <div style={{ marginTop: "4.5mm", minHeight: "10mm", overflowWrap: "anywhere" }}>Détails : {d.details}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10mm", marginTop: "3mm" }}>
            <span style={{ width: "42mm" }}>Problème récurrent</span>
            <Case cochee={d.recurrent} ecart="4mm">
              Oui
            </Case>
            <Case cochee={!d.recurrent} ecart="4mm">
              Non
            </Case>
          </div>
        </div>
      </section>

      <section style={ENCADRE}>
        <h2 style={{ ...TITRE, margin: 0, fontSize: "1rem" }}>Traitement de la réclamation</h2>
        <div style={{ padding: "0.8mm 2mm", borderBottom: NOIR, fontWeight: 700 }}>
          Responsable de traitement : <span style={{ fontWeight: 400 }}>{d.responsable}</span>
        </div>
        <div role="table" aria-label="Actions">
          <div role="row" style={{ ...ACTIONS, textAlign: "center" }}>
            {["Action immédiate", "Responsable", "Délai", "Statut"].map((t, i) => (
              <div key={t} role="columnheader" style={{ display: "grid", placeItems: "center", minHeight: i === 0 ? "10mm" : undefined, borderRight: NOIR }}>
                {t}
              </div>
            ))}
            <div role="columnheader" style={{ display: "grid", placeItems: "center", lineHeight: 1.1 }}>
              <span>
                Efficace :<br />
                Oui /Non
              </span>
            </div>
          </div>
          {d.actions.map((a, i) => (
            <div key={i} role="row" style={{ ...ACTIONS, borderTop: NOIR, minHeight: "7.3mm", fontSize: "0.875rem" }}>
              <div role="cell" style={CELLULE}>
                {a.libelle}
              </div>
              <div role="cell" style={{ ...CELLULE, textAlign: "center" }}>
                {a.responsable}
              </div>
              <div role="cell" style={{ ...CELLULE, textAlign: "center" }}>
                {a.delai}
              </div>
              <div role="cell" style={{ ...CELLULE, textAlign: "center" }}>
                {a.statut}
              </div>
              <div role="cell" style={{ ...CELLULE, borderRight: 0, textAlign: "center" }}>
                {a.efficace}
              </div>
            </div>
          ))}
          {Array.from({ length: d.lignesVides }, (_, i) => (
            <div key={`vide-${i}`} aria-hidden="true" style={{ ...ACTIONS, borderTop: NOIR, height: "7.3mm" }}>
              <div style={{ borderRight: NOIR }} />
              <div style={{ borderRight: NOIR }} />
              <div style={{ borderRight: NOIR }} />
              <div style={{ borderRight: NOIR }} />
              <div />
            </div>
          ))}
        </div>
      </section>

      <section style={ENCADRE}>
        <h2 style={{ ...TITRE, margin: 0, fontSize: "1rem" }}>Retour au client</h2>
        <div style={{ padding: "0.5mm 2mm 3mm", display: "flex", flexDirection: "column", gap: "4.2mm", minHeight: "19mm" }}>
          <span>Date de la réponse au client : {d.reponse.date}</span>
          <span style={{ overflowWrap: "anywhere" }}>Détail de la réponse : {d.reponse.detail}</span>
        </div>
        <h2 style={{ ...TITRE, margin: 0, fontSize: "1rem", borderBottom: 0, borderTop: NOIR }}>Amélioration continue</h2>
        <div style={{ padding: "0 2mm 2mm", minHeight: "6mm", overflowWrap: "anywhere" }}>Causes racine : {d.causes}</div>
      </section>
      <div style={{ display: "flex", alignItems: "center", padding: "1.8mm 0 0 17.5mm" }}>
        <span style={{ width: "48mm" }}>Réclamation clôturée</span>
        <Case cochee={!!d.cloture} ecart="1.2mm" style={{ width: "21mm" }}>
          Oui
        </Case>
        <Case cochee={!d.cloture} style={{ width: "24mm" }}>
          Non
        </Case>
        <span>Date de clôture :{d.cloture ? ` ${d.cloture}` : "… /…… /……"}</span>
      </div>

      <section style={{ border: NOIR, marginTop: "4.5mm" }}>
        <div style={{ padding: "0.4mm 2mm", borderBottom: NOIR, textAlign: "center" }}>Nom et Signature</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", textAlign: "center", borderBottom: NOIR }}>
          <div style={{ padding: "0.4mm 2mm", borderRight: NOIR }}>Direction Commerciale</div>
          <div style={{ padding: "0.4mm 2mm" }}>Service QHSE</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "17.5mm" }}>
          <div style={{ borderRight: NOIR, padding: "1.5mm 2.5mm", display: "flex", flexDirection: "column", gap: "0.6mm", fontSize: "0.875rem" }}>
            <Signature visa={d.visas.dc} />
          </div>
          <div style={{ padding: "1.5mm 2.5mm", display: "flex", flexDirection: "column", gap: "0.6mm", fontSize: "0.875rem" }}>
            <Signature visa={d.visas.qhse} />
          </div>
        </div>
      </section>

      {/* Le pied de page descend en bas de la feuille ; marge réduite pour que tout tienne sur une page A4. */}
      <div style={{ flex: 1 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 50mm", border: NOIR, height: "15mm", marginTop: "3mm" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 4mm", borderRight: NOIR }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo imprimé */}
          <img src="/logos/groupe-cosemad-pdf.png" alt="Groupe COSEMAD" style={{ height: "11.5mm", width: "auto" }} />
        </div>
        <div style={{ display: "grid", placeItems: "center", fontFamily: "'Comic Sans MS', 'Comic Sans', cursive", fontSize: "1rem" }}>Page 1 sur 1</div>
      </div>
    </article>
  );
}
