import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Proxy Next.js 16 (ex-middleware) : toute URL /bo/… exige une session, sauf la page de connexion.
 * C'est une première barrière ; chaque page et chaque action serveur revérifient l'utilisateur,
 * son rôle et sa société (src/server/session.ts).
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/bo/:path*"],
};
