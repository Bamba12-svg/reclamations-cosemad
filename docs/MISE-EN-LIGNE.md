# Mise en ligne — Infomaniak (Node.js 24) + Neon (PostgreSQL)

Ce guide met la plateforme en production : l'application tourne sur un **site Node.js Infomaniak**, la base de
données est hébergée chez **Neon**. Comptez environ une heure la première fois.

> Les écrans des hébergeurs évoluent : si un libellé diffère, cherchez l'équivalent dans le Manager Infomaniak ou
> la console Neon. Références : [configuration d'un site Node.js Infomaniak](https://www.infomaniak.com/fr/support/faq/2535/modifier-la-configuration-dun-site-nodejs-infomaniak),
> [Neon avec Prisma](https://neon.com/docs/guides/prisma).

---

## 1. Base de données Neon

1. Créez un projet Neon. Région : **Europe (Francfort)**, la plus proche de Dakar. Version PostgreSQL : 17 ou 18.
2. Créez une base nommée `reclamations`.
3. Dans **Connect**, récupérez les **deux** chaînes de connexion :
   - **pooled** (l'hôte contient `-pooler`) → variable `DATABASE_URL`, utilisée par l'application ;
   - **direct** (sans `-pooler`) → variable `DATABASE_URL_UNPOOLED`, utilisée par les migrations.

   Les deux se terminent par `?sslmode=require`.

### Créer les tables et le premier compte (depuis votre PC)

Dans PowerShell, à la racine du projet, **sans modifier votre `.env` local** :

```powershell
$env:DATABASE_URL = "postgresql://…-pooler…/reclamations?sslmode=require"
$env:DATABASE_URL_UNPOOLED = "postgresql://…/reclamations?sslmode=require"
npm run db:deploy          # applique les migrations (prisma/migrations)

$env:INIT_QHSE_NOM = "Fatou Sarr"
$env:INIT_QHSE_EMAIL = "fatou.sarr@cosemad.sn"
$env:INIT_QHSE_MOT_DE_PASSE = "un mot de passe de 12 caractères ou plus"
npm run db:init            # sociétés, activités, équipes, délais, modèles, jours fériés, compte QHSE

Remove-Item Env:DATABASE_URL, Env:DATABASE_URL_UNPOOLED, Env:INIT_QHSE_MOT_DE_PASSE
```

`db:init` ne crée **aucune donnée de démonstration**. Il peut être relancé sans risque : ce qui existe déjà n'est
ni modifié ni dupliqué. **Ne lancez jamais `npm run db:seed` sur la base de production** : il la vide.

---

## 2. Site Node.js Infomaniak

### Création

Dans le Manager : **Hébergement Web → Ajouter un site → Node.js**. Choisissez **Node.js 24** (LTS) et le nom de
domaine (par exemple `reclamations.cosemad.sn`). Activez le **certificat SSL** (Let's Encrypt) : le site doit être
servi uniquement en HTTPS (l'application envoie l'en-tête HSTS).

### Code

Le dépôt GitHub étant privé, deux possibilités :

- **Git par SSH** (recommandé) : connectez-vous en SSH à l'hébergement, créez une clé (`ssh-keygen -t ed25519`),
  ajoutez la clé publique dans GitHub → *Settings → Deploy keys* du dépôt (lecture seule), puis :
  ```bash
  git clone git@github.com:Bamba12-svg/reclamations-cosemad.git app
  ```
- **FTP/SFTP** : envoyez le contenu du projet **sans** `node_modules`, `.next`, `.env` ni `stockage`.

### Fichier `.env` sur le serveur

Next.js lit le fichier `.env` du dossier de l'application au démarrage. Créez-le **sur le serveur uniquement**
(jamais dans Git) :

```dotenv
DATABASE_URL="postgresql://…-pooler…/reclamations?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://…/reclamations?sslmode=require"
AUTH_SECRET="…"            # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MODE_DEMO="0"
MESSAGERIE_MODE="demo"     # passer à "production" quand un fournisseur SMS/e-mail est branché (§ 5)
STOCKAGE_DOSSIER="/chemin/absolu/hors-application/stockage-reclamations"
NEXT_TELEMETRY_DISABLED="1"
```

- `AUTH_SECRET` : une valeur **différente** de celle du PC, 32 caractères minimum.
- `STOCKAGE_DOSSIER` : un dossier **en dehors** du dossier de l'application. Une mise à jour du code ne doit jamais
  effacer les pièces jointes des clients. Créez-le avant le premier démarrage.

Le serveur **refuse de démarrer** si la configuration est dangereuse : pas d'`AUTH_SECRET`, ou `MODE_DEMO="1"`
(le mode démo permet de prendre l'identité de n'importe quel compte sans mot de passe). Le message d'erreur
apparaît dans les journaux du site.

### Réglages Node.js (Manager → le site → Gérer les paramètres avancés → Node.js)

| Champ | Valeur |
|---|---|
| Dossier d'exécution | le dossier qui contient `package.json` (par exemple `./app`) |
| Commande de construction | `npm ci && npm run build` |
| Commande de lancement | `npm start` |
| Port d'écoute | celui proposé par Infomaniak (Next.js lit la variable `PORT`) |

`npm ci` installe aussi les outils de construction (TypeScript, Tailwind, Prisma). C'est voulu : le build en a
besoin, et `prisma generate` s'exécute automatiquement à l'installation.

Enregistrez, lancez la construction, puis **démarrez** le site.

### Vérification

1. `https://reclamations.cosemad.sn/api/sante` doit répondre `{"statut":"ok", …}`.
2. Le portail : `/carrefour-medical`, `/sonerco`, `/fls`.
3. `/bo` : connexion avec le compte créé par `db:init`.
4. Dans **Paramètres** :
   - créez les comptes : Direction Commerciale, accueil, Direction générale, responsables de traitement.
     Chaque compte reçoit un mot de passe provisoire, affiché une seule fois ;
   - désignez le responsable et les membres des équipes de chaque activité ;
   - ajoutez les jours fériés à date variable de l'année (Korité, Tabaski, Tamkharit, Maouloud, Magal…) ;
   - relisez les modèles de SMS. L'écran signale les caractères qui doublent le prix d'un SMS.
5. Faites un dépôt test sur le portail, traitez-le jusqu'à la clôture, puis supprimez-le si besoin.

---

## 3. Mises à jour

Après un `git push` validé par GitHub Actions (build vert) :

```bash
cd app
git pull
npm ci
npm run db:deploy      # seulement si de nouvelles migrations sont arrivées (sans risque sinon)
npm run build
```

Puis **redémarrez** le site dans le Manager. Contrôlez `/api/sante`.

Pour modifier le schéma de la base, créez toujours la migration **en local** (`npm run db:migrate -- --name …`),
poussez-la dans Git, puis appliquez-la en ligne avec `db:deploy`. Ne lancez jamais `migrate dev` ou `db:reset`
en production.

---

## 4. Sauvegardes et exploitation

| Élément | Où | Comment le sauvegarder |
|---|---|---|
| Base de données | Neon | Restauration à un instant donné (durée selon l'offre Neon). Export complémentaire mensuel : `pg_dump "$DATABASE_URL_UNPOOLED" > reclamations-AAAA-MM.sql` |
| Pièces jointes | Infomaniak, `STOCKAGE_DOSSIER` | Sauvegardes de l'hébergement, ou copie régulière du dossier |
| Secrets | `.env` du serveur | Coffre-fort de mots de passe de la DSI |

- **Journal d'audit** : la table `JournalAudit` trace chaque opération (connexions, affectations, visas, clôtures,
  exports, paramètres). Elle n'est jamais modifiée par l'application.
- **Limitation des tentatives** (connexion, dépôt, suivi) : elle est gardée en mémoire. Un redémarrage la remet à
  zéro, et elle suppose **une seule instance** de l'application. C'est le cas d'un site Node.js Infomaniak standard.
- **Comptes** : quand une personne quitte l'entreprise, *Paramètres → Utilisateurs → Désactiver*. L'effet est
  immédiat, et l'historique de ses actions est conservé.
- **Mot de passe oublié** : *Paramètres → Utilisateurs → Nouveau mot de passe*. Le QHSE remet le mot de passe
  provisoire en main propre.

---

## 5. Brancher l'envoi réel des e-mails et des SMS

Tant que `MESSAGERIE_MODE="demo"`, les messages sont **enregistrés** (table `Message`, statut `DEMO`) mais
**pas envoyés** : les clients ne reçoivent ni SMS ni e-mail.

### E-mails : déjà prêts, il suffit de renseigner le compte

Les e-mails partent par le serveur de messagerie de COSEMAD (SMTP). Créez de préférence une adresse dédiée, par
exemple `reclamations@cosemad.sn`, plutôt qu'une boîte personnelle. Ajoutez ensuite au `.env` du serveur :

```dotenv
SMTP_HOTE="mail.infomaniak.com"      # adresse SMTP du fournisseur de messagerie de cosemad.sn
SMTP_PORT="465"                      # 465 (SSL) ou 587 (STARTTLS)
SMTP_UTILISATEUR="reclamations@cosemad.sn"
SMTP_MOT_DE_PASSE="…"
EMAIL_EXPEDITEUR="Groupe COSEMAD – Réclamations <reclamations@cosemad.sn>"
EMAIL_REPONSE="qhse@cosemad.sn"      # facultatif : boîte qui reçoit les réponses des clients
```

Paramètres SMTP habituels selon l'hébergeur de la messagerie :

| Messagerie de cosemad.sn | SMTP_HOTE | SMTP_PORT |
|---|---|---|
| Infomaniak | `mail.infomaniak.com` | 465 |
| Microsoft 365 | `smtp.office365.com` | 587 |
| Google Workspace | `smtp.gmail.com` | 465 (mot de passe d'application) |

Microsoft retire progressivement l'envoi SMTP par simple mot de passe sur Microsoft 365 : dans ce cas, voyez avec
l'administrateur de la messagerie (autorisation SMTP pour cette boîte, ou relais SMTP).

Vérifiez la configuration avant l'ouverture. La commande envoie un vrai e-mail d'essai :

```bash
npm run email:test -- votre.adresse@exemple.sn
```

Pour que les e-mails n'arrivent pas en « Indésirables », l'administrateur du domaine `cosemad.sn` doit avoir
configuré **SPF** et **DKIM** pour ce serveur. C'est généralement déjà fait si la messagerie de l'entreprise
fonctionne.

### SMS : fournisseur à choisir

Une fois le fournisseur choisi (Orange, Free, un agrégateur SMS…), implémentez l'interface
`FournisseurMessage` dans `src/server/messagerie/fournisseurs.ts`, sur le modèle de `smtp.ts`. Ajoutez ses
identifiants au `.env`.

### Activation

Passez `MESSAGERIE_MODE="production"` et redémarrez. Chaque message passe alors par les statuts `EN_ATTENTE`, puis
`ENVOYE` ou `ECHEC` (avec le message d'erreur). Un échec d'envoi n'annule jamais l'enregistrement de la réclamation.
Tant que le fournisseur SMS n'est pas branché, les SMS sont marqués `ECHEC` (« Aucun fournisseur SMS n'est
configuré ») et seuls les e-mails partent.

---

## 6. Démonstration publique (soutenance)

Pour montrer l'application en ligne avec les données des maquettes, utilisez une **autre base Neon** (une
« branche » suffit) et un autre site ou sous-domaine. Ne le faites jamais sur la base de production.

```dotenv
MODE_DEMO="1"
DEMO_EN_LIGNE="1"
```

```powershell
$env:DATABASE_URL_UNPOOLED = "…base de démonstration…"; $env:DATABASE_URL = $env:DATABASE_URL_UNPOOLED
npm run db:deploy ; npm run db:seed
```

Le bouton *Paramètres → Réinitialiser les données de démonstration* recharge alors la démonstration en un clic.

---

## Liste de contrôle avant ouverture

- [ ] `MODE_DEMO="0"` et pas de `DEMO_EN_LIGNE` sur le site de production
- [ ] `AUTH_SECRET` propre au serveur, 32 caractères ou plus
- [ ] HTTPS actif (certificat SSL), le site redirige `http://` vers `https://`
- [ ] `STOCKAGE_DOSSIER` hors du dossier de l'application, inclus dans les sauvegardes
- [ ] `/api/sante` répond `ok`
- [ ] Comptes créés, responsables et équipes désignés, jours fériés de l'année saisis
- [ ] Fournisseur SMS branché et `MESSAGERIE_MODE="production"`. Sinon, prévenir l'accueil : les clients ne
      reçoivent pas de SMS
- [ ] Dépôt test de bout en bout (portail → fiche → réponse → visas → clôture → suivi client)
