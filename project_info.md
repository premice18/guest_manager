````markdown
# 🥂 Guest Manager — project_info.md

## ✨ 1. Présentation & Branding

**Nom du projet :** Guest Manager  
**Slogan :** _“L’art de recevoir, simplifié.”_

**Positionnement :** Application web haut de gamme destinée aux organisateurs d’événements (mariages, galas, soirées d’entreprise) pour gérer l’accueil des invités avec élégance et efficacité.

**Identité visuelle :**

- **Palette de couleurs :**
  - Doré (#C9A96E) — élégance, luxe
  - Noir profond (#1A1A1A) — contraste, sobriété
  - Blanc cassé (#F8F6F0) — fonds, légèreté
  - Gris anthracite (#2D2D2D) — textes, éléments secondaires
- **Typographie :**
  - Titres : _Playfair Display_ (serif, caractère raffiné)
  - Corps : _Inter_ (sans-serif, lisibilité moderne)
- **Logo :**
  - Fichier : `public/logo.svg`
  - Description : Cercle doré (#C9A96E) contenant une table ronde vue de dessus avec deux verres à vin, surmontant le texte "GUEST MANAGER" en Playfair Display.
  - Variante favicon : Utilise le même SVG via `<link rel="icon" href="/logo.svg" />`.
- **Iconographie :** Icônes fines de _Lucide React_ (lignes épurées).
- **Atmosphère :** Interface épurée, aérée, avec des ombres douces et des animations subtiles. L’expérience utilisateur doit évoquer la fluidité et la maîtrise.

---

## 🛠 2. Stack Technique (décisions figées)

- **Framework :** Next.js 14+ (App Router) — Server Components et Server Actions.
- **Langage :** TypeScript (strict mode).
- **Base de données & Auth :** Supabase (PostgreSQL) avec Realtime.
- **Styling :** Tailwind CSS + shadcn/ui (composants Radix).
- **État client :** Zustand (persistance locale, mode offline).
- **Génération PDF :** `@react-pdf/renderer`.
- **Gestion de formulaires :** React Hook Form + Zod (validation).
- **Drag & Drop :** `@dnd-kit/core` (pour le placement des tables).

---

## 🗄 3. Modèle de Données (structure Supabase)

_Voir le script SQL complet dans le dossier `/supabase/migrations`._  
Résumé des tables et leurs champs clés :

| Table         | Champs principaux                                                                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`      | `id`, `name`, `event_date`, `location`, `owner_id` (FK → `auth.users`)                                                                                                                                      |
| `zones`       | `id`, `event_id` (FK), `name`                                                                                                                                                                               |
| `tables`      | `id`, `event_id`, `zone_id` (nullable), `name`, `capacity`, `shape` (enum), `is_locked`                                                                                                                     |
| `guests`      | `id`, `event_id`, `table_id` (nullable), `first_name`, `last_name`, `group_id`, `group_name`, `category`, `age_type` (enum), `dietary_notes`, `needs_accessibility`, `is_present`, `checked_in_at`, `notes` |
| `event_staff` | `id`, `event_id`, `user_id` (FK → `auth.users`), `role` ('admin' ou 'host')                                                                                                                                 |

**Enums :** `age_category` ('adult','child','baby'), `table_shape` ('round','rectangular','imperial').

---

## 📋 4. Fonctionnalités détaillées (par module)

### 4.1. Authentification & Gestion des utilisateurs

- **Inscription / Connexion** (email + mot de passe) via Supabase Auth.
- **Rôles :**
  - _Admin_ (organisateur) : tous droits sur l’événement (CRUD complet).
  - _Host_ (hôte d’accueil) : accès en lecture aux données, modification uniquement des champs `is_present`, `checked_in_at` et création d’invités imprévus (_walk-in_).
- **Multi-événements :** Un utilisateur peut être administrateur ou hôte sur plusieurs événements.
- **Déconnexion / récupération de mot de passe** (via Supabase).

### 4.2. Configuration de l’événement

- **Création d’un événement :** nom, date, lieu, description optionnelle.
- **Liste des événements** sur le dashboard (cartes avec métriques, date, statut).
- **Paramètres :** possibilité de modifier les informations générales, d’archiver un événement.

### 4.2.1. Dashboard — Métriques par événement

- **Récupération :** une requête Supabase groupée unique (`SELECT event_id, id, is_present FROM guests WHERE event_id IN (...)`) — Option B, sans cache nécessaire pour < 50 événements.
- **Métriques affichées** sur chaque carte événement :
  - **Total invités** (icône `Users`, couleur anthracite).
  - **Présents** (icône `UserCheck`, couleur verte `#4CAF50`).
  - **Restants** (icône `UserX`, couleur orange `#FF9800`).
- **Barre de progression** (hauteur 6px, coins arrondis) avec code couleur :
  - ≥75 % → vert (`bg-success`)
  - 50–74 % → doré (`bg-gold`)
  - 25–49 % → orange (`bg-warning`)
  - <25 % → rouge (`bg-error`)
- **Pourcentage** affiché en chiffres tabulaires à droite de la barre.
- **État vide :** si l’événement n’a aucun invité, la barre de progression est masquée et les compteurs affichent `0`.
- **Accessibilité :** `role="progressbar"`, `aria-valuenow`, `aria-label` sur la barre.
- **Responsive :** les trois compteurs s’alignent horizontalement avec `flex-wrap` sur mobile.

### 4.3. Gestion des zones (espaces)

- **Création / modification / suppression** de zones (ex : « Salle principale », « Terrasse VIP »).
- **Attribution** d’une zone à chaque table (optionnel).

### 4.4. Gestion des tables

- **CRUD complet :** nom, capacité, forme (ronde, rectangulaire, impériale), zone associée.
- **Verrouillage** (`is_locked`) : une fois verrouillée, la table ne peut plus être modifiée (ni ajout ni retrait d’invités) sans déverrouillage manuel.
- **Indicateurs visuels :**
  - Jauge de remplissage (capacité atteinte / restante).
  - Code couleur : vert (complète), orange (places libres), rouge (surchargée → alerte).
- **Ordre d’affichage** personnalisable (glisser-déposer pour réorganiser l’affichage des tables dans l’interface).

### 4.5. Gestion des invités

- **Types d’entités :**
  - _Singleton_ (invité seul).
  - _Couple_ (deux invités liés par un `group_id` commun).
  - _Groupe / Famille_ (plusieurs invités liés, avec un `group_name` optionnel).
  - _+1 inconnu_ (invité temporaire, modifiable ultérieurement).
- **Champs de l’invité :**
  - Civilité, prénom, nom (obligatoires).
  - Catégorie (libre : « Famille », « VIP », « Collègues », etc.).
  - Tranche d’âge (`adult`, `child`, `baby`).
  - Notes alimentaires (allergies, régimes) — champ texte libre.
  - Besoin d’accessibilité (case à cocher).
  - Notes diverses.
- **Import / Export CSV :**
  - Importation avec mapping des colonnes (pour associer les champs du fichier aux champs de la base).
  - Export CSV de la liste complète (avec tous les champs).
- **Ajout rapide en masse :**
  - Un modal dédié (BulkAddModal) permet d'ajouter plusieurs invités en une seule fois.
  - Champs : Prénom, Nom, Type (Singleton / Couple), Table.
  - Si "Couple" est sélectionné, une ligne partenaire est automatiquement ajoutée.
  - Les couples sont liés par un `group_id` commun avec `group_name = "Couple {nom}"`.
  - Validation Zod : tous les champs obligatoires vérifiés avant envoi.
  - Import CSV intégré (coller du texte ou uploader un fichier, colonnes : prenom,nom,type,table).
  - Insertion batch en une seule requête Supabase.
  - Réinitialisation automatique après succès, rafraîchissement de la liste.
  - Bouton "Ajout rapide" (doré outline) dans la page invités.
- **Recherche et filtres :**
  - Barre de recherche globale (nom, prénom, groupe, table).
  - Filtres par catégorie, tranche d’âge, table, statut de présence.
- **Liaison / déliaison de groupes :**
  - Possibilité de créer un groupe à partir d’invités existants ou de dissocier un invité d’un groupe.
  - Lorsqu’on déplace un membre d’un groupe, l’interface propose de déplacer tout le groupe (optionnel).

### 4.6. Placement (plan de salle)

- **Vue split-screen :**
  - À gauche : liste des invités non placés (avec indicateur de leur groupe), zone de dépôt pour retrait d'une table.
  - À droite : représentation des tables (cartes) avec leurs jauges.
- **Drag & Drop :**
  - Glisser un invité (ou un groupe entier) depuis la liste vers une table.
  - Glisser un invité d'une table à une autre (les invités placés sont également draggables).
  - Possibilité de retirer un invité d'une table (le déposer sur la zone "non placés").
- **Réaffectation avec confirmation :**
  - Lorsqu'un invité déjà placé est glissé vers une autre table, une modale de confirmation s'affiche.
  - Le message indique la table source et la table destination.
  - Si l'invité fait partie d'un groupe, l'utilisateur peut choisir de déplacer tout le groupe ou uniquement l'invité.
  - Un déplacement "seul" génère un avertissement de séparation du groupe.
  - Mise à jour optimiste : l'UI est mise à jour immédiatement, avec rollback en cas d'erreur.
- **Règles de validation :**
  - Capacité maximale : impossible d'ajouter au-delà (alerte visuelle + toast bloquant).
  - Séparation de groupe : si on tente de placer un membre d'un groupe sur une table différente des autres, une alerte s'affiche et propose d'annuler ou de placer tout le groupe.
  - Verrouillage : une table verrouillée ne peut recevoir de modifications (les draggables sont désactivés, toast explicite).
  - Table pleine ou verrouillée : le drop est bloqué avant la confirmation avec un message explicite.
- **Visualisation :**
  - Couleur des tables en fonction du remplissage (vert ≥75%, doré 50-74%, rouge <50%).
  - Affichage du nom de la table, capacité, et liste des invités placés (eux-mêmes draggables).

### 4.7. Interface d’accueil (Front-Desk) — check-in

- **Accessible via une route dédiée** : `/reception/[eventId]`.
- **Design mobile-first / tablette** : boutons larges, typographie lisible, espacement généreux.
- **Barre de recherche prédictive :**
  - Recherche instantanée sur `first_name`, `last_name`, `group_name`, `table.name`.
  - Suggestions affichées en liste.
- **Affichage des invités :**
  - Liste paginée (ou chargement infini) des invités avec leur statut (présent/absent) et leur table.
  - Filtres rapides : par lettre initiale, par table, par statut (présent / absent).
- **Actions de check-in :**
  - Clic sur un singleton → bascule `is_present = true`, enregistre `checked_in_at = NOW()`.
  - Clic sur un groupe → bouton « Valider tout le groupe » qui coche tous les membres du groupe en une fois.
  - Annulation : possibilité de dé-cocher un invité (si erreur).
- **Ajout d’un invité imprévu (_walk-in_) :**
  - Formulaire rapide (prénom, nom, catégorie, tranche d’âge, notes) → l’invité est ajouté à l’événement, attribué à une table choisie (ou laissé non placé), et immédiatement marqué présent.
- **Synchronisation temps réel :**
  - Utilisation de Supabase Realtime : écoute des changements sur la table `guests` (champs `is_present`, `checked_in_at`).
  - Mise à jour automatique de l’interface sur toutes les tablettes connectées.
- **Mode hors-ligne :**
  - Zustand avec persistance locale (IndexedDB ou localStorage).
  - Les check-ins effectués hors ligne sont stockés localement et resynchronisés dès que la connexion revient.
  - Indicateur visuel de l’état de la connexion.

### 4.8. Tableau de bord & statistiques

- **Vue globale** (accessible aux admins) :
  - Nombre total d’invités, nombre de présents, taux d’occupation global.
  - Courbe des arrivées par tranche horaire (pour visualiser l’affluence).
  - Liste des VIP non encore arrivés.
  - Alertes (tables saturées, groupes séparés, etc.).
- **Vue rapide par table :**
  - Mini-cartes des tables avec leur taux de remplissage et les derniers check-ins.

### 4.9. Exports et rapports (PDF + CSV)

- **Master Book (A-Z)** :
  - Liste alphabétique de tous les invités, avec colonnes :
    - Nom, Prénom, Catégorie, Table, Nb d’accompagnants, case à cocher `[ ]` (pour impression papier).
  - Trié par ordre alphabétique.
- **Fiches par table** :
  - Une page PDF par table, avec :
    - En-tête : nom de la table, capacité, zone.
    - Liste des invités (nom + prénom) et, pour chacun, ses besoins (diététique, accessibilité).
  - Idéal pour le dressage de table ou la distribution au service.
- **Synthèse traiteur** :
  - Récapitulatif quantitatif : nombre d’adultes, d’enfants, de bébés.
  - Inventaire des régimes spéciaux et allergies (ex : « Table 3 : 2 végétariens, 1 sans gluten »).
  - Regroupé par table.
- **Export CSV brut** :
  - Tous les champs de la table `guests` (y compris l’heure d’arrivée) pour archivage externe.
- **Liste des tables (version simple)** :
  - Document fonctionnel présentant chaque table avec ses invités (nom, prénom, statut couple/singleton, catégorie, restrictions).
  - Une table par section. Format A4 portrait.
  - Détection automatique des couples (même `group_id`, 2 personnes) et groupes (3+).
  - Colonnes : N°, Nom, Prénom, Statut (Seul/Couple/Groupe), Catégorie, Restrictions, Âge.
  - Tables vides listées en fin de document. Alternance de lignes zébrées.
  - Accès via `/api/reports/[eventId]/table-lists?style=simple`.
- **Liste des tables (version stylisée)** :
  - Document élégant avec encadrements dorés, typographie raffinée.
  - Conçu pour une impression de qualité (affichage à l’entrée, distribution aux invités).
  - Chaque table dans un cadre doré, en-tête "✦ Table {Nom}".
  - Couples affichés sur une même ligne avec "❤️".
  - Groupes de 3+ affichés avec sous-titre "Famille {nom}".
  - Badges dorés pour les restrictions alimentaires.
  - Icône 🔒 sur les tables verrouillées.
  - Dernière page de remerciements.
  - Pied de page "Guest Manager — L'art de recevoir, simplifié."
  - Accès via `/api/reports/[eventId]/table-lists?style=stylized`.
- **Liste des tables en DOCX (version simple)** :
  - Export au format Microsoft Word (.docx) pour modification locale.
  - Mise en page identique à la version simple PDF : tableaux clairs, styles Heading, alternance de lignes.
  - Colonnes : N°, Nom, Prénom, Statut, Catégorie, Restrictions, Âge.
  - Tables vides listées en fin de document.
  - Accès via `/api/reports/[eventId]/table-lists-docx?style=simple`.
- **Liste des tables en DOCX (version stylisée)** :
  - Export au format Microsoft Word (.docx) pour modification locale.
  - Mise en page élégante : bordures dorées, polices Times New Roman pour les titres.
  - Couples affichés sur une même ligne avec "❤️".
  - Badges pour restrictions alimentaires en italique doré.
  - Page de remerciements finale.
  - Accès via `/api/reports/[eventId]/table-lists-docx?style=stylized`.

---

## 🔒 5. Sécurité & Row Level Security (RLS)

- **RLS activée** sur toutes les tables.
- **Politiques :**
  - Un utilisateur ne peut accéder qu’aux événements où il est `owner_id` ou membre de `event_staff`.
  - Un `host` ne peut **modifier** que les colonnes `is_present`, `checked_in_at`, `notes` des invités, et peut créer de nouveaux invités (walk-in). Il ne peut ni supprimer, ni modifier les tables ou les zones.
  - Un `admin` a tous les droits sur les données de l’événement.
- **Création automatique** d’un enregistrement dans `event_staff` pour tout utilisateur invité à collaborer sur un événement.

---

## 🤖 6. Directives pour l’Agent IA (code, commentaires, commits)

- **Référentiel unique :** Avant chaque action ou réponse, l’agent IA **doit** consulter ce fichier `project_info.md` comme miroir des décisions et spécifications. Il ne doit jamais s’en écarter sans validation explicite.
- **Commentaires en français :**
  - Chaque fonction, bloc logique, condition complexe ou algorithme doit être commenté en français, immédiatement après la déclaration ou le bloc.
  - Le commentaire doit expliquer l’intention (pourquoi) et, si nécessaire, le fonctionnement (comment).
  - Exemple :
    ```typescript
    // Récupère les invités d’un événement avec leur table associée
    async function getGuestsWithTables(eventId: string) {
      // On joint la table 'tables' pour obtenir le nom de la table
      // On trie par ordre alphabétique du nom
      const { data, error } = await supabase
        .from("guests")
        .select(`*, tables(name)`)
        .eq("event_id", eventId)
        .order("last_name");
      // ...
    }
    ```

- **Commits :**
  - Aucun commit ne doit être poussé sans validation explicite du chef de projet.
  - Les messages de commit doivent être en français et suivre la convention :  
    `[type] description courte` (ex: `[feat] ajout du CRUD invités`, `[fix] correction synchro Realtime`).
  - Types autorisés : `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.

- **Qualité de code :**
  - TypeScript strict : pas de `any`. Utiliser les types générés par Supabase (`database.types.ts`).
  - Composants : privilégier les Server Components pour le rendu initial, les Client Components (`'use client'`) pour les interactions (formulaires, drag & drop, check-in).
  - Gestion d’erreurs : tous les appels à Supabase doivent être entourés de `try/catch` et retourner des erreurs explicites à l’utilisateur.
  - Accessibilité : utiliser des rôles ARIA, des labels, et garantir un contraste suffisant.
  - **Migrations Supabase** : L’agent IA ne doit **jamais** exécuter les migrations (scripts SQL) sur la base de données Supabase lui-même. Il peut proposer le contenu des migrations, les écrire dans des fichiers `.sql` dans le dossier `supabase/migrations/`, mais leur exécution est réservée à l’humain via le dashboard Supabase ou la CLI. L’agent doit toujours demander une validation avant toute action de migration.

---

## 📂 7. Architecture et arborescence (proposée)

guest-manager/
├── src/
│ ├── app/
│ │ ├── (auth)/
│ │ │ ├── login/
│ │ │ └── register/
│ │ ├── (dashboard)/
│ │ │ ├── page.tsx # Liste des événements
│ │ │ └── event/[eventId]/
│ │ │ ├── page.tsx # Back-office (tabs)
│ │ │ ├── guests/
│ │ │ │ ├── page.tsx # Liste + filtres
│ │ │ │ └── [guestId]/edit # Édition d’un invité
│ │ │ ├── tables/
│ │ │ │ ├── page.tsx # Plan de salle (drag & drop)
│ │ │ │ └── new/ # Création de table
│ │ │ ├── reports/
│ │ │ │ └── page.tsx # Génération PDF/CSV
│ │ │ └── settings/
│ │ │ └── page.tsx # Paramètres événement
│ │ ├── reception/
│ │ │ └── [eventId]/
│ │ │ └── page.tsx # Interface accueil (check-in)
│ │ └── api/
│ │ └── ... # Routes API (ex: exports)
│ ├── components/
│ │ ├── ui/ # Composants shadcn/ui (Button, Card, Input...)
│ │ ├── guests/ # GuestTable, GuestForm, GroupManager...
│ │ ├── tables/ # TableCard, TableGrid, DragDropContainer...
│ │ ├── reception/ # SearchBar, GuestListItem, CheckinActions...
│ │ └── layout/ # Header, Sidebar, Footer
│ ├── lib/
│ │ ├── supabase/
│ │ │ ├── client.ts # Supabase client (browser)
│ │ │ └── server.ts # Supabase client (server)
│ │ ├── store/ # Zustand stores (auth, event, offline-checkin)
│ │ ├── pdf/
│ │ │ ├── masterBook.ts
│ │ │ ├── tableSheets.ts
│ │ │ └── catererSummary.ts
│ │ └── utils.ts # Fonctions helpers
│ └── types/
│ └── database.types.ts # Types générés par Supabase
├── supabase/
│ ├── migrations/ # Scripts SQL
│ └── seed.sql # Données de test
├── public/ # Images, favicon
├── tailwind.config.js
├── next.config.js
└── package.json

```

## 🗺 8. Roadmap indicative (phases)

- **Phase 1 – Foundation**
  - Setup Next.js + Tailwind + shadcn/ui.
  - Connexion à Supabase, génération des types.
  - Schéma SQL et migrations.
  - Authentification (login/register) et RLS.

- **Phase 2 – Back-office (admin)**
  - CRUD événements, zones, tables.
  - CRUD invités (avec import/export CSV).
  - Gestion des groupes (couples/familles).
  - Interface de placement (drag & drop) avec contraintes.

- **Phase 3 – Front-Desk (check-in)**
  - Vue réception (mobile/tablette).
  - Recherche et liste des invités.
  - Actions de check-in (individuel et groupe).
  - Intégration Supabase Realtime.
  - Mode hors-ligne (Zustand + persistance).

- **Phase 4 – Rapports & finalisation**
  - Génération des PDF (Master Book, fiches tables, synthèse traiteur).
  - Export CSV.
  - Tableau de bord statistique.
  - Tests, optimisation, déploiement.

---

*Ce document est vivant ; il évoluera avec le projet. Toute modification devra être discutée et validée en équipe.*

**Fait avec ❤️ pour des réceptions inoubliables.**
```
````
