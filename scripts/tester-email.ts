/**
 * Vérifie la configuration SMTP du fichier .env et envoie un e-mail d'essai :
 *   npm run email:test -- prenom.nom@exemple.sn        (boîte commune)
 *   npm run email:test -- prenom.nom@exemple.sn CM     (boîte de Carrefour Médical ; SON, FLS)
 */
import "dotenv/config";
import { configurationSmtp, fournisseurSmtp, verifierSmtp } from "../src/server/messagerie/smtp";

async function main() {
  const destinataire = process.argv[2];
  const code = process.argv[3]?.toUpperCase();
  if (!destinataire || !destinataire.includes("@")) throw new Error("Indiquez l'adresse de test : npm run email:test -- vous@exemple.sn [CM|SON|FLS]");
  const c = configurationSmtp(code);
  if (!c) throw new Error("SMTP_HOTE manquant dans .env (voir docs/MISE-EN-LIGNE.md, § 5).");
  console.log(
    `Boîte ${c.cle === "commun" ? "commune" : `de la filiale ${c.cle}`} : serveur ${c.hote}:${c.port} (${c.securise ? "SSL" : "STARTTLS"}), compte ${c.utilisateur || "sans authentification"}, expéditeur ${c.expediteur || "(aucun)"}`,
  );
  if (code && c.cle === "commun") console.log(`Attention : aucun compte SMTP_UTILISATEUR_${code} dans .env, la boîte commune sera utilisée pour ${code}.`);
  await verifierSmtp(code);
  console.log("Connexion et mot de passe acceptés par le serveur.");
  const r = await fournisseurSmtp()!.envoyer({
    destinataire,
    objet: "Test — plateforme réclamations",
    corps: "Bonjour,\n\nCet e-mail confirme que la plateforme de réclamations peut envoyer des messages depuis cette boîte.\n\nGroupe COSEMAD",
    societeCode: code,
  });
  console.log(`E-mail envoyé à ${destinataire} (identifiant ${r.idExterne ?? "?"}). Vérifiez aussi le dossier « Indésirables ».`);
}

main().catch((e: unknown) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
