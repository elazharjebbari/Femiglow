# R5 — Réponse aux incidents

> Catalogue des incidents probables avec, pour chacun :
>
> - **Symptôme** observé,
> - **Cause** la plus fréquente,
> - **Diagnostic** (les 3 commandes à lancer),
> - **Remédiation** (rapide vs propre),
> - **Suivi** (post-mortem, ticket).
>
> Ce doc est conçu pour être lu **en panique**, pas en réunion. Aller
> directement à l'incident concerné.

## « Premiers 10 minutes » — décision rapide pour la fondatrice

> *« Le site a l'air bizarre. »* → suivre cet arbre :

```
1. Le site charge-t-il ?                NON ──► incident infra (hors scope)
   │                                            ouvre status.vercel.com
   │                                            appelle l'astreinte
   OUI
   │
   ▼
2. Est-ce un texte que TU as édité ?    OUI ──► I1 (cache stale)
   │                                            attendre 60 s, recharger en
   │                                            navigation privée
   NON
   │
   ▼
3. Est-ce un texte qui « était bon avant » ?  OUI ──► I6 (mauvaise publication)
   │                                                  ouvre /admin/audit
   │                                                  trouve la publication
   │                                                  fautive et restaure
   NON
   │
   ▼
4. Est-ce une mise en page cassée ?    OUI ──► I7 (overflow / dépassement)
   │                                            modifier le champ pour
   │                                            le raccourcir et republier
   NON
   │
   ▼
5. Pas grave ? Note ce que tu vois et envoie au dev. Pas d'urgence.
```

**Numéro d'astreinte / contact dev** : à renseigner dans
`docs/admin/astreinte.md`.

## I1 — Le site public affiche un ancien texte après publication

### Symptôme

L'admin a publié il y a 2 minutes mais le site rend encore l'ancienne
valeur.

### Cause

