import { afterEach, describe, expect, it } from "vitest";
import { fournisseurPour } from "@/server/messagerie/fournisseurs";
import { configurationPourSociete, configurationSmtp } from "@/server/messagerie/smtp";
import { schemaMessagerie } from "@/lib/validation/backoffice";
import { chiffrer, dechiffrer } from "@/server/messagerie/chiffrement";

describe("fournisseur e-mail SMTP", () => {
  const sauvegarde = { ...process.env };
  afterEach(() => {
    process.env = { ...sauvegarde };
  });
  const sansSmtp = () => Object.fromEntries(Object.entries(sauvegarde).filter(([k]) => !k.startsWith("SMTP_") && !k.startsWith("EMAIL_"))) as NodeJS.ProcessEnv;

  it("sans boîte (ni Paramètres ni .env), l'envoi échoue avec un message clair", async () => {
    process.env = sansSmtp();
    expect(configurationSmtp()).toBeNull();
    await expect(fournisseurPour("EMAIL")!.envoyer({ destinataire: "a@b.sn", objet: "x", corps: "y", societeCode: "CM" })).rejects.toThrow(/Paramètres → Messagerie/);
  });

  it("boîte commune (465 = SSL, sinon STARTTLS) ; le SMS reste à brancher", () => {
    process.env = { ...sansSmtp(), SMTP_HOTE: "mail.infomaniak.com", SMTP_PORT: "465", SMTP_UTILISATEUR: "contact@cosemad.sn", SMTP_MOT_DE_PASSE: "x", EMAIL_EXPEDITEUR: "Groupe COSEMAD <contact@cosemad.sn>" };
    expect(configurationSmtp()).toMatchObject({ cle: "commun", hote: "mail.infomaniak.com", port: 465, securise: true, expediteur: "Groupe COSEMAD <contact@cosemad.sn>" });
    expect(configurationSmtp("FLS")).toMatchObject({ cle: "commun", utilisateur: "contact@cosemad.sn" });
    expect(fournisseurPour("EMAIL")?.nom).toBe("smtp");
    expect(fournisseurPour("SMS")).toBeUndefined();
    process.env.SMTP_PORT = "587";
    expect(configurationSmtp()).toMatchObject({ port: 587, securise: false });
  });

  it("une boîte par filiale : son compte, son mot de passe et son expéditeur, jamais ceux de la boîte commune", () => {
    process.env = {
      ...sansSmtp(),
      SMTP_HOTE: "mail.infomaniak.com",
      SMTP_PORT: "465",
      SMTP_UTILISATEUR: "contact@cosemad.sn",
      SMTP_MOT_DE_PASSE: "commun",
      EMAIL_EXPEDITEUR: "Groupe COSEMAD <contact@cosemad.sn>",
      SMTP_UTILISATEUR_CM: "awa.ba@carrefourmedical.sn",
      SMTP_MOT_DE_PASSE_CM: "cm",
    };
    expect(configurationSmtp("cm")).toEqual({
      cle: "CM",
      hote: "mail.infomaniak.com",
      port: 465,
      securise: true,
      utilisateur: "awa.ba@carrefourmedical.sn",
      motDePasse: "cm",
      expediteur: "awa.ba@carrefourmedical.sn",
      reponse: undefined,
    });
    process.env.EMAIL_EXPEDITEUR_CM = "Carrefour Médical <awa.ba@carrefourmedical.sn>";
    expect(configurationSmtp("CM")?.expediteur).toBe("Carrefour Médical <awa.ba@carrefourmedical.sn>");
    // Seule une filiale : actif aussi sans boîte commune.
    process.env = { ...sansSmtp(), SMTP_HOTE_SON: "mail.infomaniak.com", SMTP_UTILISATEUR_SON: "x@sonerco.sn", SMTP_MOT_DE_PASSE_SON: "s" };
    expect(fournisseurPour("EMAIL")?.nom).toBe("smtp");
    expect(configurationSmtp("SON")).toMatchObject({ cle: "SON", hote: "mail.infomaniak.com", utilisateur: "x@sonerco.sn" });
    expect(configurationSmtp("FLS")).toBeNull();
  });

  it("Paramètres → Messagerie : saisie contrôlée (adresse, serveur public, ports chiffrés)", () => {
    const ok = schemaMessagerie.parse({ emailEnvoi: " Awa.Ba@CarrefourMedical.sn ", motDePasse: "x", nomExpediteur: "Carrefour Médical", hote: "Mail.Infomaniak.com", port: "465", emailsReclamations: ["", "Qualite@CarrefourMedical.sn"] });
    expect(ok).toEqual({ emailEnvoi: "awa.ba@carrefourmedical.sn", motDePasse: "x", nomExpediteur: "Carrefour Médical", hote: "mail.infomaniak.com", port: 465, emailsReclamations: ["qualite@carrefourmedical.sn"] });
    expect(schemaMessagerie.parse({ emailEnvoi: "" }).emailEnvoi).toBeNull();
    for (const hote of ["localhost", "127.0.0.1", "10.0.0.5", "serveur.local", "mail"]) expect(schemaMessagerie.safeParse({ emailEnvoi: "a@b.sn", hote }).success).toBe(false);
    expect(schemaMessagerie.safeParse({ emailEnvoi: "a@b.sn", port: 25 }).success).toBe(false);
    expect(schemaMessagerie.safeParse({ emailEnvoi: "a@b.sn", nomExpediteur: 'X" <pirate@x.sn>' }).success).toBe(false);
    expect(schemaMessagerie.safeParse({ emailEnvoi: "pas-une-adresse" }).success).toBe(false);
  });

  it("boîte saisie dans les Paramètres : mot de passe chiffré, prioritaire sur le .env", () => {
    process.env = { ...sansSmtp(), AUTH_SECRET: "s".repeat(40), SMTP_HOTE: "mail.infomaniak.com", SMTP_UTILISATEUR: "contact@cosemad.sn", SMTP_MOT_DE_PASSE: "commun" };
    const chiffre = chiffrer("MotDePasse-CM-2026");
    expect(chiffre).not.toContain("MotDePasse");
    expect(dechiffrer(chiffre)).toBe("MotDePasse-CM-2026");
    const p = { smtpHote: "mail.infomaniak.com", smtpPort: 465, smtpUtilisateur: "awa.ba@carrefourmedical.sn", smtpMotDePasse: chiffre, emailNomExpediteur: "Carrefour Médical – Réclamations", emailsReclamations: ["qualite@carrefourmedical.sn", "chef@carrefourmedical.sn"] };
    expect(configurationPourSociete("CM", p)).toMatchObject({ utilisateur: "awa.ba@carrefourmedical.sn", motDePasse: "MotDePasse-CM-2026", expediteur: '"Carrefour Médical – Réclamations" <awa.ba@carrefourmedical.sn>', reponse: "qualite@carrefourmedical.sn, chef@carrefourmedical.sn" });
    expect(configurationPourSociete("CM", null)?.utilisateur).toBe("contact@cosemad.sn"); // rien dans les Paramètres : .env
    // Valeur altérée ou clé changée : illisible, jamais un mot de passe faux envoyé au serveur.
    expect(dechiffrer(chiffre.slice(0, -4) + "AAAA")).toBeNull();
    process.env.AUTH_SECRET = "t".repeat(40);
    expect(dechiffrer(chiffre)).toBeNull();
    expect(configurationPourSociete("CM", p)?.utilisateur).toBe("contact@cosemad.sn");
  });
});
