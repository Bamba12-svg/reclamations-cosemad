import "server-only";
import type { Canal } from "@/generated/prisma/client";
import { formatDate, instantDakar } from "@/lib/dates";
import { LIBELLE_MODE } from "@/lib/libelles";
import { remplirModele } from "@/lib/modeles";
import { erreursParChamp } from "@/lib/validation/communs";
import { schemaNouvelleReclamation } from "@/lib/validation/backoffice";
import { db } from "./db";
import { prochainNumero } from "./domaine/numerotation";
import { aLaPermission, peutAccederSociete, type Acteur } from "./droits/permissions";
import { responsablesPossibles } from "./fiche/responsables";
import type { ContexteRequete } from "./fiche/operations";
import { ajouterEvenement, journaliser } from "./journal";
import { expedier, preparerMessage } from "./messagerie";
import { delaisSociete } from "./requetes/contexte-societe";
import { empreinteSha256, nouvelleCle, stockage } from "./stockage";
import { controlerFichier, MAX_PIECES_PAR_DEPOT } from "./stockage/controle";

export type ResultatSaisie = { ok: true; numero: string } | { ok: false; erreur: string; champs?: Record<string, string> };

const MESSAGE_DATE = "Indiquez la date et l’heure réelles de réception.";

/**
 * Saisie d'une réclamation reçue par téléphone, à l'oral, par courrier ou par mail (accueil, QHSE).
 * Même déroulé que le dépôt sur le portail : fichiers contrôlés et stockés, puis numéro, réclamation,
 * historique, SMS (et e-mail) de confirmation et journal dans UNE transaction, envoi après validation.
 */