- Cache RSC stale (le tag `components` n'a pas été invalidé).
- CDN edge a une copie HTML pré-rendue.
- L'admin regarde un onglet ouvert avant la publication (RSC pré-loadé).

### Diagnostic

```bash
# 1. Vérifier que le binding est bien published en DB
psql $DATABASE_URL <<SQL
SELECT field_key, status, version, published_at, value
FROM component_field_bindings
WHERE component_id = (SELECT id FROM site_components WHERE key = '<key>')
  AND field_key = '<fieldKey>'
  AND status = 'published';
SQL

# 2. Vérifier les logs revalidate
curl -s https://<host>/api/admin/diagnostics/components/<key> \
  -H "Cookie: $ADMIN_COOKIE" | jq '.fields[] | select(.fieldKey=="<fieldKey>")'

# 3. Forcer la revalidation manuellement
curl -X POST https://<host>/api/admin/components/<key>/revalidate \
  -H "Cookie: $ADMIN_COOKIE"
```

### Remédiation

- **Rapide** : passer par l'écran admin → bouton « Forcer la
  revalidation » (déclenche `revalidateTag('components')` + le tag
  spécifique au composant).
- **Si persistance** : redéployer (Vercel : Redeploy → Use existing
  build). Cela vide le cache edge.
- **Workaround utilisateur** : recharger en navigation privée pour
  écarter un cache navigateur.

### Suivi

Logger un signal `field.cache.stale.detected` avec
`{ componentKey, fieldKey, publishedAt, observedAt, diff }` pour
détecter une dérive systématique.

## I2 — Admin ne peut pas enregistrer une modification

### Symptôme

Toast d'erreur. Le brouillon ne se sauve pas.

### Cause

Codes HTTP renvoyés par l'API (cf. B1) :

| Code | Cause | Remédiation |
|------|-------|-------------|
| 400 | Validation Zod (valeur trop longue, type invalide) | Lire le message, corriger la valeur. |
| 401 | Session expirée | Se reconnecter. |
| 403 | Compte admin inactif (`status != 'active'`) | Réactiver le compte (autre admin). |
| 409 | Conflit version (un autre admin a édité entre temps) | Recharger ou merger via dialog. |
| 422 | Sanitization a remplacé du HTML interdit | Le serveur accepte avec un warning ; si refus, le message indique le tag interdit. |
| 429 | Rate-limit (60 req/min) | Attendre 60 s. |
| 500 | Erreur serveur | Logs Vercel + ticket. |

### Diagnostic

```bash
# Logs Vercel filtrés
vercel logs --since 10m | grep "POST /api/admin/components"
```

### Remédiation

- Pour 409 : l'UI propose **« recharger »** ou **« écraser »**. En
  cas de doute : recharger (on perd les changements locaux mais
  c'est sûr).
- Pour 500 : escalade dev. Ne pas multiplier les tentatives — ça
  pollue les logs.

## I3 — Le cron de promotion n'a pas publié un binding programmé

### Symptôme

Un binding `scheduled` à `2026-05-05 08:00` est toujours `scheduled`
à `08:30`.

### Cause

- Cron Vercel n'a pas tourné (vérifier dashboard Vercel → Crons).
- La promotion a échoué : signal `field.schedule.failed` émis. Cause
  fréquente : la valeur ne passe plus la validation (ex : `maxLength`
  réduit dans le registre entre-temps).
- Le binding pointe sur un composant désactivé / supprimé.

### Diagnostic

```bash
# 1. Vérifier que le cron tourne
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/promote-scheduled-fields | jq

# 2. Trouver les schedules en retard
psql $DATABASE_URL <<SQL
SELECT id, component_id, field_key, scheduled_at, scheduled_at < NOW() AS overdue
FROM component_field_bindings
WHERE status = 'scheduled' AND scheduled_at < NOW()
ORDER BY scheduled_at;
SQL

# 3. Logs de l'échec
vercel logs --since 1h | grep "field.schedule.failed"
```

### Remédiation

#### Promotion manuelle

```bash
curl -X POST https://<host>/api/admin/components/<key>/fields/<fieldKey>/promote \
  -H "Cookie: $ADMIN_COOKIE"
```

Endpoint réservé admin. Appelle la même transaction que le cron.

#### Si validation échoue durablement

L'admin **ré-ouvre le draft** (le binding `scheduled` est ramené à
`draft`), corrige la valeur, et re-publie ou re-programme.

```bash
curl -X POST https://<host>/api/admin/components/<key>/fields/<fieldKey>/cancel-schedule \
  -H "Cookie: $ADMIN_COOKIE"
```

### Suivi

- Compter les `field.schedule.failed` par 24 h → alerte Slack si
  > 3.
- Issue récurrente → revoir la politique de validation côté schedule
  (re-valider à la programmation pour catch tôt).

## I4 — `defaultValue` modifié dans le registre, mais publié toujours stale

### Symptôme

Un dev change `defaultValue: 'A'` en `defaultValue: 'B'` dans le
registre. Le site continue d'afficher `'A'`.

### Cause

**Comportement attendu, non un bug.** Une fois qu'un binding
`published` existe, il **prend toujours le pas** sur le `defaultValue`
(cf. cascade A3). Le `defaultValue` ne sert qu'au seed initial.

### Diagnostic

```sql
SELECT field_key, status, value
FROM component_field_bindings
WHERE component_id = (SELECT id FROM site_components WHERE key = '<key>')
  AND field_key = '<fieldKey>';
```

Si une ligne `published` existe avec value=`'A'`, c'est la source du
rendu.

### Remédiation

Trois options :

1. **Édition admin** : ouvrir `/admin/components/<key>`, mettre
   `'B'`, publier. **Préféré** — on ne touche pas le code.
2. **Resync forcé** : commande CLI réservée aux migrations.
   ```bash
   pnpm --filter @femiglow/web seed:components-fields:force-default \
     --component <key> --field <fieldKey>
   ```
   Crée un nouveau brouillon avec la valeur du registre, et publie.
   **À utiliser avec parcimonie** — écrase le travail de la
   fondatrice.
3. **Reverter le commit** dans le registre si `'A'` était volontaire.

### Suivi

À mentionner dans la doc d'onboarding dev. Erreur classique du
nouveau venu.

## I5 — Drift entre le registre et la DB (bindings orphelins)

### Symptôme

- Un field présent en DB n'est plus dans le registre.
- Un field présent au registre n'a pas de binding `published`.

Souvent détecté par le check de bootstrap (R1, étape 3).

### Cause

- Un PR a retiré un field sans repasser le seed.
- Un PR a ajouté un field mais le seed prod n'a pas tourné.
- Suppression manuelle SQL.

### Diagnostic

```bash
# Script utilitaire
pnpm --filter @femiglow/web tsx scripts/diagnose-field-drift.ts
```

Sortie :

```
Drift detected:
  Orphan bindings (DB but not in registry):
    - home-hero / kicker-old (published, v=2)
  Missing bindings (registry but not in DB):
    - maison-faq / cta-secondary
```

### Remédiation

```bash
# Reconcile : marque les orphelins en archived, crée les manquants
pnpm --filter @femiglow/web seed:components-fields:reconcile
```

Le script :

1. Liste tous les `(componentId, fieldKey, locale, status='published')`.
2. Pour chaque field absent du registre → `UPDATE … SET status =
   'archived'`. History `archive` (action='cascade').
3. Pour chaque field du registre sans binding → `INSERT … status =
   'published'` avec `defaultValue`.
4. Affiche un résumé.

À lancer en mode `--dry-run` d'abord.

## I6 — Rollback massif après une mauvaise publication

### Symptôme

Un admin a publié une valeur erronée (ou une vague de valeurs). Le
site est dégradé. On veut revenir « à hier soir ».

### Cause

Erreur humaine.

### Remédiation

#### Option A — Restaurer 1 binding

Via l'écran d'historique : `/admin/components/<key>/fields/<fieldKey>/history`.
Cliquer sur la version cible → « Restaurer » → un brouillon est
créé → publier. Cf. A4.

#### Option B — Restaurer plusieurs bindings (un composant entier)

```bash
curl -X POST https://<host>/api/admin/components/<key>/fields/restore-snapshot \
  -H "Cookie: $ADMIN_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{ "asOf": "2026-05-04T20:00:00Z" }'
```

Le serveur :

1. Liste tous les bindings du composant.
2. Pour chacun, trouve la dernière version `published` au
   `2026-05-04T20:00:00Z`.
3. Crée un brouillon avec cette valeur.
4. Publie tout en transaction.

> **Endpoint protégé** : nécessite un compte admin avec scope
> `components:bulk-restore` (cf. A6, scope optionnel).

#### Option C — Patch DB direct (nucléaire)

```sql
-- Dans une transaction explicite
BEGIN;
UPDATE component_field_bindings
   SET status = 'archived', updated_at = NOW()
 WHERE id = '<binding_id>' AND status = 'published';

INSERT INTO component_field_bindings (
  id, component_id, field_key, locale, value, status, version,
  published_at, author_id, created_at, updated_at
) SELECT
    'cfb_'||substr(md5(random()::text),1,12),
    component_id, field_key, locale, value, 'published',
    (SELECT MAX(version)+1 FROM component_field_bindings WHERE …),
    NOW(), NULL, NOW(), NOW()
  FROM component_field_history
 WHERE id = '<history_id>';

-- Si tout OK
COMMIT;

-- Puis impérativement
SELECT pg_notify('revalidate', 'components');
```

Et invalider le cache :

```bash
curl -X POST https://<host>/api/admin/cache/revalidate \
  -H "Cookie: $ADMIN_COOKIE" -d '{"tag":"components"}'
```

### Suivi

Post-mortem obligatoire si Option C utilisée. Identifier comment
prévenir la même erreur (validation supplémentaire ? confirmation
modale renforcée ?).

## I7 — Mise en page cassée par une édition (overflow, dépassement)

### Symptôme

Un texte trop long pousse le layout (sticker rotatif coupé, hero qui
wrappe sur 4 lignes au lieu de 2, …).

### Cause

- `config.maxLength` au registre est trop permissif.
- Le composant n'a pas testé l'overflow (ex : pas de `truncate`).

### Remédiation immédiate

1. **Ouvrir l'admin** → modifier le champ → raccourcir → publier.
2. **Si urgent et l'admin n'est pas joignable** : restaurer la
   version précédente (cf. I6 / Option A).

### Remédiation systémique

- Réduire `config.maxLength` dans le registre (PR).
- Ajouter une indication visuelle dans l'éditeur (compteur de
  caractères avec seuil orange/rouge).
