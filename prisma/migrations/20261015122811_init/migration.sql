-- CreateEnum
CREATE TYPE "Role" AS ENUM ('QHSE', 'DIRECTION_COMMERCIALE', 'AGENT_ACCUEIL', 'RESPONSABLE_TRAITEMENT', 'DIRECTION_GENERALE');

-- CreateEnum
CREATE TYPE "ModeTransmission" AS ENUM ('VERBAL', 'MAIL', 'TELEPHONE', 'COURRIER', 'PLATEFORME_WEB', 'AUTRES');

-- CreateEnum
CREATE TYPE "Profil" AS ENUM ('PARTICULIER', 'SOCIETE');

-- CreateEnum
CREATE TYPE "TypeReclamation" AS ENUM ('PRODUIT', 'SERVICE', 'AUTRE');

-- CreateEnum
CREATE TYPE "SousTypeProduit" AS ENUM ('QUALITE', 'PRIX', 'FONCTIONNALITE');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "StatutAction" AS ENUM ('A_FAIRE', 'EN_COURS', 'REALISEE');

-- CreateEnum
CREATE TYPE "TypeVisa" AS ENUM ('DIRECTION_COMMERCIALE', 'QHSE');

-- CreateEnum
CREATE TYPE "SourcePiece" AS ENUM ('CLIENT', 'INTERNE');

-- CreateEnum
CREATE TYPE "StatutMessage" AS ENUM ('DEMO', 'EN_ATTENTE', 'ENVOYE', 'ECHEC');

-- CreateTable
CREATE TABLE "Societe" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "accroche" TEXT NOT NULL,
    "telStandard" TEXT NOT NULL,
    "mailDomaine" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "Societe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametresSociete" (
    "societeId" TEXT NOT NULL,
    "delaiQualificationH" INTEGER NOT NULL DEFAULT 24,
    "delaiReponseJO" INTEGER NOT NULL DEFAULT 5,
    "delaiClotureJ" INTEGER NOT NULL DEFAULT 15,
    "modeleSms" VARCHAR(160) NOT NULL,
    "modeleEmailObjet" VARCHAR(150) NOT NULL,
    "modeleEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ParametresSociete_pkey" PRIMARY KEY ("societeId")
);

-- CreateTable
CREATE TABLE "CompteurNumero" (
    "societeId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "dernier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompteurNumero_pkey" PRIMARY KEY ("societeId","annee")
);

-- CreateTable
CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nomCourt" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icone" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "responsableId" TEXT,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembreEquipe" (
    "equipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MembreEquipe_pkey" PRIMARY KEY ("equipeId","userId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "fonction" TEXT,
    "role" "Role" NOT NULL,
    "motDePasseHash" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "toutesSocietes" BOOLEAN NOT NULL DEFAULT false,
    "derniereConnexion" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccesSociete" (
    "userId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,

    CONSTRAINT "AccesSociete_pkey" PRIMARY KEY ("userId","societeId")
);

