# Sécurité — Guest Manager

Document sur le modèle de sécurité de l'application : authentification, rôles,
Row Level Security (RLS), triggers d'intégrité et bonnes pratiques de déploiement.
Complète les migrations SQL (`supabase/migrations/*.sql`), qui restent la source de
vérité opérationnelle.

## 1. Authentification

- Toutes les pages métier sont protégées par l'authentification Supabase.
- Le **proxy** Next.js (`src/proxy.ts`) gère le rafraîchissement de session,
  l'ACL des requêtes et le rate-limit.
- Les redirections post-login sont validées par `isSafeRedirect()`
  (`src/lib/redirect.ts`), partagée entre le login (`login/page.tsx`) et le callback
  (`auth/callback/route.ts`), pour bloquer tout open-redirect.

## 2. Rôles

Par événement, trois niveaux, via la table `event_staff` :

- **owner** : accès total (événement, staff, contenu).
- **admin** : peut modifier événement, tables et invités, et gérer le staff.
- **host** : peut consulter l'événement et marquer la présence, mais **ne peut pas**
  modifier les données d'un invité (nom, prénom, catégorie, table, groupe, régimes…).

### Fonctions utilitaires `SECURITY DEFINER`

Ces fonctions (`SET search_path = public` inclus) rompent la récursion RLS et sont
utilisées par toutes les politiques :

- `is_owner_of_event(event_id)`
- `is_admin_of_event(event_id)`
- `is_staff_of_event(event_id)`

## 3. Row Level Security (RLS)

Toutes les tables ont en RLS active. Exemple pour `guests` :

```sql
CREATE POLICY "guests_update_policy" ON guests
  FOR UPDATE
  USING (is_owner_of_event(guests.event_id) OR is_staff_of_event(guests.event_id))
  WITH CHECK (is_owner_of_event(guests.event_id) OR is_staff_of_event(guests.event_id));
```

> ⚠️ **Limite de RLS** : dans un `WITH CHECK`, les références de colonnes désignent
> uniquement la ligne **NEW** ; RLS n'a **jamais accès** à la ligne **OLD**. Toute
> comparaison NEW vs OLD doit se faire dans un **trigger `BEFORE UPDATE`**.

## 4. Trigger de garde des hôtes

Le trigger `zz_guests_host_guard` (migration `20260806`) garantit qu'un host ne peut
modifier que `is_present`, `checked_in_at` et `notes`. Toute autre modification
déclenche une exception :

```sql
IF is_staff_of_event(NEW.event_id)
   AND NOT is_owner_of_event(NEW.event_id)
   AND NOT is_admin_of_event(NEW.event_id)
   AND ( NEW.first_name IS DISTINCT FROM OLD.first_name
         OR NEW.last_name IS DISTINCT FROM OLD.last_name OR ... )
THEN RAISE EXCEPTION 'Un hôte ne peut modifier que la présence d''un invité'
     USING ERRCODE = '42501'; -- insufficient_privilege
END IF;
```

## 5. Règles d'intégrité imposées en base

Ne jamais faire confiance au client pour la capacité ou le verrouillage. Les triggers
(`zz_guests_enforce_capacity` row-level + `zz_guests_validate_statement` statement-level,
migrations `20260806` / `20260809`) :

- verrouillent la ligne `tables` cible (`FOR UPDATE`) pour sérialiser les écritures
  concurrentes ;
- refusent (ERRCODE `23514`) si la table est verrouillée ;
- refusent si l'ajout / changement de table **dépasse la capacité** ;
- **respectent les mises à jour sans changement de table** (édition de nom, notes…)
  même sur une table pleine ou verrouillée ;
- re-vérifient l'état **final** de toutes les tables touchées après une instruction
  groupée (déplacement d'un groupe entier, insertions par lots), ce qui couvre
  l'angle mort des triggers row-level sur une même instruction.

Les contrôles côté UI ne sont qu'un confort ; la base est l'arbitre final.

## 6. Exports

- Chaque route API d'export vérifie l'accès avec `requireEventAccess`.
- L'export CSV échappe les cellules pour l'injection de formule (OWASP)
  (`escapeCsvCell` dans `src/app/api/reports/[eventId]/csv/route.ts`).

## 7. En-têtes HTTP & CSP

Définis dans `next.config.ts` :

- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`
- **Content-Security-Policy** : `default-src 'self'`, `script-src 'self' 'unsafe-inline'`
  (nécessaire : Next.js émet des scripts inline RSC `self.__next_f.push` dont le hash
  varie à chaque build ; les pages restent en rendu statique), `connect-src` avec
  l'origine Supabase et son WebSocket Realtime, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`.

> `unsafe-inline` sur `script-src` est l'approche documentée par Next.js sans nonce ;
> il n'autorise pas les scripts externes non whitelistés (`'self'` uniquement).

## 8. Vie privée (PII)

- Les données d'invités (noms, régimes, allergies, données santé) **ne sont plus
  persistées en `localStorage`** (`src/lib/store/reception-store.ts`), pour éviter une
  exfiltration massive en cas de XSS. Seules `pendingActions` (check-in hors-ligne)
  sont conservées, le temps de leur synchronisation.
- Ne journalisez jamais de PII dans les logs applicatifs.

## 9. Checklist de vérification

1. Un **host** ne peut modifier que la présence (test RLS/trigger).
2. La base refuse capacité dépassée et table verrouillée.
3. Toute écriture client gère l'erreur et **rollback** l'état optimiste.
4. Toute nouvelle politique RLS doit être testée avant mise en production.