- Tests de **propriété** : tirer aléatoirement des valeurs jusqu'à
  `maxLength` et vérifier le rendu (cf. T2).

### Suivi

À chaque incident, mettre à jour le catalog du composant pour
documenter la limite réelle observée.

## I8 — Session admin abandonnée bloquant un brouillon

### Symptôme

L'admin A a ouvert l'éditeur de `home-hero / title` puis fermé son
laptop. L'admin B veut éditer le même champ. Un dialog l'avertit.

### Précision **importante**

> Il n'y a **pas de lock pessimiste** (cf. A6). L'admin B peut
> toujours éditer. Le dialog est informatif.

### Comportement

- L'admin B voit le draft existant (auteur, timestamp).
- Choix : **continuer** (édite le brouillon en place) ou **reprendre
  depuis published** (le brouillon de A est écrasé après confirmation
  explicite).

### Si la fondatrice veut se rassurer

Communication-clé : *« Personne ne peut bloquer ton édition. Si tu
hésites, prends 'reprendre depuis publié' — c'est sans risque. »*

## I9 — PII dans un audit log, demande de redaction RGPD

### Symptôme

Un texte éditorial contenait par erreur le nom d'un client. La
mention apparaît dans `component_field_history` et `adminAuditLog`.

### Procédure

1. **Confirmer la donnée** : `SELECT id, value FROM
   component_field_history WHERE value::text ILIKE '%<nom>%';`
