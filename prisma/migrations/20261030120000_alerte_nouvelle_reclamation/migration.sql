-- Alerte interne à la filiale (nouvelle réclamation) : distinguée des messages envoyés au client.
ALTER TABLE "Message" ADD COLUMN "interne" BOOLEAN NOT NULL DEFAULT false;
