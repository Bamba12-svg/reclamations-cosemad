-- Plusieurs adresses par filiale pour les réclamations (alerte de chaque nouvelle réclamation, réponses des clients).
ALTER TABLE "ParametresSociete" ADD COLUMN "emailsReclamations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "ParametresSociete" SET "emailsReclamations" = ARRAY["emailReponse"] WHERE "emailReponse" IS NOT NULL AND "emailReponse" <> '';
ALTER TABLE "ParametresSociete" DROP COLUMN "emailReponse";
