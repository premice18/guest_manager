# Guest Manager — Guide d'utilisation du Design System

## Principes généraux

- **Cohérence avant tout** : chaque variant existe pour une raison ; ne pas en détourner l'usage.
- **Accessibilité native** : tous les composants respectent les rôles ARIA, le contraste WCAG AA (min 4.5:1 texte normal, 3:1 grand texte), et la navigation clavier.
- **Touch targets ≥ 44px** : toute cible interactive mesure au moins 44×44 px (Android Material Design guideline).
- **Mobile-first** : les composants réagissent via des media queries ou utilitaires Tailwind.

---

## Couleurs

| Token | Usage | Ne PAS utiliser pour |
|-------|-------|----------------------|
| `bg-background` | Fond de page principal | Cartes, modales |
| `bg-card` | Fond des cartes et panneaux | Fond de page |
| `bg-muted` | Zones à faible emphase (sidebar, footer de card) | Actions principales |
| `text-primary` | Texte courant, corps | Titres (utiliser `text-foreground`) |
| `text-muted-foreground` | Labels, descriptions, métadonnées | Texte principal |
| `text-gold` | Accents décoratifs, statut VIP | Texte long (manque de lisibilité) |
| `bg-gold` | Actions principales (bouton default) | Zones de fond larges |
| `border-border` | Bordures standard | Séparations fortes (utiliser Divider) |
| `text-success`/`text-error`/`text-warning` | Statuts sémantiques | Fond de boutons |

### Règle WCAG
- Texte sur fond gold (`#C9A96E`) : utiliser `#1A1A1A` (contraste 9.32:1 ✓)
- Texte sur fond anthracite (`#2D2D2D`) : utiliser `#FFFFFF` (contraste 12.32:1 ✓)
- Texte gold sur fond off-white : réservé aux accents décoratifs, pas pour du contenu

---

## Typographie

| Style | Font | Taille | Poids | Usage |
|-------|------|--------|-------|-------|
| Display 1 | Playfair Display | 3rem / 48px | Bold | Hero, landing page |
| Display 2 | Playfair Display | 2.25rem / 36px | Bold | Titres de page (dashboard) |
| Heading 1 | Playfair Display | 1.875rem / 30px | Semibold | Titres de section |
| Heading 2 | Playfair Display | 1.5rem / 24px | Semibold | Titres de sous-section |
| Heading 3 | Playfair Display | 1.25rem / 20px | Semibold | Titres de carte, modale |
| Subtitle | Inter | 1.125rem / 18px | Medium | Sous-titres, lead |
| Body | Inter | 0.875rem / 14px | Regular | Texte courant |
| Body Small | Inter | 0.8125rem / 13px | Regular | Texte dense, métadonnées |
| Caption | Inter | 0.75rem / 12px | Regular | Légendes, timestamps |
| Label | Inter | 0.8125rem / 13px | Medium | Labels de champ, colonnes |
| Button | Inter | 0.8125rem / 13px | Medium | Texte des boutons |

### Utilisation des fonts avec `next/font`

```tsx
// layout.tsx
import { Inter, Playfair_Display } from "next/font/google"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] })

// Puis dans Tailwind : --font-sans et --font-serif
```

---

## Espacement

Basé sur une échelle 4px × 8px :