-- CreateTable
CREATE TABLE "Reclamation" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "activiteId" TEXT NOT NULL,
    "recueLe" TIMESTAMPTZ(3) NOT NULL,
    "mode" "ModeTransmission" NOT NULL,
    "origine" TEXT NOT NULL,
    "saisieParId" TEXT,
    "profil" "Profil" NOT NULL,
    "clientNom" VARCHAR(120) NOT NULL,
    "secteur" VARCHAR(80),
    "contactNom" VARCHAR(120),
    "contactFonction" VARCHAR(120),
    "telephone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(254),
    "canauxReponse" "Canal"[],
    "consentementLe" TIMESTAMPTZ(3),
    "type" "TypeReclamation" NOT NULL,
    "sousType" "SousTypeProduit",
    "description" VARCHAR(1000) NOT NULL,
    "premiereFois" BOOLEAN,
    "recurrent" BOOLEAN NOT NULL DEFAULT false,
    "responsableId" TEXT,
    "affecteeLe" TIMESTAMPTZ(3),
    "reponse" VARCHAR(600),
    "reponseLe" TIMESTAMPTZ(3),
    "reponseCanaux" "Canal"[],
    "reponseParId" TEXT,
    "causes" TEXT,
    "observations" TEXT,
    "clotureLe" TIMESTAMPTZ(3),
    "clotureParId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "libelle" VARCHAR(300) NOT NULL,
    "responsableId" TEXT NOT NULL,
    "echeance" DATE NOT NULL,
    "statut" "StatutAction" NOT NULL DEFAULT 'A_FAIRE',
    "critere" VARCHAR(300) NOT NULL,
    "efficace" BOOLEAN,
    "realiseeLe" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visa" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "type" "TypeVisa" NOT NULL,
    "userId" TEXT NOT NULL,
    "viseLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PieceJointe" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "source" "SourcePiece" NOT NULL,
    "nomOriginal" VARCHAR(200) NOT NULL,
    "typeMime" VARCHAR(80) NOT NULL,
    "taille" INTEGER NOT NULL,
    "cleStockage" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "deposeeParId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceJointe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commentaire" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "texte" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL,
    "reclamationId" TEXT NOT NULL,
    "survenuLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "libelle" TEXT NOT NULL,
    "acteurId" TEXT,
    "acteurLibelle" TEXT,

    CONSTRAINT "Evenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "reclamationId" TEXT,
    "canal" "Canal" NOT NULL,
    "destinataire" TEXT NOT NULL,
    "objet" TEXT,
    "corps" TEXT NOT NULL,
    "statut" "StatutMessage" NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "idExterne" TEXT,
    "erreur" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "envoyeLe" TIMESTAMPTZ(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" BIGSERIAL NOT NULL,
    "survenuLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "societeId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourFerie" (
    "date" DATE NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "JourFerie_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "_Similaires" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Similaires_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Societe_code_key" ON "Societe"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Societe_slug_key" ON "Societe"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Activite_societeId_code_key" ON "Activite"("societeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Reclamation_numero_key" ON "Reclamation"("numero");

-- CreateIndex
CREATE INDEX "Reclamation_societeId_recueLe_idx" ON "Reclamation"("societeId", "recueLe");

-- CreateIndex
CREATE INDEX "Reclamation_societeId_activiteId_idx" ON "Reclamation"("societeId", "activiteId");

-- CreateIndex
CREATE INDEX "Reclamation_responsableId_idx" ON "Reclamation"("responsableId");

-- CreateIndex
CREATE INDEX "Reclamation_telephone_idx" ON "Reclamation"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "Reclamation_societeId_annee_sequence_key" ON "Reclamation"("societeId", "annee", "sequence");

-- CreateIndex
CREATE INDEX "Action_reclamationId_idx" ON "Action"("reclamationId");

-- CreateIndex
CREATE INDEX "Action_responsableId_statut_echeance_idx" ON "Action"("responsableId", "statut", "echeance");

-- CreateIndex
CREATE UNIQUE INDEX "Visa_reclamationId_type_key" ON "Visa"("reclamationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PieceJointe_cleStockage_key" ON "PieceJointe"("cleStockage");

-- CreateIndex
CREATE INDEX "PieceJointe_reclamationId_idx" ON "PieceJointe"("reclamationId");

-- CreateIndex
CREATE INDEX "Commentaire_reclamationId_idx" ON "Commentaire"("reclamationId");

-- CreateIndex
CREATE INDEX "Evenement_reclamationId_survenuLe_idx" ON "Evenement"("reclamationId", "survenuLe");

-- CreateIndex
CREATE INDEX "Message_societeId_createdAt_idx" ON "Message"("societeId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_reclamationId_idx" ON "Message"("reclamationId");

-- CreateIndex
CREATE INDEX "JournalAudit_entite_entiteId_idx" ON "JournalAudit"("entite", "entiteId");

-- CreateIndex
CREATE INDEX "JournalAudit_userId_survenuLe_idx" ON "JournalAudit"("userId", "survenuLe");

-- CreateIndex
CREATE INDEX "_Similaires_B_index" ON "_Similaires"("B");

-- AddForeignKey
ALTER TABLE "ParametresSociete" ADD CONSTRAINT "ParametresSociete_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompteurNumero" ADD CONSTRAINT "CompteurNumero_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipe" ADD CONSTRAINT "Equipe_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesSociete" ADD CONSTRAINT "AccesSociete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesSociete" ADD CONSTRAINT "AccesSociete_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_saisieParId_fkey" FOREIGN KEY ("saisieParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_reponseParId_fkey" FOREIGN KEY ("reponseParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reclamation" ADD CONSTRAINT "Reclamation_clotureParId_fkey" FOREIGN KEY ("clotureParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visa" ADD CONSTRAINT "Visa_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visa" ADD CONSTRAINT "Visa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceJointe" ADD CONSTRAINT "PieceJointe_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceJointe" ADD CONSTRAINT "PieceJointe_deposeeParId_fkey" FOREIGN KEY ("deposeeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commentaire" ADD CONSTRAINT "Commentaire_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commentaire" ADD CONSTRAINT "Commentaire_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evenement" ADD CONSTRAINT "Evenement_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evenement" ADD CONSTRAINT "Evenement_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "Societe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_reclamationId_fkey" FOREIGN KEY ("reclamationId") REFERENCES "Reclamation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAudit" ADD CONSTRAINT "JournalAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Similaires" ADD CONSTRAINT "_Similaires_A_fkey" FOREIGN KEY ("A") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Similaires" ADD CONSTRAINT "_Similaires_B_fkey" FOREIGN KEY ("B") REFERENCES "Reclamation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
