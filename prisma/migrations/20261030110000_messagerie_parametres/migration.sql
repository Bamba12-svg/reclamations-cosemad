-- Boîte d'envoi des e-mails de chaque filiale, saisie par le Service QHSE (Paramètres → Messagerie).
-- Le mot de passe est stocké chiffré (AES-256-GCM, clé dérivée de AUTH_SECRET).
ALTER TABLE "ParametresSociete" ADD COLUMN "smtpHote" VARCHAR(255);
ALTER TABLE "ParametresSociete" ADD COLUMN "smtpPort" INTEGER;
ALTER TABLE "ParametresSociete" ADD COLUMN "smtpUtilisateur" VARCHAR(254);
ALTER TABLE "ParametresSociete" ADD COLUMN "smtpMotDePasse" TEXT;
ALTER TABLE "ParametresSociete" ADD COLUMN "emailNomExpediteur" VARCHAR(120);
