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

Ne jamais faire confiance au client pour la capacité ou le verrouillage. Le trigger
`zz_guests_enforce_capacity` (migration `20260806`) :

- verrouille la ligne `tables` cible (`FOR UPDATE`) pour sérialiser les écritures
  concurrentes ;
- refuse (ERRCODE `23514`) si la table est verrouillée ;
- refuse si l'ajout / changement de table **dépasse la capacité**.

Les contrôles côté UI ne sont qu'un confort ; la base est l'arbitre final.

## 6. Exports

- Chaque route API d'export vérifie l'accès avec `requireEventAccess`.
- L'export CSV échappe les cellules pour l'injection de formule (OWASP)
  (`escapeCsvCell` dans `src/app/api/reports/[eventId]/csv/route.ts`).

## 7. En-têtes HTTP & CSP

Définis dans `next.config.ts` :

- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
- `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`
- **Content-Security-Policy** : `default-src 'self'`, `script-src 'self'` + hash du
  script inline du thème (`src/app/layout.tsx`), `connect-src` avec l'origine Supabase
  et son WebSocket Realtime, `frame-ancestors 'none'`.

> Si le script inline de thème change, **recalculez son hash sha256** et mettez à jour
> la CSP dans `next.config.ts`.

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