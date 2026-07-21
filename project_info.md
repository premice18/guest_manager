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
- **Atmosphère :** Interface épurée, aérée, avec des ombres douces et des animations subtiles. L'expérience utilisateur doit évoquer la fluidité et la maîtrise.

---

## 🖼 Logo

**Description :**

- Un symbole minimaliste représentant une table ronde vue de dessus avec deux verres à vin au centre, entourés d'un cercle doré.
- Le nom **"Guest Manager"** en dessous.
- Couleurs : doré (#C9A96E) sur fond sombre pour l'en‑tête, ou inversement.

**Fichier SVG :** `public/logo.svg` (vectoriel).

**Contraintes :**

- ⚠️ Le texte "GUEST MANAGER" dans le SVG utilise `font-family="Playfair Display"` qui **n'est pas chargée** dans le contexte SVG. Les navigateurs utiliseront le fallback serif générique.  
  **Solution :** Convertir le texte en paths vectoriels (ou utiliser `font-family="system-ui, serif"` avec un fallback).
- 🚨 **Pas de version dark mode** — Créer `logo-dark.svg` (fond `#1A1A1A`, texte `#F8F6F0`, cercle doré) et l'intégrer avec `media="(prefers-color-scheme: dark)"` dans `layout.tsx`.
- ℹ️ Supprimer les fichiers boilerplate inutiles : `next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg` qui traînent dans `public/`.

---

## 🛠 2. Stack Technique (décisions figées)

- **Framework :** Next.js 16 (App Router) — Server Components et Server Actions.
- **Langage :** TypeScript (strict mode).
- **Base de données & Auth :** Supabase (PostgreSQL) avec Realtime.
- **Styling :** Tailwind CSS v4 + Design system custom (`@base-ui/react`).
- **État client :** Zustand (persistance locale, mode offline).
- **Génération PDF :** `@react-pdf/renderer`.
- **Génération DOCX :** `docx` (npm).
- **Gestion de formulaires :** React Hook Form + Zod (validation).
- **Drag & Drop :** `@dnd-kit/core` (pour le placement des tables).
- **Animations :** Framer Motion (avec `useReducedMotion()` obligatoire).
- **Proxies / Middleware :** `src/proxy.ts` (Next.js 16 pattern, pas de `middleware.ts`).

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

_(Conserver toutes les sections existantes : 4.1 à 4.9 — Authentification, Configuration, Zones, Tables, Invités, Placement, Check‑in, Statistiques, Exports)_

---

## 🎨 5. Audit UX/UI & Directives de Qualité (AJOUT CRITIQUE)

### 5.1. Audit global – État des lieux

**Note globale UX/UI :** 3.5/10 — « Amateur avec des ambitions pro, mais ça sonne creux »

**Problèmes critiques (12) :** à corriger en priorité (Phase 1 – cette semaine)  
**Problèmes majeurs (22) :** à corriger dans le mois (Phase 2)  
**Problèmes mineurs (18) :** à améliorer progressivement (Phase 3)

---

### 5.2. Phase 1 — Corrections CRITIQUES (🚨) — À faire avant toute nouvelle fonctionnalité

| #   | Élément                           | Problème                                                                                                                        | Action requise                                                                                                                                                                                   |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Sonner (toasts)**               | `--popover` et `--popover-foreground` indéfinis → toasts invisibles (background transparent)                                    | Ajouter dans `globals.css` : `:root { --popover: #ffffff; --popover-foreground: #2D2D2D; } .dark { --popover: #1e1e1e; --popover-foreground: #e5e5e5; }`                                         |
| 2   | **Bouton gold**                   | Texte blanc sur fond gold → ratio de contraste 2.8:1 (échec WCAG AA)                                                            | Remplacer `text-white` par `text-deep-black` (#1A1A1A) sur tous les boutons de variant `default`. Ratio 5.2:1 ✅                                                                                 |
| 3   | **`--text-secondary`**            | Ratio 3.7:1 sur fond `#F8F6F0` → échec WCAG AA                                                                                  | Passer de `#6b6b6b` à `#505050` (ratio 4.5:1)                                                                                                                                                    |
| 4   | **`prefers-reduced-motion`**      | Framer Motion ignore la media query → utilisateurs sensibles subissent toutes les animations                                    | Ajouter `import { useReducedMotion } from "framer-motion"` et conditionner les animations dans chaque composant. Vérifier `prefersReducedMotion` avant d'appliquer des `spring` ou `transition`. |
| 5   | **`id="dialog-title"`**           | Hardcodé → si 2 dialogs sur la même page, conflit d'ID → ARIA cassé                                                             | Remplacer par `const titleId = React.useId()` et passer `id={titleId}`. Utiliser `useId()` dans tous les composants dialog.                                                                      |
| 6   | **`next/font` contourné**         | `--font-sans` et `--font-serif` définis avec des chaînes dures au lieu de `var(--font-inter)` et `var(--font-playfair-display)` | Corriger `@theme inline` dans `globals.css` : `--font-sans: var(--font-inter), ui-sans-serif, ...;` et `--font-serif: var(--font-playfair-display), ...;`                                        |
| 7   | **`--input` variable**            | Utilisée dans `button.tsx` (dark mode) mais jamais définie                                                                      | Ajouter dans `:root` : `--input: #d1d5db;` et dans `.dark` : `--input: #374151;`                                                                                                                 |
| 8   | **Tableau invités (mobile)**      | Colonnes masquées sur mobile, pas de scroll horizontal                                                                          | Ajouter `overflow-x-auto` sur le conteneur `<div className="overflow-x-auto">`. Sur mobile, utiliser des cartes horizontales au lieu d'un tableau si nécessaire.                                 |
| 9   | **Framer Motion – coût**          | Spring physics partout → lourd pour les mobiles                                                                                 | Préférer `tween` avec `ease: [0.4, 0, 0.2, 1]` (Material Design). Réduire les animations sur mobile avec `useReducedMotion()`.                                                                   |
| 10  | **Couleurs Recharts**             | Codées en dur (`#C9A96E`, `#f0f0f0`) → ne répondent pas au dark mode                                                            | Centraliser dans un fichier de constantes qui lit les CSS custom properties via `getComputedStyle()`, ou exposer des variables CSS au contexte Recharts.                                         |
| 11  | **Boutons icône sans aria-label** | `<Button size="icon"><Edit /></Button>` n'a pas de label accessible                                                             | Ajouter `aria-label="Modifier"` sur tous les boutons icône. Vérifier aussi `aria-label` sur les boutons de suppression et d'ajout.                                                               |
| 12  | **Fichiers boilerplate**          | `next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg` dans `public/`                                                  | Supprimer ces 5 fichiers inutiles (18KB de déchets).                                                                                                                                             |

---

### 5.3. Phase 2 — Problèmes IMPORTANTS (⚠️) — À corriger dans le mois

| #   | Élément                     | Action requise                                                                                                                                                         |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | **Skeleton screens**        | Ajouter des squelettes pour toutes les pages client (guests, tables, stats, reception) au lieu des spinners ou écrans vides.                                           |
| 14  | **Navigation latérale**     | Ajouter un sidebar ou top nav dans l'espace événement avec les 6 sections (Invités, Tables, Plan, Stats, Rapports, Paramètres). L'utilisateur doit naviguer en 1 clic. |
| 15  | **Breadcrumbs**             | Implémenter sur toutes les pages profondes (`/event/[id]/guests`, `/event/[id]/placement`, etc.) pour montrer le chemin : `Dashboard > Mon Événement > Invités`.       |
| 16  | **Password strength meter** | Ajouter un indicateur de force sur la page d'inscription et le changement de mot de passe (profil > sécurité).                                                         |
| 17  | **Profile form**            | Refactoriser le formulaire de profil (3 onglets, 722 lignes) avec `react-hook-form` + `zod` au lieu de `useState` pur. Ajouter validation et gestion d'erreur.         |
| 18  | **Guest modal**             | Refactoriser le modal d'ajout/édition d'invité avec `react-hook-form` + `zod` au lieu de `useState` manuel.                                                            |
| 19  | **Lazy-load Recharts**      | Utiliser `next/dynamic` avec `ssr: false` pour la page des statistiques (économie ~150KB).                                                                             |
| 20  | **Lazy-load dnd-kit**       | Utiliser `next/dynamic` pour la page placement (économie ~40KB).                                                                                                       |
| 21  | **Sticky header table**     | Ajouter `position: sticky; top: 0; z-index: 10;` sur `<thead>` pour que l'en-tête reste visible en scroll.                                                             |
| 22  | **Color tokens unifiés**    | Centraliser les couleurs des exports PDF dans un fichier partagé (ne pas dupliquer `#C9A96E` 8+ fois).                                                                 |
| 23  | **Logo dark mode**          | Créer `logo-dark.svg` et l'intégrer avec favicon dark.                                                                                                                 |
| 24  | **Recharts accessibles**    | Ajouter `role="img"`, `aria-label`, et des descriptions textuelles cachées (`.sr-only`) pour chaque graphique.                                                         |

---

### 5.4. Phase 3 — Améliorations (ℹ️) — À faire progressivement

- Refactorer la page `reception` (1524 lignes) en 5‑6 composants séparés.
- Refactorer la page `guests` (1093 lignes) en composants modulaires.
- Uniformiser les sélecteurs : remplacer tous les `<select>` natifs par le composant `<Select>` custom accessible.
- Ajouter une page 404 personnalisée avec le branding (gold, Playfair Display).
- Remplacer toutes les animations `spring` par `tween` avec un easing custom pour plus de cohérence.
- Vérifier que tous les éléments interactifs ont une taille de cible tactile ≥ 44px (Apple HIG) et ≥ 48px (Material Design) sur mobile.
- Ajouter un `preconnect` pour les polices Google (même avec `next/font`).
- Tester avec des utilisateurs naïfs pour identifier les frictions.

---

### 5.5. Directives permanentes pour l'Agent IA

- **Avant d'ajouter une nouvelle fonctionnalité** : vérifier que tous les items Phase 1 sont corrigés.
- **Lors du développement** : utiliser `useReducedMotion()` pour chaque composant animé (Framer Motion). Conditionner les animations : `const prefersReducedMotion = useReducedMotion();`.
- **Pour les couleurs** : préférer les CSS custom properties (`var(--gold)`) aux valeurs hexadécimales en dur. Centraliser les couleurs utilisées dans les graphiques Recharts.
- **Pour l'accessibilité** : ajouter systématiquement des `aria-label` sur les boutons icône, `aria-describedby` sur les champs en erreur, et des IDs générés avec `useId()` pour les dialogs.
- **Pour les formulaires** : utiliser `react-hook-form` + `zod` pour tous les nouveaux formulaires, et refactoriser progressivement les existants.
- **Pour le responsive** : tester sur mobile (iPhone SE, 320px) avant de pousser. S'assurer que les tableaux sont scrollables et que les zones tactiles sont ≥ 44px.
- **Pour le loading** : préférer les squelettes (skeleton screens) aux spinners. Les squelettes améliorent la perception de performance de 300%.

---

## 📂 6. Architecture et arborescence (proposée)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── auth/callback/route.ts
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx          # Mes événements
│   │   │   ├── create/page.tsx   # Création événement
│   │   │   ├── archived/page.tsx # Événements archivés
│   │   │   └── profile/page.tsx  # Profil utilisateur
│   │   └── event/[eventId]/
│   │       ├── page.tsx          # Détail événement
│   │       ├── guests/page.tsx   # Gestion invités
│   │       ├── tables/page.tsx   # Gestion tables
│   │       ├── placement/page.tsx # Plan de salle DnD
│   │       ├── dashboard/page.tsx # Statistiques
│   │       ├── reports/page.tsx  # Exports PDF/DOCX
│   │       └── settings/page.tsx # Paramètres + zones
│   ├── (reception)/
│   │   └── reception/[eventId]/page.tsx # Check-in
│   ├── api/reports/[eventId]/
│   │   ├── master-book/route.ts
│   │   ├── table-sheets/route.ts
│   │   ├── catering-summary/route.ts
│   │   ├── csv/route.ts
│   │   ├── table-lists/route.ts
│   │   └── table-lists-docx/route.ts
│   ├── page.tsx                  # Landing page
│   └── layout.tsx                # Layout racine
├── components/
│   ├── ui/                       # 17 primitives design system
│   │   ├── button.tsx, card.tsx, dialog.tsx, input.tsx,
│   │   ├── textarea.tsx, select.tsx, checkbox.tsx,
│   │   ├── radio.tsx, toggle.tsx, badge.tsx, tag.tsx,
│   │   ├── avatar.tsx, tooltip.tsx, spinner.tsx,
│   │   ├── sonner.tsx, divider.tsx, label.tsx
│   │   └── ...
│   └── (components métier à isoler)
├── lib/
│   ├── dal/                      # Data Access Layer
│   │   ├── events.ts, guests.ts, tables.ts
│   ├── auth.ts                   # Helpers authentification
│   ├── utils.ts                  # Fonctions utilitaires
│   ├── pdf/                      # Templates PDF
│   ├── docx/                     # Générateurs DOCX
│   ├── supabase/                 # Clients Supabase
│   │   ├── client.ts, server.ts, admin.ts (si existant)
│   ├── store/                    # Zustand stores
│   ├── hooks/                    # Custom hooks
│   └── design-tokens/            # tokens.json + usage-guide.md
├── proxy.ts                      # Middleware Next.js 16
└── types/
    └── database.types.ts         # Types Supabase générés
```

---

## 🗺 7. Roadmap (phases de développement)

1. **Phase 1 – Foundation** ✅ (terminé)
2. **Phase 2 – Back-office** ✅ (terminé)
3. **Phase 3 – Front-Desk** ✅ (terminé)
4. **Phase 4 – Exports** ✅ (terminé)
5. **Phase 5 – Audit & Corrections** ⏳ _(en cours)_
   - Corriger les 12 items Phase 1 (critiques)
   - Corriger les 12 items Phase 2 (importants)
   - Mise en production
6. **Phase 6 – Optimisations** (post‑production)
   - Refactorisations, tests utilisateurs, documentation

---

## 🔒 8. Sécurité & RLS

_(Conserver les politiques existantes)_

---

## 🤖 9. Directives pour l'Agent IA (code, commentaires, commits)

- **Référentiel unique :** Avant chaque action ou réponse, l'agent IA **doit** consulter ce fichier `project_info.md` comme miroir des décisions et spécifications. Il ne doit jamais s'en écarter sans validation explicite.
- **Commentaires en français :** Chaque fonction, bloc logique, condition complexe doit être commenté en français, immédiatement après la déclaration ou le bloc. Le commentaire doit expliquer l'intention (pourquoi) et, si nécessaire, le fonctionnement (comment).
- **Commits :** Aucun commit sans validation explicite. Messages en français, convention `[type] description courte`.
- **Qualité de code :** TypeScript strict (pas de `any`). Server Components par défaut, Client Components (`'use client'`) pour l'interaction.
- **Migrations Supabase :** L'agent ne doit **jamais** exécuter les migrations lui‑même. Il peut proposer des fichiers `.sql` dans `supabase/migrations/`, mais l'exécution est réservée à l'humain.

---

## 📌 10. Audit UX/UI – Résumé des points critiques (référence rapide)

| Priorité | Élément             | Action                                        |
| -------- | ------------------- | --------------------------------------------- |
| 🚨       | Sonner              | Définir `--popover` et `--popover-foreground` |
| 🚨       | Contraste gold      | Texte des boutons → `text-deep-black`         |
| 🚨       | `--text-secondary`  | Passer à `#505050`                            |
| 🚨       | Reduced motion      | Ajouter `useReducedMotion()` partout          |
| 🚨       | `id="dialog-title"` | Remplacer par `useId()`                       |
| 🚨       | `next/font`         | Utiliser `var(--font-inter)`                  |
| 🚨       | `--input`           | Définir dans `:root` et `.dark`               |
| 🚨       | Table mobile        | Ajouter `overflow-x-auto`                     |
| 🚨       | Recharts            | Couleurs centralisées                         |
| 🚨       | Aria-label          | Ajouter sur boutons icône                     |
| ⚠️       | Skeleton screens    | Ajouter pour toutes les pages client          |
| ⚠️       | Navigation latérale | Sidebar dans l'espace événement               |

---

_Ce document est vivant ; il évoluera avec le projet. Toute modification devra être discutée et validée en équipe._

**Fait avec ❤️ pour des réceptions inoubliables.**
