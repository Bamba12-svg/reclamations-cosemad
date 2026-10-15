import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./server/db";
import { modeDemo } from "./server/demo";
import { journaliser } from "./server/journal";
import { enregistrerTentative, estBloque, LIMITE_CONNEXION_COMPTE, LIMITE_CONNEXION_IP, reinitialiser } from "./server/limiteur";

/** Message unique pour un e-mail inconnu ou un mot de passe faux : on ne révèle pas quels comptes existent. */
export class IdentifiantsIncorrects extends CredentialsSignin {
  override code = "identifiants";
}
export class TropDeTentatives extends CredentialsSignin {
  override code = "bloque";
}

const schemaIdentifiants = z.object({
  email: z.email().trim().toLowerCase().max(254),
  motDePasse: z.string().min(1).max(200),
});

// Empreinte bcrypt factice : la vérification prend le même temps qu'un compte existe ou non.
const EMPREINTE_FACTICE = "$2b$10$CDozolQolDH.A2kjZUaz3ejb7TTq/TCHUOES9Cdubvrz0vX6Nhm0S";

function contexte(requete: Request) {
  const ip = requete.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || requete.headers.get("x-real-ip") || "inconnue";
  return { ip, userAgent: requete.headers.get("user-agent") };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "identifiants",
      credentials: { email: {}, motDePasse: {} },
      async authorize(brut, requete) {
        const ctx = contexte(requete);
        const lu = schemaIdentifiants.safeParse(brut);
        if (!lu.success) throw new IdentifiantsIncorrects();
        const { email, motDePasse } = lu.data;

        const cleCompte = `connexion:${email}`;
        const cleIp = `connexion-ip:${ctx.ip}`;
        if (estBloque(cleCompte, LIMITE_CONNEXION_COMPTE).bloque || estBloque(cleIp, LIMITE_CONNEXION_IP).bloque) {
          await journaliser(db, { action: "auth.bloque", entite: "User", details: { email }, ...ctx });
          throw new TropDeTentatives();
        }

        const user = await db.user.findUnique({ where: { email }, select: { id: true, nom: true, email: true, actif: true, motDePasseHash: true } });
        const valide = await bcrypt.compare(motDePasse, user?.motDePasseHash ?? EMPREINTE_FACTICE);
        if (!user || !user.actif || !user.motDePasseHash || !valide) {
          enregistrerTentative(cleCompte);
          enregistrerTentative(cleIp);
          await journaliser(db, { action: "auth.echec", entite: "User", entiteId: user?.id, userId: null, details: { email }, ...ctx });
          throw new IdentifiantsIncorrects();
        }

        reinitialiser(cleCompte);
        await db.$transaction([
          db.user.update({ where: { id: user.id }, data: { derniereConnexion: new Date() } }),
          db.journalAudit.create({ data: { action: "auth.connexion", entite: "User", entiteId: user.id, userId: user.id, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) } }),
        ]);
        return { id: user.id, name: user.nom, email: user.email };
      },
    }),
    // Mode démonstration uniquement : changer de profil sans mot de passe (menu « Simuler un profil »).
    Credentials({
      id: "demo",
      credentials: { userId: {} },
      async authorize(brut, requete) {
        if (!modeDemo()) return null;
        const userId = typeof brut.userId === "string" ? brut.userId : "";
        const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, nom: true, email: true, actif: true } });
        if (!user?.actif) return null;
        await journaliser(db, { action: "auth.profil-demo", entite: "User", entiteId: user.id, userId: user.id, ...contexte(requete) });
        return { id: user.id, name: user.nom, email: user.email };
      },
    }),
  ],
});