| Spacing | Valeur | Usage |
|---------|--------|-------|
| `gap-1` | 4px | Micro espacement (icône-texte, puces) |
| `gap-2` | 8px | Compact (badges, tags) |
| `gap-3` | 12px | Groupes de champs serrés |
| `gap-4` | 16px | Par défaut (entre éléments d'un formulaire) |
| `gap-6` | 24px | Généreux (sections de card) |
| `gap-8` | 32px | Entre sections (h2 → contenu) |
| `gap-12` | 48px | Grandes sections de page |
| `gap-16` | 64px | Entre pages / step |

Règle : toujours utiliser `gap-*` (gap) ou `p-*`/`px-*`/`py-*` (padding) — jamais de margin sauf exceptions documentées.

---

## Ombres

| Shadow | Usage |
|--------|-------|
| `shadow-none` | Éléments plats, contenu dans une card |
| `shadow-xs` | Éléments subtils, cartes empilées |
| `shadow-sm` | Petits composants (tooltip, dropdown) |
| `shadow-md` | Cartes standard ⬅️ PAR DÉFAUT |
| `shadow-lg` | Cartes en surbrillance, sidebar |
| `shadow-xl` | Modales, overlays ⬅️ RÉSERVÉ |
| `shadow-gold` | Éléments en surbrillance dorée (VIP) |
| `shadow-elevated` | Gros overlays, sheets |

---

## Composants primitifs

### Button (existant dans `ui/button.tsx`)

| Variant | Usage | Quand ne PAS utiliser |
|---------|-------|----------------------|
| `default` (gold) | Actions primaires (Créer, Enregistrer, Confirmer) | Actions destructives |
| `secondary` | Actions secondaires (Annuler, Retour) | Action principale unique |
| `outline` | Actions tertiaires, filtres | Confirmation importante |
| `ghost` | Actions dans des zones denses (icônes seules) | Action sans alternative visuelle |
| `destructive` | Suppression, actions irréversibles | Actions non-critiques |
| `link` | Navigations textuelles, "Voir plus" | Actions qui ne naviguent pas |

| Size | Usage |
|------|-------|
| `xs` | Micro-actions (table rows, tags) |
| `sm` | Actions compactes (barre de filtres) |
| `default` | Actions standard (formulaires) ⬅️ PAR DÉFAUT |
| `lg` | Actions hero (CTA landing page) |
| `icon` / `icon-sm` / `icon-lg` | Boutons icône uniquement |

**États** : hover (opacity 80%), active (translate-y-px), focus-visible (gold ring), disabled (opacity 50).

---

### Input (existant dans `ui/input.tsx`)

| Variante d'usage | Token |
|-----------------|-------|
| Normal | `border-border` |
| Focus | `border-gold` + `ring-gold/50` |
| Erreur | `border-destructive` + `ring-destructive/20` |
| Disabled | `bg-muted` + `opacity-50` |

**Pattern** : Toujours utiliser avec `<Label>` et `<p>` d'erreur.
**Touch target** : `h-11` minimum.

---

### Badge (`@/components/ui/badge`)

| Variant | Usage |
|---------|-------|
| `default` | Statut neutre (attente, en cours) |
| `gold` | Statut VIP, premium |
| `success` | Arrivé, confirmé, payé |
| `warning` | En retard, attention |
| `error` | Annulé, problème |
| `info` | Information, note |
| `outline` | Filtres, tags non catégorisés |
| `secondary` | Métadonnées secondaires |

**Accessibilité** : Ajouter une `aria-label` descriptive si le badge est un statut.

---

### Tag (`@/components/ui/tag`)

Usage : Catégories, groupes, mots-clés.
- `removable` : tag avec bouton X (pour filtres actifs, sélections)
- `onRemove` : callback quand X est cliqué

---

### Card (existant dans `ui/card.tsx`)

| Size | Usage |
|------|-------|
| `default` | Cartes de contenu standard |
| `sm` | Cartes compactes (listes, grilles denses) |

**Structure** : `<Card>` → `<CardHeader>` → (`<CardTitle>` + `<CardDescription>` + `<CardAction>`) → `<CardContent>` → `<CardFooter>`.

---

### Avatar

| Size | Diamètre | Usage |
|------|----------|-------|
| `sm` | 32px | Tables, listes, commentaires |
| `md` | 40px | Listes d'invités |
| `lg` | 48px | Profil, cartes |
| `xl` | 64px | Page profil, écran de réception |

Fallback : initiales en blanc sur fond anthracite (`bg-anthracite text-white`).

---

### Spinner

Usage : Chargement, actions en cours.
Toujours accompagner d'un texte `sr-only` ("Chargement...").

---

### Divider

| Variant | Usage |
|---------|-------|
| `default` | Séparation standard |
| `muted` | Séparation subtile |
| `gold` | Séparation décorative |

Orientation `vertical` pour barres d'outils, `horizontal` (défaut) pour sections.

---

### Checkbox / Radio / Toggle

Respecter les conventions :
- Checkbox : sélection multiple, listes, termes
- Radio : sélection unique dans un groupe
- Toggle : activation/désactivation binaire (préférences, visibilité)

---

## Patterns de composition

### Formulaire standard
```tsx
<div className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="name">Nom complet</Label>
    <Input id="name" placeholder="Jean Dupont" />
    <p className="text-xs text-error">Ce champ est requis</p>
  </div>
  <Button>Enregistrer</Button>
</div>
```

### Grille de cartes
```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <Card>...</Card>
  <Card>...</Card>
</div>
```

### Badge sur avatar
```tsx
<div className="relative">
  <Avatar src={url} fallback="JD" />
  <Badge className="absolute -top-1 -right-1 size-4" variant="gold" />
</div>
```

### Message d'état vide
```tsx
<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
  <Users className="size-12 text-muted-foreground" />
  <h3 className="text-lg font-semibold">Aucun invité</h3>
  <p className="text-sm text-muted-foreground">Ajoutez votre premier invité pour commencer.</p>
  <Button>Ajouter un invité</Button>
</div>
```

---

## Conventions de nommage (Figma ↔ React)

| Figma | React | Fichier |
|-------|-------|---------|
| Button/Primary | `<Button variant="default">` | `ui/button.tsx` |
| Button/Secondary | `<Button variant="secondary">` | `ui/button.tsx` |
| Button/Outline | `<Button variant="outline">` | `ui/button.tsx` |
| Button/Ghost | `<Button variant="ghost">` | `ui/button.tsx` |
| Button/Destructive | `<Button variant="destructive">` | `ui/button.tsx` |
| Button/Link | `<Button variant="link">` | `ui/button.tsx` |
| Input/Default | `<Input />` | `ui/input.tsx` |
| Input/Error | `<Input aria-invalid />` | `ui/input.tsx` |
| Card/Default | `<Card>` | `ui/card.tsx` |
| Card/Compact | `<Card size="sm">` | `ui/card.tsx` |
| Badge/Gold | `<Badge variant="gold">` | `ui/badge.tsx` |
| Badge/Success | `<Badge variant="success">` | `ui/badge.tsx` |
| Badge/Error | `<Badge variant="error">` | `ui/badge.tsx` |
| Badge/Warning | `<Badge variant="warning">` | `ui/badge.tsx` |
| Badge/Info | `<Badge variant="info">` | `ui/badge.tsx` |
| Badge/Outline | `<Badge variant="outline">` | `ui/badge.tsx` |
| Tag/Default | `<Tag>` | `ui/tag.tsx` |
| Tag/Removable | `<Tag removable onRemove={fn}>` | `ui/tag.tsx` |
| Avatar/SM | `<Avatar size="sm">` | `ui/avatar.tsx` |
| Avatar/MD | `<Avatar size="md">` | `ui/avatar.tsx` |
| Avatar/LG | `<Avatar size="lg">` | `ui/avatar.tsx` |
| Avatar/XL | `<Avatar size="xl">` | `ui/avatar.tsx` |
| Spinner/Default | `<Spinner />` | `ui/spinner.tsx` |
| Spinner/Gold | `<Spinner variant="gold">` | `ui/spinner.tsx` |
| Toggle/On | `<Toggle checked>` | `ui/toggle.tsx` |
| Toggle/Off | `<Toggle checked={false}>` | `ui/toggle.tsx` |
| Checkbox/Selected | `<Checkbox checked>` | `ui/checkbox.tsx` |
| Checkbox/Empty | `<Checkbox>` | `ui/checkbox.tsx` |
| Checkbox/Indeterminate | `<Checkbox checked="indeterminate">` | `ui/checkbox.tsx` |
| Radio/Selected | `<Radio value="x" checked>` | `ui/radio.tsx` |
| Radio/Empty | `<Radio value="x">` | `ui/radio.tsx` |
| Divider/Horizontal | `<Divider />` | `ui/divider.tsx` |
| Divider/Vertical | `<Divider orientation="vertical">` | `ui/divider.tsx` |
| Divider/With label | `<Divider>ou</Divider>` | `ui/divider.tsx` |

---

## Contribution

Toute modification d'un token doit être faite dans `tokens.json` puis propagée dans :
1. `globals.css` (variables CSS)
2. `tailwind.config.js` ou `@theme inline` (si applicable)
3. Composants concernés

Ces 3 sources doivent TOUJOURS être synchrones.
