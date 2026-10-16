/**
 * Vérifie la configuration SMTP du fichier .env et envoie un e-mail d'essai :
 *   npm run email:test -- prenom.nom@exemple.sn
 */
import "dotenv/config";
import { configurationSmtp, fournisseurSmtp, verifierSmtp } from "../src/server/messagerie/smtp";

async function main() {
  const destinataire = process.argv[2];
  if (!destinataire || !destinataire.includes("@")) throw new Error("Indiquez l'adresse de test : npm run email:test -- vous@exemple.sn");
  const c = configurationSmtp();
  if (!c) throw new Error("SMTP_HOTE manquant dans .env (voir docs/MISE-EN-LIGNE.md, § 5).");
  console.log(`Serveur ${c.hote}:${c.port} (${c.securise ? "SSL" : "STARTTLS"}), compte ${c.utilisateur || "sans authentification"}, expéditeur ${c.expediteur}`);
  await verifierSmtp();
  console.log("Connexion et mot de passe acceptés par le serveur.");
  const r = await fournisseurSmtp()!.envoyer({
    destinataire,
    objet: "Test — plateforme réclamations COSEMAD",
    corps: "Bonjour,\n\nCet e-mail confirme que la plateforme de réclamations peut envoyer des messages.\n\nGroupe COSEMAD",
  });
  console.log(`E-mail envoyé à ${destinataire} (identifiant ${r.idExterne ?? "?"}). Vérifiez aussi le dossier « Indésirables ».`);
}

main().catch((e: unknown) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
