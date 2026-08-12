# Guest Manager — project_info.md

## 1. Présentation & Branding

**Nom du projet :** Guest Manager
**Slogan :** _"L'art de recevoir, simplifié."_

**Positionnement :** Application web destinée aux organisateurs d'événements (mariages, galas, soirées d'entreprise) pour gérer l'accueil des invités avec élégance et efficacité.

**Identité visuelle :**

- **Palette de couleurs :**
  - Doré (#C9A96E) — élégance, luxe
  - Noir profond (#1A1A1A) — contraste, sobriété
  - Blanc cassé (#F8F6F0) — fonds, légèreté
  - Gris anthracite (#2D2D2D) — textes, éléments secondaires
- **Typographie :**
  - Titres : _Playfair Display_ (serif, caractère raffiné)
  - Corps : _Inter_ (sans-serif, lisibilité moderne)
- **Iconographie :** Icônes fines de _Lucide React_ (lignes épurées).
- **Atmosphère :** Interface épurée, aérée, avec des ombres douces et des animations subtiles.

---

## 🖼 Logo

- Un symbole minimaliste représentant une table ronde vue de dessus avec deux verres à vin au centre, entourés d'un cercle doré.
- Le nom **"Guest Manager"** en dessous.
- Couleurs : doré (#C9A96E) sur fond sombre, ou inversement.
- **Fichier SVG :** `public/logo.svg` (vectoriel).
- Tests de contrastes et taille tactile conformes WCAG AA (dont `text-deep-black` sur les boutons dorés, ratio 5.2:1).

---

## 🛠 2. Stack Technique

- **Framework :** Next.js 16 (App Router) — Server Components et Server Actions.
- **Langage :** TypeScript (strict mode, `tsc --noEmit` sans erreur).
- **Base de données & Auth :** Supabase (PostgreSQL) avec Realtime et RLS.
- **Styling :** Tailwind CSS v4 + design system custom.
- **État client :** Zustand (persistance locale, mode offline).
- **Génération PDF :** `@react-pdf/renderer`.
- **Génération DOCX :** `docx`.
- **Gestion de formulaires :** React Hook Form + Zod.
- **Drag & Drop :** `@dnd-kit/core` (placement des tables).
- **Animations :** Framer Motion (avec `useReducedMotion()`).
- **Files & middleware :** `src/proxy.ts` (Next.js 16).
- **PWA :** manifest (`src/app/manifest.ts`), service worker (`public/sw.js`), icônes générées.

---

## 🗄 3. Modèle de Données (Supabase)

_Voir le SQL dans `/supabase/migrations`._  
Enums : `age_category` ('adult','child','baby'), `table_shape` ('round','rectangular','imperial').

| Table         | Champs principaux                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `events`      | `id`, `name`, `event_date`, `location`, `description`, `owner_id` (→ `auth.users`), `is_archived`                                        |
| `zones`       | `id`, `event_id`, `name`                                                                                                                 |
| `tables`      | `id`, `event_id`, `zone_id` (nullable), `name`, `capacity`, `shape` (enum), `is_locked`, `sort_order`                                    |
| `guests`      | `id`, `event_id`, `table_id` (nullable), `first_name`, `last_name`, `group_id`, `group_name`, `category`, `age_type`, `dietary_notes`, `needs_accessibility`, `is_present`, `checked_in_at`, `notes`, `guest_count` (≥1, défaut 1 : un invité peut « compter pour plusieurs ») |

**Remarque (champs masqués)** : `age_type` (tranche d'âge) et `dietary_notes` (notes alimentaires) sont **conservés en base** mais **masqués dans l'interface et les exports courants** (formulaires, liste, CSV, master-book, fiches tables). Seule la synthèse traiteur (catering-summary) continue de s'appuyer sur `dietary_notes` et la répartition par âge. En création/édition, `age_type` est fixé à `'adult'` par défaut et `dietary_notes` reste vide (l'existant est préservé).
| `event_staff` | `id`, `event_id`, `user_id` (→ `auth.users`), `role` ('admin' ou 'host')                                                                |

**Types Supabase** : `src/types/database.types.ts` (générés manuellement, comprenant les relations FK pour les jointures typées).

---

## 📋 4. Fonctionnalités (par module)

- **Authentification** : inscription, connexion (avec redirect sécurisé), mot de passe oublié / réinitialisation, déconnexion, profil utilisateur (3 onglets, avatar, sécurité avec indicateur de force de mot de passe).
- **Dashboard** : liste des événements, statut calculé selon le fuseau horaire du navigateur, métriques de présence, archivage.
- **Événement** : page d'accueil avec statistiques, configuration des zones et tables, verrouillage des tables.
- **Invités** : liste, filtres, ajout/édition, import CSV (avec mapping de colonnes), ajout groupé (avec contrôle de capacité des tables), groupes, **nombre de personnes par invité** (`guest_count` : badge `xN` dans la liste, champ dédié dans le formulaire, colonne `Nombres` à l'export CSV, parsing à l'import).
- **Placement** : plan de salle drag & drop, respect de la capacité (**en personnes** : somme des `guest_count`, individuellement et par groupe), tables verrouillées (aucun mouvement entrant/sortant), badge `xN` sur les cartes d'invité.
- **Réception / check-in** : check-in individuel et groupé, mode hors-ligne avec synchronisation, walk-in, recherche.
- **Statistiques** : graphiques Recharts (lazy-loaded).
- **Exports** : CSV (protection anti-injection), PDF (master-book, table-sheets, table-lists, catering-summary avec head counts présents/invités) et DOCX.

---

## 📂 5. Architecture & arborescence

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx   # Réinit mot de passe (demande)
│   │   ├── reset-password/page.tsx    # Réinit mot de passe (nouveau mdp)
│   │   └── auth/callback/route.ts
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # (racine pass-through)
│   │   ├── dashboard/
│   │   │   ├── page.tsx               # Mes événements
│   │   │   ├── create/page.tsx        # Création événement
│   │   │   ├── archived/page.tsx      # Événements archivés
│   │   │   └── profile/page.tsx       # Profil utilisateur
│   │   └── event/[eventId]/
│   │       ├── layout.tsx             # Garde d'accès (requireEventAccess)
│   │       ├── page.tsx               # Détail événement
│   │       ├── guests/page.tsx        # Gestion invités
│   │       ├── tables/page.tsx        # Gestion tables
│   │       ├── placement/page.tsx     # Plan de salle DnD
│   │       ├── dashboard/page.tsx     # Statistiques
│   │       ├── reports/page.tsx       # Exports PDF/DOCX
│   │       └── settings/page.tsx      # Paramètres + zones
│   ├── (reception)/
│   │   └── reception/[eventId]/page.tsx # Check-in
│   ├── api/reports/[eventId]/
│   │   ├── master-book/route.tsx
│   │   ├── table-sheets/route.tsx
│   │   ├── catering-summary/route.tsx
│   │   ├── csv/route.ts
│   │   ├── table-lists/route.tsx
│   │   └── table-lists-docx/route.tsx
│   ├── error.tsx                      # Boundary d'erreur brandée
│   ├── loading.tsx                    # Écran de chargement brandé
│   ├── not-found.tsx                  # Page 404 brandée
│   ├── page.tsx                       # Landing page
│   └── layout.tsx                     # Layout racine
├── components/
│   ├── ui/                            # Primitives design system
│   ├── event/event-status-badge.tsx   # Statut événement côté client (fuseau)
│   ├── reception/stat-panel.tsx       # Panneau de stats (check-in)
│   ├── pwa/register-service-worker.tsx # Enregistrement SW (prod)
│   └── ...
├── lib/
│   ├── auth.ts                        # requireUser, requireEventAccess, AuthError
│   ├── dal/events.ts, guests.ts, tables.ts
│   ├── utils.ts, supabase/, pdf/, docx/, store/, hooks/
├── proxy.ts                            # Middleware Next.js 16
└── types/database.types.ts            # Types Supabase
```

---

## 🗺 6. Roadmap

1. **Phase 1 – Foundation** ✅
2. **Phase 2 – Back-office** ✅
3. **Phase 3 – Front-Desk** ✅
4. **Phase 4 – Exports** ✅
5. **Phase 5 – Audit & Corrections** ✅ (corrections A1–A10 et B1–B6 terminées)
6. **Phase 6 – Optimisations** ⏳ (en cours : PWA ✅, refactor réception, sélecteurs uniformisés, documentation, **mode sombre/clair unifié ✅, tri alphabétique des invités ✅, invités « comptant pour plusieurs » (`guest_count`) ✅**)

---

## 📝 6bis. Audit UX/UI — Corrections mode sombre/clair & tri

### Mode sombre/clair (unifié)
- **Socle thème** : hook `src/lib/hooks/use-theme.ts` (lecture/écriture `localStorage 'theme'`, synchronisation inter-onglets, application de la classe `.dark`, animation de transition `theme-anim`), toggle `src/components/theme/theme-toggle.tsx`.
- **Transitions** : règles CSS `html.theme-anim *` dans `globals.css` (durée 300ms, désactivées via `prefers-reduced-motion`), transition de base sur `body`.
- **Tokens sémantiques** : remplacement des couleurs `bg-white`/`text-deep-black`/`bg-anthracite text-white` par `bg-card`, `text-foreground`, `bg-popover`, `bg-muted`, etc. (dashboard, guests, tables, placement, reports, reception, landing, error/loading/404, UI primitives).
- **Graphiques Recharts** : `src/lib/charts/colors.ts` lit les variables CSS via `getComputedStyle` (hook `useChartColors`) ; tooltips sur `bg-popover`.
- **Toaster sonner** : suit le thème de l'application (plus `theme="system"`).
- **Toggle de thème** : présent dans le header du dashboard et la landing ; le sélecteur du profil (Préférences) applique le thème immédiatement.
- Contrastes : textes dorés réservés au branding ; tout texte courant passe par `text-foreground` / `text-muted-foreground` (≥ 4.5:1).

### Tri alphabétique invités (`/event/[id]/guests`)
- Tri client par **Nom, Prénom, Table, Statut** avec sens A→Z/Z→A (bouton dédié).
- Appliqué **en plus** des filtres (recherche, statut, âge, table), par défaut **Nom A→Z**.
- Persistance dans `localStorage` (`gm-sort-field`, `gm-sort-dir`) ; accessible clavier (select natif + bouton).

---

## 🚶 Parcours utilisateur A→Z

1. **Inscription / connexion** — création de compte (`/register`) ou connexion (`/login`), avec réinitialisation du mot de passe (`/forgot-password` → `/reset-password`). Redirect sécurisé post-login.
2. **Création d'un événement** — depuis le dashboard, formulaire (nom, date, lieu, description) ; l'événement apparaît avec un statut calculé selon le fuseau horaire du navigateur.
3. **Configuration de la salle** — création des zones et tables (capacité, forme), verrouillage des tables pour figer le placement.
4. **Gestion des invités** — ajout individuel, ajout groupé (avec contrôle de capacité), import CSV (mapping de colonnes), édition, groupes ; filtres par statut/âge/table avec pagination.
5. **Placement des tables** — plan de salle drag & drop (`@dnd-kit`), respect des capacités individuelle et par groupe, tables verrouillées immuables.
6. **Jour J : réception / check-in** — recherche rapide d'un invité, check-in individuel et groupé, walk-in (ajout sur place), mode hors-ligne avec synchronisation (Zustand), raccourcis clavier, statistiques de présence en temps réel.
7. **Rapports & exports** — PDF (master-book, table-sheets, table-lists, catering-summary) et DOCX (table-lists), CSV protégé anti-injection.
8. **Archivage** — les événements terminés peuvent être archivés et consultés dans la section dédiée.

---

## 🔐 PWA (Installation & Hors-ligne)

- **Manifest** : `src/app/manifest.ts` (route `/manifest.webmanifest` générée par Next.js) — `start_url: "/dashboard"`, `display: "standalone"`, `background_color: "#1A1A1A"`, `theme_color: "#C9A96E"`.
- **Icônes** : `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png` (générées depuis `public/logo.svg` via sharp).
- **Service Worker** : `public/sw.js` (version `guest-manager-v1`) — réseau d'abord pour les navigations (données dynamiques + RLS), *stale-while-revalidate* pour les assets statiques, handlers `push` et `notificationclick` prêts (activation VAPID à venir).
- **Enregistrement** : `src/components/pwa/register-service-worker.tsx`, uniquement en production.
- **Headers** : `/sw.js` servie avec `Service-Worker-Allowed: /` et `Cache-Control: no-cache` (`next.config.ts`).
- **Installation** : l'app est installable sur Android/iOS/Desktop via le bouton « Ajouter à l'écran d'accueil ».

---

## 🔒 7. Sécurité & RLS

- **RLS activée** sur toutes les tables (events, zones, tables, guests, event_staff), via fonctions `SECURITY DEFINER` (`is_owner_of_event`, `is_staff_of_event`, `is_admin_of_event`).
- Lecture : propriétaire ou membre du staff. Écriture métadonnées : propriétaire/admin. Hôtes : inscription d'invités, mise à jour restreinte (présence / heure / notes).
- **Contrôle serveur** : `requireEventAccess` appliqué sur toutes les pages d'un événement (layout) et sur chaque route API de rapport, avec garde anti-open-redirect sur le login et protection CSV (OWASP).
- Les migrations sont exécutées manuellement (jamais par l'agent).

---

## 🤖 8. Directives pour l'Agent IA

- **Référentiel unique :** consulter ce fichier avant chaque action ; ne pas s'en écarter sans validation.
- **Commentaires en français** sur chaque fonction et bloc logique (expliquer l'intention).
- **Commits :** aucun commit sans validation explicite. Messages en français, format `[type] description courte`.
- **Qualité de code :** TypeScript strict (pas d'`any`), Server Components par défaut, `'use client'` pour l'interaction, `tsc --noEmit` + `eslint` sans erreur avant validation.
- **Accessibilité :** `aria-label` sur les boutons icône, `useId()` pour les dialogs, `useReducedMotion()` pour toute animation.
- **Formulaires :** React Hook Form + Zod.
- **Migrations :** proposer des fichiers `.sql` uniquement ; l'exécution est réservée à l'humain.

---

_Ce document est vivant ; il évoluera avec le projet._

**Fait avec ❤️ pour des réceptions inoubliables.**