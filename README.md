# Réclamations clients — Groupe COSEMAD

Plateforme unique de gestion des réclamations pour Carrefour Médical, Sonerco et FLS :
portail client public (dépôt et suivi) et back-office des collaborateurs (procédure qualité PR06, fiche PR06-ENR-01).

## Pile technique

| Élément | Version |
|---|---|
| Next.js (App Router) + React | 16.4.1 · 19.3.1 |
| TypeScript (strict) | 5.9.3 |
| Tailwind CSS | 4.3.3 |
| PostgreSQL | 18 en local, Neon en ligne |
| Prisma + @prisma/adapter-pg | 7.10.0 |
| ESLint | 9.39.5 |
| Node.js | 22.18 ou plus (CI : 22, production Infomaniak : 24) |

Les versions sont **figées** dans `package.json`. Ne lancez pas `npm install prisma` sans numéro de version :
sur npm, l'étiquette « latest » de Prisma pointe aujourd'hui vers une version de test (8.0.0-rc).

## Installation sous Windows (PowerShell)

### 1. Prérequis

```powershell
node -v      # doit afficher v22.18 ou plus
git --version
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" --version   # PostgreSQL 18
```

### 2. Base de données locale

```powershell
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
& $psql -U postgres -c "CREATE ROLE cosemad LOGIN PASSWORD 'cosemad' CREATEDB;"
& $psql -U postgres -c "CREATE DATABASE reclamations OWNER cosemad;"
```

(`CREATEDB` est nécessaire : Prisma crée une base temporaire pour vérifier chaque migration.)

### 3. Projet

```powershell
cd C:\chemin\vers\reclamations-cosemad
Copy-Item .env.example .env
npm install
npm run db:migrate -- --name init     # crée les tables (la première fois uniquement)
npm run dev
```

Ouvrez <http://localhost:3000> et <http://localhost:3000/api/sante>.

### Données de démonstration

```powershell
npm run db:seed
```

Charge les 3 sociétés, leurs activités et équipes, 59 utilisateurs et 181 réclamations, identiques aux maquettes
(Carrefour Médical 74, Sonerco 49, FLS 58). Les dates sont décalées pour que le « jour de la maquette » (02/10/2026)
tombe le jour du chargement : les statuts (en cours, en retard, à viser…) restent les mêmes.
**Le script vide la base avant de la remplir** et refuse de tourner en production.

Mot de passe de tous les comptes : `demo2026`

| Compte | Rôle | Sociétés |
|---|---|---|
| fatou.sarr@cosemad.sn | Service QHSE | toutes |
| omar.sankhare@cosemad.sn | Service QHSE | toutes |
| ibrahima.fall@cosemad.sn | Direction Commerciale | toutes |
| awa.ba@cosemad.sn | Agent d'accueil | toutes |
| mariama.kane@cosemad.sn | Direction générale | toutes |
| cheikh.sy@carrefourmedical.sn | Responsable de traitement (Oxygène médical) | Carrefour Médical |
| modou.diagne@sonerco.sn | Responsable de traitement (Énergie) | Sonerco |
| mor.talla.sow@fls.sn | Responsable de traitement (Commandes et livraison) | FLS |

Les autres responsables et membres d'équipe suivent le même modèle : `prenom.nom@domaine-de-la-societe`.

### Portail client

<http://localhost:3000> ouvre le portail de la dernière société consultée (Carrefour Médical par défaut) :
`/carrefour-medical`, `/sonerco`, `/fls`. Le lien des SMS, `/suivi`, renvoie au suivi de la bonne société
d'après le préfixe du numéro. En mode démonstration, les SMS et e-mails s'affichent sur l'écran de confirmation
sans être envoyés, et les pièces jointes sont rangées dans le dossier `stockage/` du projet.

### Espace collaborateurs

Ajoutez une clé de session à votre `.env` (une seule fois) :

```powershell
$cle = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Add-Content .env "AUTH_SECRET=`"$cle`""
Add-Content .env 'MODE_DEMO="1"'
```

Puis ouvrez <http://localhost:3000/bo> et cliquez sur « Remplir avec le compte de démonstration ».
5 erreurs de mot de passe en 15 minutes bloquent le compte pendant 15 minutes ; chaque connexion,
échec et déconnexion est inscrit au journal.

### Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run verifier` | TypeScript + ESLint + tests + build (à lancer avant chaque commit) |
| `npm test` | tests automatiques (règles métier, droits, validation, base de données) |
| `npm run db:migrate -- --name <nom>` | nouvelle migration après une modification de `prisma/schema.prisma` |
| `npm run db:seed` | recharger les données de démonstration |
| `npm run db:reset` | tout effacer, réappliquer les migrations et recharger la démonstration |
| `npm run db:studio` | explorer la base dans le navigateur |

## Règles métier (src/server/domaine)

| Règle | Fichier |
|---|---|
| Statut calculé (Nouvelle, En cours, En retard, Traitée), jamais stocké ; étapes visibles par le client | `statut.ts` |
| Alertes de délai : qualification 24 h, réponse 5 jours ouvrés, clôture 15 jours | `delais.ts`, `jours-ouvres.ts` |
| 8 conditions de clôture, conditions des visas, frise des 6 étapes | `cloture.ts` |
| Numérotation PREFIXE-AAAA-NNNN sans doublon ni trou | `numerotation.ts` |
| Droits par rôle et par société | `src/server/droits/permissions.ts` |

Les tests de `tests/integration` utilisent la base de `.env` : ils créent leurs propres données de test et les suppriment.

## Intégration continue

À chaque `push` sur `main`, GitHub Actions (Node 22, PostgreSQL 18) installe le projet, applique les migrations
sur une base vierge, vérifie qu'elles correspondent au schéma, charge les données de démonstration, puis lance
TypeScript, ESLint, les tests et le build.

## Organisation

```
prisma/            schéma, migrations, données de démonstration
src/app/           pages : portail client (public) et back-office (/bo)
src/server/        code serveur uniquement : base, règles métier, droits, messagerie, stockage, exports
src/lib/           code partagé : validation zod, formats, libellés
src/components/    composants d'interface (design system des maquettes)
public/logos/      logos des sociétés et du groupe
```
