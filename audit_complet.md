# 🚨 AUDIT COMPLET DU PROJET - GUEST MANAGER

**Date :** 8 août 2026
**Auditeur :** AI Senior Expert (15+ ans expérience)
**Note globale :** 6/10

***

## 📊 RÉSUMÉ GLOBAL

### Note : 6/10
- **Critique :** 3 problèmes 🚨
- **Majeur :** 12 problèmes ⚠️
- **Mineur :** 14 problèmes ℹ️

### Top 3 Problèmes Urgents (à corriger IMMÉDIATEMENT)
1. **Session refresh cassé dans le proxy** (`src/proxy.ts:43-50`) - 🚨 Critique. Les cookies de rafraîchissement Supabase sont écrits sur la **requête** et jamais propagés à la **réponse** → rotation des refresh tokens perdue → déconnexion silencieuse ~1h après expiration de l'access token.
2. **Rate-limiting dangereux et contournable** (`src/proxy.ts:7-28`) - 🚨 Critique. `Map` en mémoire locale à chaque instance (contournable en multi-instance), `x-forwarded-for` falsifiable, **aucune purge mémoire** → fuite mémoire/DoS + blocage de vrais utilisateurs.
3. **Service Worker jamais enregistré** (`src/components/pwa/register-service-worker.tsx:20`) - 🚨 Critique fonctionnel. `document.addEventListener("load", ...)`: l'événement `load` est émis sur `window`, **jamais sur `document`** → le listener ne se déclenche jamais → la PWA/le cache hors-ligne ne s'activent pas.

### Top 3 Forces du Projet
1. **Modèle d'autorisation en base très solide** - RLS active sur les 5 tables, fonctions `SECURITY DEFINER` scopées avec `SET search_path = public`, triggers de capacité/verrouillage sérialisés `FOR UPDATE`. L'architecture de permissions owner/admin/host est cohérente et pensée au niveau DB.
2. **Défense en profondeur cross-event** - `event_id` immuable (`zz_guests_event_id_guard`), host-guard testant OLD et NEW, garde `owner_id`. Les correctifs de l'audit précédent (20260810) ont réellement colmaté des failles.
3. **Protection de la PII** - le store Zustand ne persiste **pas** les données invités (régimes, allergies, notes) en localStorage, l'injection CSV est neutralisée (OWASP), `isSafeRedirect` appliqué partout.

***

## 1. 🏗️ ARCHITECTURE GLOBALE

### État actuel
App Router Next.js 16 (Server Components + proxy), backend = Supabase (PostgreSQL + Auth + Realtime). Séparation propre : pages dans `src/app`, logique dans `src/lib` (auth, dal, store, hooks, pdf, docx), migrations SQL versionnées. Pattern : monolithe feature-based avec une couche DAL — correct et lisible pour ce scope.

