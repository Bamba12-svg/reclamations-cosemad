import { describe, expect, it } from "vitest";
import { formatDate, formatDateHeure } from "@/lib/dates";
import { analyserSms, remplirModele } from "@/lib/modeles";
import { formaterSaisie, formaterTelephone } from "@/lib/telephone";
import { analyserNumero, formaterNumero } from "@/server/domaine/numerotation";
import { controlerFichier, nettoyerNom } from "@/server/stockage/controle";
import { contenuDemo } from "@/server/stockage/demo";

describe("numéros de réclamation", () => {
  it("format PREFIXE-AAAA-NNNN", () => {
    expect(formaterNumero("SON", 2026, 27)).toBe("SON-2026-0027");
    expect(formaterNumero("CM", 2027, 12345)).toBe("CM-2027-12345");
    expect(analyserNumero("fls-2026-0032")).toEqual({ prefixe: "FLS", annee: 2026, sequence: 32 });
    expect(analyserNumero("FLS-26-32")).toBeNull();
  });
});

describe("modèles de messages", () => {
  const sms = "Carrefour Médical : votre réclamation {numero} est bien reçue. Réponse sous {delai} jours ouvrés. Suivi : cosemad.sn/suivi";

  it("remplit les variables et laisse les inconnues telles quelles", () => {
    expect(remplirModele("{nom} · {numero} · {date} · {delai} · {autre}", { numero: "CM-2026-0042", nom: "Aminata Diop", date: "28/09/2026", delai: 5 })).toBe(
      "Aminata Diop · CM-2026-0042 · 28/09/2026 · 5 · {autre}",
    );
  });

  it("détecte qu'un « ç » fait passer le SMS en Unicode (70 caractères par SMS)", () => {
    const texte = remplirModele(sms, { numero: "CM-2026-0042", nom: "", date: "", delai: 5 });
    const a = analyserSms(texte);
    expect(a.encodage).toBe("Unicode");
    expect(a.horsAlphabet).toEqual(["ç"]);
    expect(a.nombreSms).toBe(2);
    expect(analyserSms(texte.replace("reçue", "recue"))).toMatchObject({ encodage: "GSM-7", nombreSms: 1 });
  });
});

describe("formats", () => {
  it("dates et heures de Dakar", () => {
    expect(formatDate("2026-10-02")).toBe("02/10/2026");
    expect(formatDateHeure(new Date("2026-09-22T08:31:00Z"))).toBe("22/09/2026 à 08:31");
  });

  it("téléphone", () => {
    expect(formaterSaisie("774123508")).toBe("77 412 35 08");
    expect(formaterTelephone("+221774123508")).toBe("+221 77 412 35 08");
  });
});

describe("contrôle des fichiers téléversés", () => {
  const png = contenuDemo("image/png", "x.png");
  const pdf = contenuDemo("application/pdf", "bon-livraison.pdf");

  it("reconnaît le type par la signature, pas par le nom", () => {
    expect(controlerFichier("photo.jpg", png)).toMatchObject({ ok: true, type: { mime: "image/png" }, nom: "photo.png" });
    expect(controlerFichier("facture.pdf", pdf)).toMatchObject({ ok: true, type: { mime: "application/pdf" } });
  });

  it("refuse un faux PDF, un fichier vide ou trop gros", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(controlerFichier("facture.pdf", html)).toEqual({ ok: false, erreur: "Seuls les photos (JPG, PNG) et les PDF sont acceptés." });
    expect(controlerFichier("vide.pdf", new Uint8Array())).toMatchObject({ ok: false });
    const gros = new Uint8Array(10 * 1024 * 1024 + 1);
    gros.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(controlerFichier("gros.pdf", gros)).toEqual({ ok: false, erreur: "« gros.pdf » dépasse 10 Mo." });
  });

  it("nettoie les noms (chemins, caractères spéciaux)", () => {
    expect(nettoyerNom("..\\..\\windows\\system32\\evil<>.exe", "pdf")).toBe("evil.pdf");
    expect(nettoyerNom("Bon de livraison 22-09.JPG", "jpg")).toBe("Bon de livraison 22-09.jpg");
  });
});
