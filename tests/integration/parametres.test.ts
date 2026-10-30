import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changerMotDePasseProvisoire } from "@/server/compte";
import { chargerActeur } from "@/server/droits/acteur";
import type { Acteur } from "@/server/droits/permissions";
import {
  activerUtilisateur,
  ajouterJourFerie,
  changerRole,
  creerActivite,
  creerUtilisateur,
  donneesParametres,
  enregistrerDelais,
  enregistrerMessagerie,
  enregistrerModeles,
  modifierActivite,
  motDePasseProvisoire,
  reinitialiserMotDePasse,
  supprimerJourFerie,
  testerMessagerie,
} from "@/server/parametres";
import { creerSocieteDeTest, db, supprimerSociete } from "./base";

describe("paramètres QHSE (base réelle)", () => {
  const ctx = { ip: null, userAgent: "vitest" };
  const suffixe = Math.random().toString(36).slice(2, 8);
  let societe: Awaited<ReturnType<typeof creerSocieteDeTest>>;
  let qhse: Acteur;
  let chef: Acteur;
  const crees: string[] = [];
  const ferie = "2031-06-15";

  beforeAll(async () => {
    societe = await creerSocieteDeTest();
    const q = await db.user.create({ data: { email: `pq-${suffixe}@test.sn`, nom: "Param Qhse", role: "QHSE", toutesSocietes: true } });
    const c = await db.user.create({
      data: { email: `pc-${suffixe}@test.sn`, nom: "Param Chef", role: "RESPONSABLE_TRAITEMENT", acces: { create: { societeId: societe.id } } },
    });
    crees.push(q.id, c.id);
    qhse = (await chargerActeur(db, q.id))!;
    chef = (await chargerActeur(db, c.id))!;
  });

  afterAll(async () => {
    await db.jourFerie.deleteMany({ where: { date: new Date(`${ferie}T00:00:00Z`) } });
    await db.journalAudit.deleteMany({ where: { OR: [{ societeId: societe.id }, { userId: { in: crees } }] } });
    await db.parametresSociete.deleteMany({ where: { societeId: societe.id } });
    await supprimerSociete(societe.id);
    await db.user.deleteMany({ where: { id: { in: crees } } });
    await db.$disconnect();
  });

  it("réservé au QHSE", async () => {
    expect(await enregistrerDelais(chef, societe.id, { delaiQualificationH: 12, delaiReponseJO: 3, delaiClotureJ: 10 }, ctx)).toEqual({
      ok: false,
      erreur: "Les paramètres sont réservés au Service QHSE.",
    });
  });

  it("délais et modèles : enregistrés, validés (variable inconnue, SMS > 160)", async () => {
    expect((await enregistrerDelais(qhse, societe.id, { delaiQualificationH: 12, delaiReponseJO: 3, delaiClotureJ: 10 }, ctx)).ok).toBe(true);
    const ok = { modeleSms: "Reclamation {numero} recue. Reponse sous {delai} jours.", modeleEmailObjet: "Réclamation {numero}", modeleEmail: "Bonjour {nom}, merci." };
    expect((await enregistrerModeles(qhse, societe.id, ok, ctx)).ok).toBe(true);
    expect(await enregistrerModeles(qhse, societe.id, { ...ok, modeleSms: "Bonjour {prenom}" }, ctx)).toMatchObject({ ok: false, erreur: expect.stringContaining("Variable inconnue : {prenom}") });
    const d = await donneesParametres(societe.id);
    expect(d.delais).toEqual({ delaiQualificationH: 12, delaiReponseJO: 3, delaiClotureJ: 10 });
    expect(d.modeles.modeleSms).toBe(ok.modeleSms);
  });

  it("jours fériés : ajout, doublon refusé, retrait", async () => {
    expect((await ajouterJourFerie(qhse, societe.id, { date: ferie, libelle: "Tabaski" }, ctx)).ok).toBe(true);
    expect(await ajouterJourFerie(qhse, societe.id, { date: ferie, libelle: "Tabaski" }, ctx)).toEqual({ ok: false, erreur: "Ce jour est déjà enregistré comme férié." });
    expect((await supprimerJourFerie(qhse, societe.id, ferie, ctx)).ok).toBe(true);
  });

  let nouveauId = "";
  it("création de compte : mot de passe provisoire valide, rattachement selon le rôle, e-mail unique", async () => {
    expect(motDePasseProvisoire()).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    const r = await creerUtilisateur(qhse, societe.id, { nom: "Nouvelle Personne", email: `NP-${suffixe}@Test.sn`, role: "RESPONSABLE_TRAITEMENT" }, ctx);
    expect(r).toMatchObject({ ok: true, motDePasse: expect.any(String) });
    const u = await db.user.findUniqueOrThrow({ where: { email: `np-${suffixe}@test.sn` }, include: { acces: true } });
    nouveauId = u.id;
    crees.push(u.id);
    expect(u.toutesSocietes).toBe(false);
    expect(u.doitChangerMotDePasse).toBe(true);
    expect(u.acces.map((a) => a.societeId)).toEqual([societe.id]);
    expect(await bcrypt.compare(r.ok ? r.motDePasse! : "", u.motDePasseHash!)).toBe(true);
    expect(await creerUtilisateur(qhse, societe.id, { nom: "Doublon", email: `np-${suffixe}@test.sn`, role: "QHSE" }, ctx)).toEqual({ ok: false, erreur: "Cette adresse e-mail est déjà utilisée." });
  });

  it("rôles et activation : garde-fous sur son propre compte et sur le dernier QHSE", async () => {
    expect(await changerRole(qhse, societe.id, qhse.id, "DIRECTION_GENERALE", ctx)).toEqual({ ok: false, erreur: "Vous ne pouvez pas changer votre propre rôle." });
    expect(await activerUtilisateur(qhse, societe.id, qhse.id, false, ctx)).toEqual({ ok: false, erreur: "Vous ne pouvez pas désactiver votre propre compte." });
    expect((await changerRole(qhse, societe.id, nouveauId, "DIRECTION_COMMERCIALE", ctx)).ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: nouveauId } })).toutesSocietes).toBe(true);

    expect((await activerUtilisateur(qhse, societe.id, nouveauId, false, ctx)).ok).toBe(true);
    expect(await chargerActeur(db, nouveauId)).toBeNull(); // la session tombe immédiatement
    expect(await reinitialiserMotDePasse(qhse, societe.id, nouveauId, ctx)).toEqual({ ok: false, erreur: "Réactivez d'abord ce compte." });
    expect((await activerUtilisateur(qhse, societe.id, nouveauId, true, ctx)).ok).toBe(true);
    const r = await reinitialiserMotDePasse(qhse, societe.id, nouveauId, ctx);
    expect(r.ok && r.motDePasse).toBeTruthy();
    expect((await chargerActeur(db, nouveauId))?.doitChangerMotDePasse).toBe(true);
  });

  it("mot de passe provisoire : remplacement obligatoire, contrôlé côté serveur", async () => {
    const provisoire = (await reinitialiserMotDePasse(qhse, societe.id, nouveauId, ctx)) as { ok: true; motDePasse: string };
    const changer = (motDePasse: string, confirmation = motDePasse) => changerMotDePasseProvisoire(db, nouveauId, { motDePasse, confirmation }, ctx);

    expect(await changer("court1")).toMatchObject({ ok: false, champs: { motDePasse: "Au moins 10 caractères." } });
    expect(await changer("sanschiffreici")).toMatchObject({ ok: false, champs: { motDePasse: "Utilisez au moins une lettre et un chiffre." } });
    expect(await changer("Dakar2026sn", "Dakar2026SN")).toMatchObject({ ok: false, champs: { confirmation: "Les deux mots de passe ne sont pas identiques." } });
    expect(await changer(provisoire.motDePasse)).toMatchObject({ ok: false, champs: { motDePasse: "Choisissez un mot de passe différent du mot de passe provisoire." } });

    expect(await changer("Dakar2026sn")).toEqual({ ok: true });
    const u = await db.user.findUniqueOrThrow({ where: { id: nouveauId } });
    expect(u.doitChangerMotDePasse).toBe(false);
    expect(await bcrypt.compare("Dakar2026sn", u.motDePasseHash!)).toBe(true);
    expect(await db.journalAudit.count({ where: { action: "auth.mot-de-passe-choisi", userId: nouveauId } })).toBe(1);
    // Une seule fois : ce n'est pas un moyen de changer de mot de passe sans connaître l'actuel.
    expect(await changer("Autre2026xx")).toEqual({ ok: false, erreur: "Votre mot de passe a déjà été choisi." });
  });

  it("messagerie de la filiale : saisie par le QHSE, mot de passe chiffré et jamais journalisé", async () => {
    if ((process.env.AUTH_SECRET ?? "").length < 32) process.env.AUTH_SECRET = "cle-de-test-".repeat(4);
    const demo = process.env.DEMO_EN_LIGNE;
    delete process.env.DEMO_EN_LIGNE;
    try {
      const boite = { emailEnvoi: `envoi-${suffixe}@filiale.sn`, motDePasse: "Secret-Boite-2026", nomExpediteur: "Filiale – Réclamations", hote: "mail.infomaniak.com", port: 465, emailReponse: "" };
      expect(await enregistrerMessagerie(chef, societe.id, boite, ctx)).toMatchObject({ ok: false });
      expect(await enregistrerMessagerie(qhse, societe.id, { ...boite, motDePasse: "" }, ctx)).toEqual({ ok: false, erreur: "Saisissez le mot de passe de cette boîte." });
      expect((await enregistrerMessagerie(qhse, societe.id, { ...boite, hote: "127.0.0.1" }, ctx)).ok).toBe(false);
      expect(await enregistrerMessagerie(qhse, societe.id, boite, ctx)).toEqual({ ok: true, message: "Messagerie enregistrée" });

      const p = await db.parametresSociete.findUniqueOrThrow({ where: { societeId: societe.id } });
      expect(p.smtpUtilisateur).toBe(boite.emailEnvoi);
      expect(p.smtpMotDePasse).toMatch(/^v1:/);
      expect(p.smtpMotDePasse).not.toContain("Secret-Boite");
      const journal = await db.journalAudit.findMany({ where: { societeId: societe.id, action: "parametres.messagerie" } });
      expect(JSON.stringify(journal, (_, v) => (typeof v === "bigint" ? String(v) : v))).not.toContain("Secret-Boite");
      expect(journal.at(-1)?.details).toMatchObject({ motDePasseModifie: true });

      // Même boîte, mot de passe laissé vide : conservé ; adresse de réponse ajoutée.
      expect((await enregistrerMessagerie(qhse, societe.id, { ...boite, motDePasse: "", emailReponse: "Qualite@Filiale.sn" }, ctx)).ok).toBe(true);
      const p2 = await db.parametresSociete.findUniqueOrThrow({ where: { societeId: societe.id } });
      expect(p2.smtpMotDePasse).toBe(p.smtpMotDePasse);
      expect(p2.emailReponse).toBe("qualite@filiale.sn");
      const donnees = await donneesParametres(societe.id);
      expect(donnees.messagerie).toMatchObject({ source: "parametres", emailEnvoi: boite.emailEnvoi, motDePasseEnregistre: true, motDePasseIllisible: false });
      expect(JSON.stringify(donnees)).not.toContain("Secret-Boite");
      expect(JSON.stringify(donnees)).not.toContain(p.smtpMotDePasse!);

      // Autre adresse sans mot de passe : refusé (on n'envoie pas avec le mot de passe d'une autre boîte).
      expect((await enregistrerMessagerie(qhse, societe.id, { ...boite, emailEnvoi: `autre-${suffixe}@filiale.sn`, motDePasse: "" }, ctx)).ok).toBe(false);
      // Test d'envoi : réservé au QHSE.
      expect(await testerMessagerie(chef, societe.id, ctx)).toMatchObject({ ok: false });

      // Démonstration publique : bloquée.
      process.env.DEMO_EN_LIGNE = "1";
      if (process.env.MODE_DEMO === "1") expect((await enregistrerMessagerie(qhse, societe.id, boite, ctx)).ok).toBe(false);
      delete process.env.DEMO_EN_LIGNE;

      // Adresse vidée : boîte retirée.
      expect(await enregistrerMessagerie(qhse, societe.id, { ...boite, emailEnvoi: "", motDePasse: "" }, ctx)).toEqual({ ok: true, message: "Boîte d'envoi retirée" });
      const p3 = await db.parametresSociete.findUniqueOrThrow({ where: { societeId: societe.id } });
      expect([p3.smtpUtilisateur, p3.smtpMotDePasse]).toEqual([null, null]);
    } finally {
      if (demo === undefined) delete process.env.DEMO_EN_LIGNE;
      else process.env.DEMO_EN_LIGNE = demo;
    }
  });

  it("activités : création (code unique), responsable et équipes", async () => {
    expect((await creerActivite(qhse, societe.id, { code: "liv", nom: "Test Livraison", nomCourt: "Livraison" }, ctx)).ok).toBe(true);
    expect(await creerActivite(qhse, societe.id, { code: "LIV", nom: "Autre", nomCourt: "Autre" }, ctx)).toEqual({ ok: false, erreur: "Le code LIV est déjà utilisé." });
    const activite = await db.activite.findFirstOrThrow({ where: { societeId: societe.id, code: "LIV" } });

    // Le compte Direction Commerciale ne peut pas diriger une activité.
    const refus = await modifierActivite(qhse, societe.id, activite.id, { nom: "Test Livraison", nomCourt: "Livraison", description: "", responsableId: nouveauId, actif: true, equipes: [] }, ctx);
    expect(refus).toMatchObject({ ok: false });

    const ok = await modifierActivite(
      qhse,
      societe.id,
      activite.id,
      { nom: "Test Livraison", nomCourt: "Livraison", description: "Tournées", responsableId: chef.id, actif: true, equipes: [{ id: null, nom: "Chauffeurs", membres: [chef.id] }] },
      ctx,
    );
    expect(ok.ok).toBe(true);
    const d = await donneesParametres(societe.id);
    expect(d.activites.find((a) => a.code === "LIV")).toMatchObject({ responsable: "Param Chef", equipes: [{ nom: "Chauffeurs", membres: [{ nom: "Param Chef" }] }] });
    expect((await chargerActeur(db, chef.id))!.activitesDirigeesIds).toContain(activite.id);
  });
});
