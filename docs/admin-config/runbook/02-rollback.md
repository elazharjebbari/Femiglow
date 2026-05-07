# Runbook — Rollback config cassée

## Symptômes

- Une section affiche le défaut au lieu de la config éditée
- Sentry/logs : `[admin-config] Zod validation failed for section=X`
- L'admin ne peut pas sauvegarder une section (422 récurrent)

## Procédure express

### 1. Localiser la section cassée

```sql
SELECT section, version, updated_at, updated_by
FROM app_config
ORDER BY updated_at DESC;
```

### 2. Inspecter le payload

```sql
SELECT jsonb_pretty(payload) FROM app_config WHERE section = '<section>';
```

### 3. Restaurer un snapshot via UI

- `/admin/settings/<section>` → onglet **Historique**
- Identifier le dernier snapshot sain (date + actor)
- Cliquer **Restaurer**
- Vérifier le diff
- Sauvegarder

### 4. Rollback DB direct (si UI inutilisable)

```sql
-- option A : revenir au défaut codé en supprimant la ligne
DELETE FROM app_config WHERE section = '<section>';

-- option B : restaurer un snapshot précis
UPDATE app_config
SET payload = (
  SELECT payload FROM app_config_snapshots
  WHERE id = '<snapshot_id>'
),
version = version + 1,
updated_at = NOW(),
updated_by = '<your_user_id>'
WHERE section = '<section>';
```

### 5. Invalider le cache

Après toute modification SQL directe, le cache Next.js ne sait pas.
Forcer la revalidation :

- Soit appeler `POST /api/admin/cache/revalidate?tag=app-config`
  (route admin protégée, présente dans le repo)
- Soit redéployer (Vercel `Redeploy`) — change la build cache key

### 6. Vérifier

```sql
SELECT section, version FROM app_config WHERE section = '<section>';
```

Recharger `/admin/settings/<section>` → la valeur attendue s'affiche.

## Garde-fous préventifs

- **Le failsafe** : même avec une ligne corrompue, le site tourne sur
  les défauts codés. Pas de panique, juste de la dette.
- **`If-Match`** : le PATCH refuse les versions stales — pas de
  race-condition entre deux admins.
- **Snapshots auto** : toujours un point de retour (les 50 derniers).
- **Validation stricte** : Zod refuse au PATCH ; pour avoir une ligne
  corrompue, il faut un INSERT manuel ou une migration ratée.

## Cas particuliers

### RBAC : se locker hors de l'admin

Si une édition RBAC retire vos permissions :

```sql
DELETE FROM app_config WHERE section = 'rbac';
```

Restaure les défauts codés (qui incluent toujours `superadmin` =
tout). Garder une trace de la commande dans le runbook journal
d'incident.

### Branding : couleurs illisibles

Symptôme : texte blanc sur fond blanc, NAV invisible. Le failsafe
ne couvre pas ça (les couleurs sont valides au sens Zod). Solution :

```sql
DELETE FROM app_config WHERE section = 'branding';
-- + revalidate
```

### Migration de schéma

Si on change un schéma Zod (rename de champ par ex.), un snapshot
ancien peut devenir invalide. La route `/restore` re-valide avant
d'écrire ; un snapshot legacy renverra 422. Solution : éditer
manuellement le payload en SQL avant de restaurer, ou ne pas
restaurer (préférer ré-éditer).

## Post-mortem

Pour toute corruption en prod, ouvrir un ticket avec :

- Date / heure
- Section concernée
- Payload corrompu (jsonb_pretty)
- Source (PATCH / migration / INSERT manuel ?)
- Action de remediation
- Cause racine
- Mesure préventive (test unitaire à ajouter ? validation à durcir ?)