2. **Tracer la PR de redaction** : ouvrir un ticket interne
   `GDPR-<n>`.
3. **Redact** :
   ```sql
   UPDATE component_field_history
      SET value = jsonb_set(value, '{v}', '"[REDACTED:GDPR-<n>]"'::jsonb),
          notes = COALESCE(notes,'') || ' redacted GDPR-<n>'
    WHERE id = '<id>';
   ```
4. **Logger un événement audit** :
   `field.history.redact { historyId, ticketId, actorId }`.
5. **Confirmer au requérant** sous 30 j.

> Politique : on **redact**, on ne supprime pas. La trace de
> rédaction reste pour audit. Cf. A6.

## I10 — Cron `purge-field-history` a supprimé une ligne nécessaire

### Symptôme

Un admin tente de restaurer une version vieille de 4 mois → 404.

### Cause

Politique de rétention : 90 j (sauf rich-text et quote : 365 j).

### Remédiation

- Pas de récupération possible (purge effective). C'est documenté.
- Backup Postgres (point-in-time recovery) si l'incident est récent
  et critique.

### Prévention

- Avant de purger, le cron émet un signal `field.history.purge.preview`
  avec le compte qu'il s'apprête à purger. Si > 1000 lignes, alerte.
- Politique exposée à la fondatrice dans la doc d'admin.

## Annexe — Commandes diagnostic standard

```bash
# État global
pnpm --filter @femiglow/web tsx scripts/diagnose-fields.ts

# Diff registre / DB
pnpm --filter @femiglow/web tsx scripts/diagnose-field-drift.ts

# Stats par page-group
pnpm --filter @femiglow/web tsx scripts/stats-fields.ts --by-page-group

# Trouver un binding par valeur
pnpm --filter @femiglow/web tsx scripts/find-binding.ts --value "..."
```

## Annexe — Métriques à surveiller

| Métrique | Cible | Alerte |
|----------|-------|--------|
| `field.cache.stale.detected` | < 1 / 24 h | > 5 / 24 h |
| `field.schedule.failed` | 0 | > 1 / h |
| `field.conflict` (409) | < 5 / 24 h | > 20 / 24 h |
| p95 `POST /publish` | < 500 ms | > 1500 ms |
| Hit-rate cache RSC | ≥ 95 % | < 90 % |
| Volume `componentFieldHistory` | < 10k lignes | > 50k |

Tableau de bord : `/admin/diagnostics/components`.

## Cross-references

- Cascade et fallback → A3
- Versioning, scheduling → A4
- RBAC, audit → A6
- API routes → B1
- Cache et revalidation → B3
- Bootstrap → R1
- Rollout → R4
