-- Adresse qui reçoit les réponses des clients, propre à chaque filiale (Paramètres → Modèles SMS et e-mail).
ALTER TABLE "ParametresSociete" ADD COLUMN "emailReponse" VARCHAR(254);