### Problèmes identifiés
- ⚠️ **[Proxy appliqué à tout le trafic]** `src/proxy.ts:53` fait `supabase.auth.getUser()` sur **chaque** requête (même les API et assets non exclus par le matcher). Coût réseau par requête + rate-limit sur des routes publiques.
- ⚠️ **[Double requête par page événement]** `event/[eventId]/layout.tsx:16` appelle `requireEventAccess` (SELECT events) puis `event/[eventId]/page.tsx:35` appelle `getEventById` (SELECT events identique). Deux allers-retours réseau pour la même donnée.
- ⚠️ **[Garde d'accès de la réception entièrement côté client]** `reception/[eventId]/page.tsx:184-201` : la protection est une redirection JS après fetch. La vraie barrière est la RLS, mais la vérification serveur n'existe pas sur cette route (contrairement aux pages `/event/**`).
- ⚠️ **[Bug fonctionnel : dashboard invisible pour les staff]** `dashboard/page.tsx:92` et `archived/page.tsx:29` filtrent `events` par `.eq("owner_id", user.id)` alors que la RLS `events_select_policy` autorise aussi `is_staff_of_event(event.id)`. Un **host ou admin non-propriétaire ne verra jamais l'événement où il est invité dans son dashboard**.
- ℹ️ **[Code mort]** `src/lib/dal/events.ts:14-23` (`getUserEvents`), `src/lib/dal/guests.ts:3-43` (`getGuestsByEvent`, `getGuestCountsByEvents`, `getGuestsByTable`) sont **inutilisés**. Aucune détection automatique en CI.
- ℹ️ **[Documentation en léger retard]** `docs/security.md` ne documente pas (ou incomplètement) les triggers ajoutés le 20260810 (`zz_guests_event_id_guard`, `zz_events_owner_id_guard`).

### Recommandations
1. Corriger le filtrage du dashboard : `.or(`owner_id.eq.${user.id},id.in.(${staffEventIds})`)` ou une fonction RPC `list_my_events()` qui combine ownership + staff.
2. Utiliser `cache()` de React pour partager la requête événement entre layout et page (1 seul SELECT par requête réseau).
3. Définir une vraie garde serveur pour `/reception/[eventId]` (comme dans le layout `event/[eventId]`) — via un route layout avec `requireEventAccess(eventId, "any")`.
4. Supprimer ou annoter le code mort du DAL ; ajouter un script de détection (eslint no-unused + grep CI).

### Exemple de code corrigé
```tsx
// Avant (mauvais) - src/app/(dashboard)/dashboard/page.tsx:92-93
const { data } = await supabase
  .from("events")
  .select("id, name, event_date, location, is_archived")
  .eq("owner_id", user.id)          // ❌ exclut les staff non-owners
  .eq("is_archived", false);

// Après (correct) - laisser la RLS décider qui a accès (owner OU staff)
const { data } = await supabase
  .from("events")
  .select("id, name, event_date, location, is_archived, owner_id")
  .eq("is_archived", false)
  .order("event_date", { ascending: true });
```

***

## 2. 💎 QUALITÉ DU CODE

### État actuel
Bonne discipline générale : TypeScript strict, `tsc --noEmit` et `eslint` passants, commentaires en français expliquant l'intention, design system shadcn/ui cohérent. Les gros fichiers composants atteignent la limite de lisibilité-industrielle.

### Problèmes
- 🚨 **[God file]** `reception/[eventId]/page.tsx` (1506 lignes) : un seul composant gère check-in individuel, groupé, walk-in, hors-ligne, sync, filtres, stats, modals, raccourcis clavier. `guests/page.tsx` (1272 l.), `placement/page.tsx` (996 l.) et `profile/page.tsx` (783 l.) suivent le même anti-pattern. Un nouveau dev ne peut pas lire ces fichiers en 1 heure.
- ⚠️ **[Extension d'avatar contrôlée par le client]** `profile/page.tsx:206-214` : `const ext = avatarFile.name.split(".").pop();` → l'extension vient de l'utilisateur. Un fichier `profile.evil` est uploadé sous `/${user.id}/profile.evil`, jamais purgé par le `remove([...profile.jpg/png/webp])` → avatar cassé + embedding orphelin. Devrait forcer une whitelist + vérifier le MIME.
- ⚠️ **[Réordonnancement non atomique]** `tables/page.tsx:303-310` : deux `UPDATE` séparés ; si le second échoue, l'un des `sort_order` reste inchangé → ordre corrompu. Un RPC `reorder_tables` (transaction) est la bonne solution.
- ⚠️ **[`removePendingAction` destructeur]** `reception-store.ts:116-120` : `filter(a => a.guestId !== guestId)` supprime **toutes** les actions du même invité. Si l'invité fait un check-in puis un un-check-in hors-ligne, la sync de la première action efface la seconde → **perte de données offline**. Il faut matcher par `action.id`.
- ⚠️ **[Erreurs avalées en 404]** `src/lib/dal/events.ts:3-12` + `auth.ts:26-28` : une erreur réseau/RLS devient `null` → `notFound()`. Une panne Supabase affiche une "page introuvable", noyant le diagnostic.
- ℹ️ **[Magic numbers]** `PAGE_SIZE = 50`, `RATE_LIMIT_MAX = 100`, `INITIAL_ROWS = 3` non centralisés.
- ℹ️ **[Instances Supabase recréées]** `login/page.tsx:71`, `register/page.tsx:80`, `landing/page.tsx:67`, `reset/forgot-password`, `profile/page.tsx:100` : `createClient()` dans le corps du composant → recréé à chaque rendu (effets dépendants ré-exécutés).

### Recommandations
1. Découper `ReceptionPage` en sous-composants (liste, modals, stats-bar) + hooks spécialisés (`useReceptionSync`, `useRealtimePresence`).
2. Centraliser les constantes (capacités, limites) dans un `config.ts`.
3. Ajouter un système de logging côté server (console/error au minimum) dans `handleAuthError` et les `catch` muets.

### Anti-patterns trouvés
- **God Object** : `ReceptionPage`, `GuestsPage`, `PlacementPage` (>900 lignes chacun).
- **Resilience masquée** : `catch {}` muets (dashboard, profile load, certains sync) rendent les erreurs invisibles.
- **Requêtes redondantes** : MAL + layout + page effectuent le même SELECT.
- **Effects sur client recréé** : `createClient()` non mémorisé en landid/auth/profile → re-rendus.

***

## 3. 🔒 SÉCURITÉ (CRITIQUE)

### État actuel
Le socle de sécurité est bon : auth Supabase (hashing géré par la plateforme), RLS active sur les 5 tables, pas de secret dans le code ni les SQL, `.env` correctement ignoré par git. Mais 4 failles sérieuses persistent.

### Vulnérabilités 🚨
- 🚨 **Session refresh cassé (rotation des refresh tokens perdue)** - `src/proxy.ts:43-50` : `setAll` écrit les cookies sur la **requête** ; `getUser()` (L53) peut déclencher un refresh de session, mais `return NextResponse.next()` (L68) renvoie une réponse **sans** reprendre ces cookies. Après expiration (~1h) et rotation détectée par Supabase, les cookies obsolètes sont révoqués → **déconnexion silencieuse**. Le pattern officiel (docs `@supabase/ssr`) exige d'écrire sur la **réponse** :
```ts
const response = NextResponse.next({ request });
// dans setAll :
cookiesToSet.forEach(({ name, value, options }) =>
  response.cookies.set(name, value, options));
return response;
```
- 🚨 **Rate-limit contournable + fuite mémoire** - `src/proxy.ts:7-28` :
  - La `Map` est **locale à chaque process/instance**. En déploiement multi-instance (Vercel/λ), chaque instance a son compteur → un attaquant distribue ses requêtes et n'atteint jamais la limite.
  - `x-forwarded-for` est **falsifiable** (client-safe derrière un proxy non configuré) et la valeur brute peut être `"ip, proxy1, proxy2"` (tout est pris comme clé).
  - **Aucune purge de la Map** malgré la logique `resetAt` (pas de `delete` périodique) → croissance infinie → **OOM** possible.
  - Recommandation : ne pas tenter un rate-limit in-memory en edge/λ ; utiliser un store externe (Upstash/Redis) ou restreindre strictement aux routes `/auth/*`, et assainir le header IP. En l'état, le 429 est plus un risque de rejet de vrais utilisateurs qu'une protection.
- 🚨 **Service Worker jamais enregistré** - `register-service-worker.tsx:20` : `document.addEventListener("load", ...)` → l'événement `load` n'est émis que sur `window`. Le listener ne se déclenche jamais. Le `sw.js` n'est donc jamais enregistré en prod → **PWA/offline inopérante**. Fix : `window.addEventListener("load", ...)`.

### Risques ⚠️
- ⚠️ **[`SECURITY DEFINER` exécutables par PUBLIC]** - migrations `20260722` : `is_owner_of_event`, `is_admin_of_event`, `is_staff_of_event` sont `SECURITY DEFINER` sans `REVOKE ALL ON FUNCTION ... FROM PUBLIC` ni `GRANT EXECUTE TO authenticated`. Actuellement `anon` et `authenticated` peuvent lancer ces fonctions (elles renvoient false pour le non-autorisé, ce n'est pas une fuite directe, mais c'est une surface d'attaque et un mauvais verrouillage en base).
- ⚠️ **[Actions offline persufées sans namespace]** - `reception-store.ts:127-135` : `pendingActions` en localStorage sans préfixe par userId/eventId. Sur un navigateur partagé, le user B hérite des actions de A après logout (rejouées avec son eventId) — protégé en partie par RLS, mais à purger explicitement lors du `signOut`.
- ⚠️ **[Données de régime alimentaire sur Realtime]** - `REPLICA IDENTITY FULL` (migration `20260808`) : le payload websocket de chaque changement sur `guests` contient **toute la ligne** (GES : `dietary_notes`, `notes`, allergies). Le filtre Realtime limite à l'événement (RLS), mais toute données santé part dans un canal Websocket. À connaître pour la conformité.
- ⚠️ **[Avatar public]** - bucket `avatars` en lecture publique (`getPublicUrl`). Pas critique (peu de PII "visage"), mais à assumer.

### Recommandations de sécurité
1. **Corriger `proxy.ts` en urgence** : le `setAll` doit être écrit sur la réponse (pattern `@supabase/ssr`), et ajouter un try/catch sur `getUser()` pour ne pas ériger une panne réseau en "déconnecté".
2. **Durcir les fonctions SQL** : `REVOKE ALL ON FUNCTION ... FROM PUBLIC` + `GRANT EXECUTE TO authenticated` (+ `STABLE`), et ajouter `FORCE ROW LEVEL SECURITY` sur les 5 tables.
3. **Mettre un index composite** : `CREATE INDEX idx_event_staff_event_user ON event_staff(event_id, user_id);` (chaque RLS lit ce type de filtre).
4. Ajouter une politique `UPDATE` sur `event_staff` (changement de rôle impossible aujourd'hui sans DELETE+INSERT).
5. Purger `pendingActions` au `signOut` (page logout) + importantes le namespace `reception-storage-${userId}`.

***

## 4. ⚡ PERFORMANCE

### État actuel
Bon pour <1000 invités, dégradé au-delà : des compteurs calculés côté JS par full-scan, des `.select("*")` sur les données invités pour quelques colonnes affichées, pas de cache, moins de requêtes redondantes.

### Problèmes de performance
- ⚠️ **[Anti-pattern : comptage en chargeant toutes les lignes]** - `src/lib/dal/guests.ts:45-59` `getGuestStats` : `.select("id, is_present, table_id, age_type", { count: "exact", head: false })` puis comptages en JS. Pour 10 000 invités = 10 000 lignes transférées pour 4 compteurs. **Solution** : un RPC SQL agrégé :
```sql
SELECT COUNT(*),
       COUNT(*) FILTER (WHERE is_present),
       COUNT(*) FILTER (WHERE table_id IS NOT NULL),
       COUNT(*) FILTER (WHERE age_type = 'adult'),
       COUNT(*) FILTER (WHERE age_type IN ('child','baby'))
FROM guests WHERE event_id = $1;
```
- ⚠️ **Dashboard compte récursif en O(N)** - `dashboard/page.tsx:103-115` charge **tous les invités de tous les événements** pour * total/ présent. Idem `dashboard/event/[eventId]/page.tsx:39` avec `getGuestStats`.
- ⚠️ **[N+1 réel dans le Realtime]** - `use-realtime.ts:12-21` : chaque INSERT/UPDATE de guest déclenche une requête `.single()` de recharge. Sous haute fréquence (check-in groupés), coûteux.
- ⚠️ **[`.select("*")` côté client]** - `guests`, `placement`, `reception` font `.select("*")` et ramènent notes/régimes/notes même pour lister des colonnes.
- ℹ️ **Pagination client seulement** - `guests/page.tsx` charge 100 % puis slice en JS (page de 50). Pour les grandes listes, une vraie pagination SQL `<range>` est lecture-compatible.
- ℹ️ **Pas de cache externe** (Redis) - acceptable à ce stade.

### Optimisations suggérées
1. RPC d'agrégats (point ci-dessus) → réponse de quelques octets au lieu de N lignes.
2. Page `event/[eventId]/page.tsx` + `dashboard/page.tsx`: la RPC `fn_get_event_stats(event_id)` unique au lieu de 2-3 requêtes.
3. Supprimer l'`N+1` Realtime : utiliser le payload qui se joint (`tables(name)`) déjà inclus du SELECT d'origine, ou un refetch confiné rarement.
4. Restreindre les projections : ne jamais `.select("*")` sur `guests` ; liste explicite de colonnes.
5. Considérer la pagination SQL + recherche débounce (côté serveur) sur `guests`.

---

## 5. 🐛 ERREURS CRITIQUES & BUGS

| Severity | Fichier:Ligne | Description | Solution |
|----------|---------------|-------------|----------|
| 🚨 | `src/proxy.ts:43-50` | Cookies refresh not propagés à la réponse → déconnexion silencieuse | `setAll` la réponse + retourner `response` |
| 🚨 | `register-service-worker.tsx:20` | `document.addEventListener("load")` jamais déclenché → SW inactif | `window.addEventListener("load", ...)` |
| 🚨 | `dashboard/page.tsx:92` | Les staff (hosts/admin) non-owners ne voient pas les événements auxquels ils participent | retirer le filtre `owner_id` (RLS gère) ou RPC |
| ⚠️ | `reception-store.ts:116-120` | `removePendingAction(guestId)` efface **toutes** les actions du même invité → perte de données offline | matcher par `action.id` |
| ⚠️ | `tables/page.tsx:303-310` | Réordonnancement 2 UPDATE non-atomic → état impossible | RPC atomique |
| ⚠️ | `profile/page.tsx:206-214` | Extension avatar = celle de l'utilisateur, pas de whitelist | whitelist `jpg/jpeg/png/webp` + MIME |
| ⚠️ | `profile/page.tsx:267-290` | `oldPassword` jamais vérifié côté serveur (`updateUser` de Supabase ne le vérifie pas) | soit retirer le champ, soit réintégrer une vérification via requête `signInWithPassword` |
| ⚠️ | `guests/page.tsx:527-548` | Export CSV client n'escape pas les cellules `=+-@` (injection CSV côté UI) | réutiliser `escapeCsvCell` de la route `/csv` |
| ⚠️ | `auth.ts:26-28` + `dal.ts` | Erreur RLS/réseau → 404 « introuvable » (mensonge de diagnostic) | propager 500 sur erreur réseau, 404 réel |
| ⚠️ | `aptreception/page.tsx:302-322` | Rollback local sur erreur de check-in sans resynchroniser le store (état éventuellement discordant) | refresh systématique après erreur |
| ⚠️ | `use-realtime.ts:92-96` + `page` | Double source de vérité « online » (`subscribe.status` vs `navigator.onLine`) discordantes | signal unique (network + canal) |
| ℹ️ | `login/page.tsx:71` et autres | `createClient()` non mémorisé → client recréé à chaque rendu | `useMemo(() => createClient(), [])` |
| ℹ️ | `proxy.ts:32` | `/login/` (slash final) non reconnu comme route auth → pas de suppression | normaliser le pathname |

---

## 6. 🧪 TESTING

### État current
**Aucun test de première partie** : aucun fichier `.test.ts`, `.spec.tsx`, dossier `__tests__` dans `src/`, aucun runner (vitest/jest), **aucun script `"test"`** dans `package.json`. (Les seuls `__tests__` détectés viennent des `node_modules`.)

### Couverture estimée
**0 %** (calculé sur l'absence totale de tests applicatifs).

### Tests manquants
- `src/lib/redirect.ts` (`isSafeRedirect`) — non testé, **critique** (open-redirect).
- `src/lib/auth.ts` (`requireEventAccess`, `uuidSchema`, `handleAuthError`) — non testés.
- `src/lib/dal/*` (events, guests, tables) — non testés.
- Règles métier de la base : capacité des tables, verrouillage, host-guard, `event_id` immuable — non testés (tests d'intégration RLS).
- Composants interactifs : Placement (DnD), check-in, sync offline — non testés.
- Proxy (rate-limit/session refresh) — non testé.

### Recommandations
1. Définir un minimum vital : vitest pour `isSafeRedirect`, `uuidSchema`, `requireEventAccess` (mock du cookie Supabase).
2. Des tests d'intégration RLS (Supabase local, migrations réelles) : insérer des rôles host/admin/owner et vérifier les permissions réelles (capacité, host-guard, cross-event).
3. Un E2E minimal (Playwright/Cypress) sur le parcours invité → placement → check-in.
4. Router la vérification `npm run test` dans le workflow (`npm run build` ne doit pas passer sans tests verts).

---

## 7. 🚀 DÉPLOIEMENT & DEVOPS

### Configuration current
- Platform Next.js (Node runtime, `next start`) ; pas de Dockerfile, pas de CI/CD, pas de monitoring.
- Env vars : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `.env.example` propre, `.gitignore` couvre `.env*`.
- Build : `next build` seul (mais **ne lance ni ESLint ni `tsc`, même si ces deux passés à la main).
- Migrations : exécutées **à la main** (décision) ; pas de script `supabase db push`.
- Pas de `/api/health`, pas de health-check, pas de rollback automatisé.

### Problèmes
- ⚠️ **Aucune CI** : le seul garde-fou qualité est une commande locale tape à la main. Un déploiement peut briser le type sans personne le remarque.
- ⚠️ **`build` sans `lint` ni `typecheck`** : `next build` seul ne passe pas considéré comme garantie. Ajouter `"prebuild": "npm run lint && npm run typecheck"` (avec `lint` en mode fail-on-error).
- ⚠️ **Version SW en dur** (`guest-manager-v1`) : à incrémenter à chaque déploiement pour vider le cache PWA (ou `VERSION = Date.now()` au build).
- ℹ️ **Pas de contrôle des migrations dans le versionné** (pas de fingerprint `supabase_migrations`) — repli à risques en prod.

### Recommandations
1. Créer le workflow (GitHub Actions ou plateforme) : `lint`, `typecheck`, tests, `next build`, sur chaque PR et main.
2. Ajouter `package.json` : `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"deploy:db": "supabase db push"`.
3. Ajouter `route /api/health` (renvoie `{ status: "ok", env: NODE_ENV }`) et vérifier dans le health-check de la plateforme.
4. Configurer un monitoring simple (log des erreurs dans le catch muets) avant de vouloir Sentry.

---

## 8. 🌐 ACCESSIBILITÉ & SEO

### État current
Bonne base a11y : `aria-label` sur les boutons icône, focus visibles sur les champs clés, `useReducedMotion`, dialogs utilisateurs. SEO de base présente (manifest, title/description sur landing).

### Problèmes
- ⚠️ **Drag & drop inaccessible au clavier** : `placement/page.tsx` n'utilise que le Pointer (aucun `KeyboardSensor`) → impossible de placer des invités sans souris.
- ⚠️ **Color contrast douteux** sur les badges noir/or correspondant, texte anthracite sur fonds `muted` (à vérifier AA 4.5:1).
- ℹ️ **`metadata` non exportée par page** : title "Guest Manager" unique sur toutes les pages ; pas d'`opengraph-image`, pas de `sitemap.ts`, pas de `robots.ts`.
- ℹ️ **Focus styles pas uniformes** sur tous les boutons icônes (dépend du composant `Button`, ok par défaut mais vérifier).

### Recommandations
1. Ajouter `KeyboardSensor` (via `useSensors`) dans le placement, avec instructions "Déplacer via clavier".
2. Générer `sitemap.ts` + `robots.ts` (App Router), et `metadata`/`openGraph` par route.
3. Valider le ratio (4.5:1) sur les badges et le texte anthracite, corriger le `Tailwind` si nécessaire.

---

## 9. 📚 DOCUMENTATION

### README
- Existe : ✔
- Complet : Oui (installation, scripts, stack, structure, fonctionnalités)
- À jour : Partiellement (badge "Next.js 16.2" vs version réelle 16.3 ; badge "Statut: En production" ambitieux).

### Code comments
- de bonne qualité en français sur le « pourquoi ». Mais il existe des commentaires **obsolts** : `src/lib/supabase/server.ts` mentionne « le proxy rafraîchit déjà la session » alors que le disable de cookie de proxy est cassé — un commentaire faux qui induit en erreur.

### API documentation
- Existe : Non (pas de Swagger/OpenAPI) pour les routes `/api/reports/*`.

### Recommandations
1. Mettre à jour `docs/security.md` avec les triggers du 20260810 (`event_id` immuable, `owner_id` guard).
2. Ajouter une section « Routes d'export » dans le README (URL, query params, rôles autorisés).
3. Purger les commentaires mensongers (server.ts) et re-vérifier les badges.

---

## 10. 🛠️ TECHNOLOGIES UTILISÉES

### Stack actuelle

| Catégorie | Technologie | Version (package.json) | État |
|-----------|-------------|------------------------|------|
| Frontend | Next.js | 16.3.0 | OK (current 2026) |
| Frontend | React | 19.2.4 | OK |
| Backend | @supabase/supabase-js | 2.110.7 | OK |
| Backend | @supabase/ssr | 0.12.3 | OK |
| DB | PostgreSQL (Supabase) | cloud | OK |
| CSS | Tailwind CSS v4 | ^4 | OK |
| PDF | @react-pdf/renderer | 4.5.1 | OK |
| DOCX | docx | 9.7.1 | OK |
| Forms | react-hook-form + zod | 7.82 / 4.4 | OK |
| Drag/Drop | @dnd-kit | 6.3.1 | OK |
| Charts | recharts | 3.10.0 | OK |
| Animation | framer-motion | 12.42.2 | OK |
| State | zustand | 5.0.14 | OK |
| UI | @base-ui/react + shadcn/ui | 1.6.0 | OK |

**Audit npm (éxécuté)** : `3 high severity vulnerabilities` (transitives) :
- `brace-expansion` (<1.1.18 et 4.0-5.0.8) : DoS OOM (via `@typescript-eslint/typescript-estree`) → `npm audit fix`.
- `js-yaml` (4.0.0–4.3.0) : Quadratic CPU (transitif) → fix.
- `nanoid` (<3.3.17, dans `postcss/node_modules`) : infinite loop possible → fix.
`npm audit fix` corrige ces 3 (dev-deps, non utilisés en prod, mais à remonter le plus tôt).

### Évaluation
- Technologies : **Oui, adaptées** — Next 16 + Supabase = stack moderne, cohérente, efficace pour le scope.
- Versions à revérifier : TS "^5" (bien), lucide-react `^1.25.0` (une version de moins).
- Alternatives meilleures : aucune à changer aujourd'hui. Noter : adopter une RPC SQL agrégée (vs agrégation JS) est le plus grand gain.

### Recommandations tech
1. Exécuter `npm audit fix` (transitives) et commiter en séparé.
2. Adopter vitest + testing-library (le stock de code sans tests devient la semaine de la dette).
3. Pour le rate-limit : route API + external store (Upstash) si déployé en multi-λ/edge, oui sinon supprimer cette fausse protection.
4. Monitoring (Sentry ou self-host) pour capter les 500 muets.

---

## 🎯 PLAN D'ACTION PRIORISÉ

### Phase 1 : Urgent (corriger cette semaine) 🚨
1. Fixer `src/proxy.ts` : cookie refresh → réponse (+ try/catch getUser). **[1-2h]**
2. Fixer `register-service-worker.tsx` : `window.addEventListener("load", ...)`. **[15 min]**
3. Fixer le dashboard (`owner_id` → RLS) + archive. **[1h]**
4. `npm audit fix`. **[15 min]**
5. Restreindre les `SECURITY DEFINER` + index composite. **[1h, migration]**

### Phase 2 : Important (ce mois) ⚠️
1. RPC d'agrégates stats (fin de l'O(N)). **[4h]**
2. Fix `removePendingAction` (by action.id) + purge au logout. **[1h]**
3. Fix avatar (whitelist + MIME) + simplification du champ `oldPassword`. **[1h]**
4. Export CSV client : neutralisation `=+-@` (réutiliser `escapeCsvCell`). **[30 min]**
5. Test minimum : vitest sur `isSafeRedirect` + `requireEventAccess`. **[3h]**
6. Clavier du placement (`KeyboardSensor`). **[4h]**

### Phase 3 : Amélioration (long terme) ℹ️
1. Découper `ReceptionPage` / `GuestsPage` / `PlacementPage` en composants et hooks. **[3-5 j]**
2. Tests : intégration RLS + E2E Playwright. **[1 semaine punti]**
3. CI/CD (GitHub Actions : lint + typecheck + test + build) + migrations versionnées. **[1 j]**
4. Monitoring (Sentry) + route `/api/health` + optimizer bundle. **[1 j]**

---

## 📝 CONCLUSIONS FINALES

**Verdict brutal :** Vous avez un noyau de base de données exceptionnel — RLS, triggers de capacité/verrouillage, immutabilité cross-event — mais la couche d'exécution (session refresh, service worker, tests, CI, gros composants) n'est pas au même niveau. C'est de la médiocrité asymétrique : ~9/10 sur le SQL, ~4/10 sur la production-app.

**Potentiel du projet :** Fort — le modèle de permissions et les triggers montrent une vraie maîtrise du métier.

**Ce qui te différencie :** La rigueur de la modélisation (event immuable, host-guard OLD/NEW, capacité sérialisée FOR UPDATE) — c'est au-dessus de la moyenne du marché.

**Ce qui te tue :** La session cassée + zéro test. Un dysfonctionnement silencieux à H+1 et aucun filet de sécurité pour l'attraper : c'est un contrat de confiance perdu.

**Dernier conseil :** Répare `src/proxy.ts` demain matin (10 minutes), active `window` pour la PWA, et n'ajoute plus une seule fonctionnalité avant d'avoir installé vitest. Ta base est excellente — la couche application doit maintenant être à sa hauteur.

***

*Audit généré par AI Senior Expert - 15+ ans expérience - Aucune pitié, 100% honnête*