export async function saisirReclamation(
  acteur: Acteur,
  societeId: string,
  saisie: unknown,
  fichiers: { nom: string; octets: Uint8Array }[],
  ctx: ContexteRequete,
  maintenant = new Date(),
): Promise<ResultatSaisie> {
  if (!aLaPermission(acteur, "reclamation.creer") || !peutAccederSociete(acteur, societeId)) {
    return { ok: false, erreur: "La saisie des réclamations est réservée à l'accueil et au Service QHSE." };
  }
  const lu = schemaNouvelleReclamation.safeParse(saisie);
  if (!lu.success) {
    const champs = erreursParChamp(lu.error);
    // La maquette affiche un seul message pour la date et l'heure.
    if (champs.dateReception || champs.heureReception) {
      champs.date = MESSAGE_DATE;
      delete champs.dateReception;
      delete champs.heureReception;
    }
    return { ok: false, erreur: formulaireEnErreur(Object.keys(champs).length), champs };
  }
  const d = lu.data;

  const recueLe = instantDakar(d.dateReception, d.heureReception);
  if (recueLe.getTime() > maintenant.getTime() + 5 * 60_000) {
    return { ok: false, erreur: formulaireEnErreur(1), champs: { date: "La date de réception ne peut pas être dans le futur." } };
  }

  const activite = await db.activite.findFirst({ where: { id: d.activiteId, societeId, actif: true }, select: { id: true, nom: true } });
  if (!activite) return { ok: false, erreur: formulaireEnErreur(1), champs: { activiteId: "Choisissez l'activité concernée." } };

  let responsable: { id: string; nom: string } | null = null;
  if (d.responsableId) {
    responsable = (await responsablesPossibles(db, activite.id)).find((p) => p.id === d.responsableId) ?? null;
    if (!responsable) return { ok: false, erreur: "Cette personne ne peut pas traiter les réclamations de cette activité." };
  }

  if (fichiers.length > MAX_PIECES_PAR_DEPOT) return { ok: false, erreur: "3 fichiers au maximum." };
  const pieces: { nomOriginal: string; typeMime: string; taille: number; cleStockage: string; sha256: string; octets: Uint8Array }[] = [];
  for (const f of fichiers) {
    const c = controlerFichier(f.nom, f.octets);
    if (!c.ok) return { ok: false, erreur: c.erreur, champs: { fichiers: c.erreur } };
    pieces.push({ nomOriginal: c.nom, typeMime: c.type.mime, taille: c.taille, cleStockage: nouvelleCle(c.type, maintenant), sha256: empreinteSha256(f.octets), octets: f.octets });
  }

  const [societe, parametres, delais] = await Promise.all([
    db.societe.findUniqueOrThrow({ where: { id: societeId }, select: { id: true, code: true } }),
    db.parametresSociete.findUnique({ where: { societeId } }),
    delaisSociete(societeId),
  ]);

  const enregistres: string[] = [];
  try {
    for (const p of pieces) {
      await stockage().enregistrer(p.cleStockage, p.octets);
      enregistres.push(p.cleStockage);
    }
    const estSociete = d.origine.startsWith("Société");
    const canaux: Canal[] = d.email ? ["SMS", "EMAIL"] : ["SMS"];

    const resultat = await db.$transaction(async (tx) => {
      const { numero, annee, sequence } = await prochainNumero(tx, societe, maintenant.getUTCFullYear());
      const valeurs = { numero, nom: d.nom, date: formatDate(recueLe), delai: delais.reponseJO };
      const r = await tx.reclamation.create({
        data: {
          numero,
          annee,
          sequence,
          societeId,
          activiteId: activite.id,
          recueLe,
          mode: d.mode,
          origine: d.origine,
          saisieParId: acteur.id,
          profil: estSociete ? "SOCIETE" : "PARTICULIER",
          clientNom: d.nom,
          secteur: estSociete ? d.origine.replace(/^Société · /, "") : null,
          telephone: d.telephone,
          email: d.email,
          canauxReponse: canaux,
          type: d.type,
          sousType: d.type === "PRODUIT" ? d.sousType : null,
          description: d.description,
          responsableId: responsable?.id ?? null,
          affecteeLe: responsable ? maintenant : null,
          pieces: {
            create: pieces.map(({ octets: _octets, ...p }) => ({ ...p, source: "INTERNE" as const, deposeeParId: acteur.id })),
          },
        },
        select: { id: true },
      });
      const qui = { userId: acteur.id };
      await ajouterEvenement(tx, r.id, `Réclamation enregistrée (${LIBELLE_MODE[d.mode]})`, qui, maintenant);
      const messages = [
        await preparerMessage(tx, { societeId, reclamationId: r.id, canal: "SMS", destinataire: d.telephone, corps: remplirModele(parametres?.modeleSms ?? "Réclamation {numero} enregistrée.", valeurs) }),
      ];
      if (d.email && parametres) {
        messages.push(
          await preparerMessage(tx, {
            societeId,
            reclamationId: r.id,
            canal: "EMAIL",
            destinataire: d.email,
            objet: remplirModele(parametres.modeleEmailObjet, valeurs),
            corps: remplirModele(parametres.modeleEmail, valeurs),
          }),
        );
      }
      await ajouterEvenement(tx, r.id, `Confirmation envoyée au client (SMS${messages.length > 1 ? " + e-mail" : ""})`, "Système", maintenant);
      if (responsable) await ajouterEvenement(tx, r.id, `Affectée à ${responsable.nom} (${activite.nom})`, qui, maintenant);
      await journaliser(tx, {
        action: "reclamation.saisir",
        entite: "Reclamation",
        entiteId: r.id,
        userId: acteur.id,
        societeId,
        details: { numero, mode: d.mode, responsableId: responsable?.id ?? null, pieces: pieces.length },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { numero, messageIds: messages.map((m) => m.id) };
    });

    await expedier(db, resultat.messageIds);
    return { ok: true, numero: resultat.numero };
  } catch (e) {
    await Promise.all(enregistres.map((cle) => stockage().supprimer(cle).catch(() => undefined)));
    throw e;
  }
}

function formulaireEnErreur(n: number): string {
  return `Le formulaire contient ${n} erreur${n > 1 ? "s" : ""} à corriger`;
}
