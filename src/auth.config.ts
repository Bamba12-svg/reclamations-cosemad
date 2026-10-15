import type { NextAuthConfig } from "next-auth";

/**
 * Configuration Auth.js partagée par le proxy (protection des URL) et par src/auth.ts.
 * Elle n'importe ni la base ni bcrypt : le proxy reste léger.
 * Session JWT (cookie chiffré httpOnly) : elle ne contient que l'identifiant de l'utilisateur.
 * Le rôle et le périmètre sont relus en base à chaque requête : un compte désactivé ou un rôle
 * modifié prend effet immédiatement, sans attendre l'expiration de la session.
 */
export const authConfig = {
  pages: { signIn: "/bo/connexion" },
  session: { strategy: "jwt", maxAge: 10 * 60 * 60 }, // une journée de travail
  trustHost: true,
  providers: [], // déclarés dans src/auth.ts
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/bo/connexion") return true;
      return !!auth?.user; // sinon : redirection vers la page de connexion
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
