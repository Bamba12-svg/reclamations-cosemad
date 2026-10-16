import { db } from "@/server/db";
import { peutVoir } from "@/server/droits/permissions";
import { journaliser } from "@/server/journal";
import { acteurCourant } from "@/server/session";
import { lireContenu } from "@/server/stockage";

/**
 * Téléchargement d'une pièce jointe. Les fichiers ne sont jamais servis directement depuis le disque :
 * chaque demande revérifie la session et le périmètre (même réponse 404 qu'une pièce inexistante).
 * Images et PDF s'ouvrent dans le navigateur ; ?telecharger=1 force l'enregistrement. Le type servi
 * est celui détecté par la signature binaire au dépôt (JPG, PNG, PDF) : jamais de HTML ni de script.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ societe: string; numero: string; id: string }> }) {
  const acteur = await acteurCourant();
  if (!acteur || acteur.doitChangerMotDePasse) return new Response("Connexion requise.", { status: 401 });
  const { societe: slug, numero, id } = await params;

  const piece = await db.pieceJointe.findUnique({
    where: { id },
    select: {
      id: true,
      nomOriginal: true,
      typeMime: true,
      cleStockage: true,
      reclamation: {
        select: {
          id: true,
          numero: true,
          societeId: true,
          activiteId: true,
          responsableId: true,
          clotureLe: true,
          societe: { select: { slug: true } },
          actions: { select: { responsableId: true } },
        },
      },
    },
  });
  const r = piece?.reclamation;
  if (!piece || !r || r.societe.slug !== slug || r.numero !== decodeURIComponent(numero).toUpperCase() || !peutVoir(acteur, r)) {
    return new Response("Pièce jointe introuvable.", { status: 404 });
  }

  const octets = await lireContenu(piece);
  if (!octets) return new Response("Fichier absent du stockage.", { status: 410 });

  await journaliser(db, { action: "piece.consulter", entite: "PieceJointe", entiteId: piece.id, userId: acteur.id, societeId: r.societeId });

  const telecharger = new URL(requete.url).searchParams.get("telecharger") === "1";
  const nomAscii = piece.nomOriginal.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "piece-jointe";
  return new Response(Buffer.from(octets), {
    headers: {
      "Content-Type": piece.typeMime,
      "Content-Length": String(octets.byteLength),
      "Content-Disposition": `${telecharger ? "attachment" : "inline"}; filename="${nomAscii}"; filename*=UTF-8''${encodeURIComponent(piece.nomOriginal)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
