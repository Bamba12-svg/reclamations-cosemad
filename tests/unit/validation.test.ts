import { describe, expect, it } from "vitest";
import type { ZodError } from "zod";
import { erreursParChamp } from "@/lib/validation/communs";
import { schemaAction, schemaModeles, schemaNouvelleReclamation, schemaReponse } from "@/lib/validation/backoffice";
import { schemaDepotPortail, schemaEtapeVous, schemaQuestionType, schemaSuivi } from "@/lib/validation/portail";

const erreurs = (r: { success: boolean; error?: ZodError }) => (r.success || !r.error ? {} : erreursParChamp(r.error));

describe("portail — étape « Vous »", () => {
  const base = { profil: "PARTICULIER", nom: "Aminata Diop", telephone: "77 412 35 08", email: "", canaux: ["SMS"] };

  it("accepte un particulier et normalise le téléphone en E.164", () => {
    const r = schemaEtapeVous.parse(base);
    expect(r.telephone).toBe("+221774123508");
    expect(r.email).toBeNull();
  });

  it("messages de la maquette", () => {
    expect(erreurs(schemaEtapeVous.safeParse({ ...base, nom: "A" }))).toMatchObject({ nom: "Indiquez votre nom et prénom." });
    expect(erreurs(schemaEtapeVous.safeParse({ ...base, telephone: "77 41" }))).toMatchObject({
      telephone: "Le numéro doit comporter 9 chiffres, par exemple 77 000 00 00.",
    });
    expect(erreurs(schemaEtapeVous.safeParse({ ...base, canaux: [] }))).toMatchObject({ canaux: "Choisissez au moins un moyen de recevoir la réponse." });
    expect(erreurs(schemaEtapeVous.safeParse({ ...base, canaux: ["EMAIL"] }))).toMatchObject({
      email: "Indiquez votre e-mail pour recevoir la réponse par e-mail.",
    });
    expect(erreurs(schemaEtapeVous.safeParse({ ...base, email: "pas-un-mail" }))).toMatchObject({ email: "Cette adresse e-mail n'est pas valide." });
  });

  it("une société exige secteur et contact", () => {
    const e = erreurs(schemaEtapeVous.safeParse({ ...base, profil: "SOCIETE", nom: "Pharmacie Baobab" }));
    expect(e).toMatchObject({ secteur: "Choisissez le secteur d'activité.", contactNom: "Indiquez la personne à recontacter." });
    const autre = erreurs(schemaEtapeVous.safeParse({ ...base, profil: "SOCIETE", nom: "X SA", secteur: "Autre", contactNom: "Awa Ndiaye" }));
    expect(autre).toMatchObject({ secteur: "Précisez votre secteur d'activité." });
  });

  it("accepte +221 et 00221", () => {
    expect(schemaEtapeVous.parse({ ...base, telephone: "+221 33 820 14 60" }).telephone).toBe("+221338201460");
    expect(schemaEtapeVous.parse({ ...base, telephone: "00221774123508" }).telephone).toBe("+221774123508");
  });
});

describe("portail — questions et dépôt complet", () => {
  it("type Produit sans précision", () => {
    expect(erreurs(schemaQuestionType.safeParse({ type: "PRODUIT" }))).toMatchObject({ type: "Précisez : qualité, prix ou fonctionnement." });
  });

  it("dépôt complet valide, consentement obligatoire", () => {
    const depot = {
      societe: "fls",
      profil: "PARTICULIER",
      nom: "Ousmane Sarr",
      telephone: "76 733 20 58",
      email: "ousmane.sarr@gmail.com",
      canaux: ["SMS", "EMAIL"],
      activiteCode: "SCE",
      type: "PRODUIT",
      sousType: "QUALITE",
      description: "Bouteille de ketchup gonflée au moment de l'achat.",
      premiereFois: true,
      consentement: true,
    };
    expect(schemaDepotPortail.safeParse(depot).success).toBe(true);
    expect(erreurs(schemaDepotPortail.safeParse({ ...depot, consentement: false }))).toMatchObject({
      consentement: "Cochez cette case pour envoyer votre réclamation.",
    });
    expect(erreurs(schemaDepotPortail.safeParse({ ...depot, description: "trop court" }))).toMatchObject({
      description: "Décrivez le problème en au moins 15 caractères.",
    });
  });

  it("suivi : numéro mis en majuscules", () => {
    expect(schemaSuivi.parse({ numero: " fls-2026-0032 ", telephone: "+221 33 822 61 37" })).toEqual({
      numero: "FLS-2026-0032",
      telephone: "+221338226137",
    });
  });
});

describe("back-office", () => {
  it("nouvelle réclamation : date et heure réelles obligatoires", () => {
    const r = schemaNouvelleReclamation.safeParse({
      mode: "TELEPHONE",
      origine: "Client particulier",
      dateReception: "2026-10-15",
      heureReception: "25:00",
      nom: "Aminata Diop",
      telephone: "774123508",
      email: "",
      activiteId: "x",
      type: "SERVICE",
      description: "Livraison arrivée avec trois jours de retard.",
    });
    expect(erreurs(r)).toHaveProperty("heureReception");
  });

  it("action : échéance obligatoire", () => {
    expect(erreurs(schemaAction.safeParse({ libelle: "Remplacer l'appareil", responsableId: "u", echeance: "" }))).toMatchObject({
      echeance: "Indiquez l'échéance de l'action.",
    });
  });

  it("réponse : 20 à 600 caractères", () => {
    expect(schemaReponse.safeParse({ texte: "Trop court", canaux: ["SMS"] }).success).toBe(false);
    expect(schemaReponse.safeParse({ texte: "x".repeat(601), canaux: ["SMS"] }).success).toBe(false);
  });

  it("modèles : SMS ≤ 160 caractères, variables connues seulement", () => {
    const ok = { modeleSms: "FLS : réclamation {numero} reçue.", modeleEmailObjet: "Réclamation {numero}", modeleEmail: "Bonjour {nom}, …" };
    expect(schemaModeles.safeParse(ok).success).toBe(true);
    expect(erreurs(schemaModeles.safeParse({ ...ok, modeleSms: "Bonjour {prenom} {numero}" }))).toMatchObject({
      modeleSms: "Variable inconnue : {prenom}. Variables possibles : {numero}, {nom}, {date}, {delai}.",
    });
    expect(schemaModeles.safeParse({ ...ok, modeleSms: "x".repeat(161) }).success).toBe(false);
  });
});
