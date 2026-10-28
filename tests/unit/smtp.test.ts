import { afterEach, describe, expect, it } from "vitest";
import { fournisseurPour } from "@/server/messagerie/fournisseurs";
import { configurationSmtp } from "@/server/messagerie/smtp";
import { schemaModeles } from "@/lib/validation/backoffice";

describe("fournisseur e-mail SMTP", () => {
  const sauvegarde = { ...process.env };
  afterEach(() => {
    process.env = { ...sauvegarde };
  });
  const sansSmtp = () => Object.fromEntries(Object.entries(sauvegarde).filter(([k]) => !k.startsWith("SMTP_") && !k.startsWith("EMAIL_"))) as NodeJS.ProcessEnv;

  it("inactif tant qu'aucun serveur SMTP n'est renseigné", () => {
    process.env = sansSmtp();
    expect(configurationSmtp()).toBeNull();
    expect(fournisseurPour("EMAIL")).toBeUndefined();
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

  it("adresse de réponse de la filiale : facultative, contrôlée", () => {
    const base = { modeleSms: "Réclamation {numero} reçue.", modeleEmailObjet: "Réclamation {numero}", modeleEmail: "Bonjour {nom}, réclamation {numero} reçue." };
    expect(schemaModeles.parse({ ...base, emailReponse: "" }).emailReponse).toBeNull();
    expect(schemaModeles.parse({ ...base, emailReponse: " Awa.Ba@CarrefourMedical.sn " }).emailReponse).toBe("awa.ba@carrefourmedical.sn");
    expect(schemaModeles.safeParse({ ...base, emailReponse: "pas-une-adresse" }).success).toBe(false);
  });
});
