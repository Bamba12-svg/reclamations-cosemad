-- Mot de passe provisoire (création ou réinitialisation par le QHSE) : changement obligatoire à la prochaine connexion.
ALTER TABLE "User" ADD COLUMN "doitChangerMotDePasse" BOOLEAN NOT NULL DEFAULT false;
