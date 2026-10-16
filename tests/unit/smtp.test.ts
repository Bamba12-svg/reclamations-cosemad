import { afterEach, describe, expect, it } from "vitest";
import { fournisseurPour } from "@/server/messagerie/fournisseurs";
import { configurationSmtp } from "@/server/messagerie/smtp";

describe("fournisseur e-mail SMTP", () => {
  const sauvegarde = { ...process.env };
  afterEach(() => {
    process.env = { ...sauvegarde };
  });

  it("inactif tant que SMTP_HOTE n'est pas renseigné", () => {
    delete process.env.SMTP_HOTE;
    expect(configurationSmtp()).toBeNull();
    expect(fournisseurPour("EMAIL")).toBeUndefined();
  });

  it("lit la configuration du .env (465 = SSL, sinon STARTTLS) ; le SMS reste à brancher", () => {
    process.env = { ...sauvegarde, SMTP_HOTE: "mail.infomaniak.com", SMTP_PORT: "465", SMTP_UTILISATEUR: "reclamations@cosemad.sn", SMTP_MOT_DE_PASSE: "x", EMAIL_EXPEDITEUR: "Groupe COSEMAD – Réclamations <reclamations@cosemad.sn>" };
    expect(configurationSmtp()).toMatchObject({ hote: "mail.infomaniak.com", port: 465, securise: true, expediteur: "Groupe COSEMAD – Réclamations <reclamations@cosemad.sn>" });
    expect(fournisseurPour("EMAIL")?.nom).toBe("smtp");
    expect(fournisseurPour("SMS")).toBeUndefined();
    process.env.SMTP_PORT = "587";
    expect(configurationSmtp()).toMatchObject({ port: 587, securise: false });
  });
});
