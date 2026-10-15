# Audit accessibilité et sécurité — 15/10/2026

## Accessibilité (objectif WCAG 2.1 niveau AA)

### Méthode

- **Contrôle automatique axe-core 4.10** (règles WCAG 2.0/2.1 A et AA, plus les bonnes pratiques) sur
  **18 pages**, en deux largeurs : ordinateur (1440 px) et téléphone (390 px).
  - Portail : accueil, dépôt, suivi, résultat de suivi.
  - Back-office : connexion, tableau de bord, tableau de suivi, deux fiches (ouverte et clôturée), nouvelle
    réclamation, Mes actions, À viser, 4 onglets de paramètres, fiche PR06-ENR-01.
- Parcours au clavier seul : dépôt sur le portail, traitement d'une fiche jusqu'à la clôture.
- Vérification de l'absence de défilement horizontal à 390 px sur chaque écran.

### Résultat

**0 violation** après corrections. Les 3 défauts trouvés ont été corrigés :

| Défaut | Correction |
|---|---|
| Numéro de téléphone du pied de page du portail repérable par la seule couleur | lien souligné |
| Frise des étapes (sur mobile) non atteignable au clavier | zone défilante focalisable |
| Tableau des actions d'une fiche clôturée non atteignable au clavier | zone défilante focalisable et nommée |

### Points vérifiés sur tout le site

- `lang="fr"`, titres de page uniques, lien d'évitement « Aller au contenu ».
- Contour de focus visible de 2 px partout, ordre de tabulation logique.
- Statuts jamais portés par la seule couleur : badge = couleur + icône + texte.
- Erreurs de formulaire :
  - texte sous le champ, relié par `aria-describedby` ;
  - focus placé sur le premier champ en erreur ;
  - message annoncé aux lecteurs d'écran.
- Messages flottants annoncés : `aria-live` pour les réussites, `role="alert"` pour les erreurs.
- Graphique du tableau de bord doublé d'un tableau de données lisible par les lecteurs d'écran.
- Cibles tactiles de 44 px minimum. Animations réduites si l'utilisateur le demande à son système
  (`prefers-reduced-motion`).

## Sécurité

| Sujet | Mesure en place |
|---|---|
| **Authentification** | Auth.js v5, mots de passe bcrypt. Message identique pour un compte inconnu ou un mauvais mot de passe, avec un temps de réponse constant. Blocage après 5 échecs en 15 min (par compte) et 30 (par adresse IP). |
| **Session** | Cookie chiffré httpOnly, `Secure` en HTTPS, durée 10 h. Le compte, son rôle et son périmètre sont relus à **chaque requête** : une désactivation ou un changement de rôle prend effet immédiatement. |
| **Droits** | Vérifiés côté serveur dans chaque page, action et route (rôle × société × activité). Une réclamation hors périmètre répond « introuvable », comme un numéro inexistant. Couverts par des tests unitaires et d'intégration. |
| **Procédure PR06** | Visas et clôture revérifiés côté serveur sous verrou de ligne (`SELECT … FOR UPDATE`). Chaque visa est réservé à sa fonction. Seul le QHSE clôture. La Direction générale est en lecture seule. |
| **Saisies** | Toutes validées par zod côté serveur, avec les mêmes messages qu'à l'écran. Requêtes Prisma paramétrées : pas d'injection SQL. |
| **Fichiers** | Type reconnu par signature binaire (JPG, PNG, PDF uniquement), 10 Mo maximum. Stockage sous un nom aléatoire et hors du dossier public. Téléchargement uniquement par une route qui revérifie les droits (`nosniff`, `no-store`). |
| **Portail public** | Limitation des dépôts et des recherches de suivi. Le suivi exige numéro **et** téléphone. Seuls les échecs comptent, ce qui freine l'énumération des numéros. Le client ne voit jamais le statut interne, les noms, les actions ni les commentaires. |
| **En-têtes HTTP** | `Content-Security-Policy` (ressources du site uniquement, aucune intégration externe), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. |
| **CSRF** | Actions serveur Next.js : contrôle de l'origine de la requête. Cookies `SameSite=Lax`. |
| **Garde-fous de configuration** | Démarrage refusé en production :<br>• sans `AUTH_SECRET` (32 caractères minimum) ;<br>• avec `MODE_DEMO=1`, sauf démonstration publique explicitement déclarée (`DEMO_EN_LIGNE=1`).<br>Avertissement si les SMS ne sont pas réellement envoyés. Le seed de démonstration refuse de tourner en production. |
| **Traçabilité** | Journal d'audit en ajout seul, écrit dans la même transaction que l'opération : connexions, échecs, consultations de pièces, exports, paramètres. |
| **Comptes** | Mots de passe provisoires aléatoires, affichés une seule fois, jamais stockés en clair. Impossible de se retirer ses propres droits ou de désactiver le dernier compte QHSE. |

### Dépendances (`npm audit --omit=dev`, 15/10/2026)

| Paquet | Gravité | Analyse |
|---|---|---|
| `prisma` (via `deepmerge-ts`, `mysql2`) | élevée | Outil en ligne de commande (migrations), jamais exposé aux requêtes des utilisateurs. `mysql2` n'est pas utilisé (base PostgreSQL). Corrigé dans Prisma 7.10.1, publié le jour de l'audit : **passer à 7.10.1 fin octobre** pour `prisma`, `@prisma/client` et `@prisma/adapter-pg` ensemble. |
| `exceljs` (via `uuid` < 11.1.1) | modérée | La faille ne concerne que les UUID v3/v5/v6 avec tampon fourni. exceljs n'utilise que la v4 : non exploitable. La seule « correction » proposée rétrograde exceljs en 3.4 : ne pas lancer `npm audit fix --force`. |

### Recommandations restantes

1. **Changement obligatoire du mot de passe provisoire** à la première connexion. Il faut ajouter un champ au
   modèle `User` et une migration.
2. **Limitation des tentatives partagée** (Redis ou table PostgreSQL) si l'application tourne un jour sur
   plusieurs instances.
3. **Double authentification** pour les comptes QHSE, si la DSI l'exige.
4. Revue de cet audit à chaque évolution majeure, ou au minimum une fois par an.
