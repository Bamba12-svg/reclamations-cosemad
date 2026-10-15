import { deflateSync } from "node:zlib";

/**
 * Contenu fictif des pièces jointes des données de démonstration (photo-concentrateur.jpg,
 * bon-livraison.pdf…), pour que l'aperçu et le téléchargement fonctionnent sans vrais fichiers.
 * Les images sont servies en PNG quel que soit leur nom.
 */
export function contenuDemo(typeMime: string, nom: string): Uint8Array {
  return typeMime === "application/pdf" ? pdfDemo(nom) : pngDemo();
}

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "");
}

function pdfDemo(nom: string): Uint8Array {
  const flux = `BT /F1 20 Tf 72 760 Td (Document de demonstration) Tj /F1 12 Tf 0 -28 Td (${sansAccents(nom)}) Tj 0 -18 Td (Groupe COSEMAD - Plateforme reclamations) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  pdf += positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

let pngCache: Uint8Array | null = null;

/** Image 480×320 aux couleurs du design system (fond #EAF1FA, cadre #0B4A8B). */
function pngDemo(): Uint8Array {
  if (pngCache) return pngCache;
  const l = 480;
  const h = 320;
  const bord = 6;
  const brut = Buffer.alloc((l * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const ligne = y * (l * 3 + 1);
    brut[ligne] = 0; // pas de filtre
    for (let x = 0; x < l; x++) {
      const cadre = x < bord || y < bord || x >= l - bord || y >= h - bord;
      const [r, g, b] = cadre ? [0x0b, 0x4a, 0x8b] : [0xea, 0xf1, 0xfa];
      brut.set([r, g, b], ligne + 1 + x * 3);
    }
  }
  const morceau = (type: string, donnees: Buffer) => {
    const t = Buffer.from(type, "ascii");
    const taille = Buffer.alloc(4);
    taille.writeUInt32BE(donnees.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, donnees])));
    return Buffer.concat([taille, t, donnees, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(l, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RVB
  pngCache = new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      morceau("IHDR", ihdr),
      morceau("IDAT", deflateSync(brut)),
      morceau("IEND", Buffer.alloc(0)),
    ]),
  );
  return pngCache;
}

function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (const o of octets) {
    c ^= o;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
