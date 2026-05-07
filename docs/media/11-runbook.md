# 11 — Runbook

Procédures opérationnelles pour le module média. Toutes les commandes
sont à exécuter depuis `apps/web/` sauf mention contraire.

## 1. Importer un média

### Via l'UI admin (cas standard)

1. Se connecter à `/admin` avec le compte fondatrice.
2. Cliquer **Médias** dans la nav, puis **+ Importer**.
3. Drag & drop ou cliquer pour sélectionner.
4. Renseigner `alt` (obligatoire).
5. Cocher `Hero` si l'image est un LCP.
6. Cliquer **Importer**.

L'optimisation se déclenche dans la minute (cron `* * * * *`). Le
badge passe de `⏳ en cours` à `✓ optimisé`.

### Via URL externe

Même UI, coller une URL HTTPS dans le champ dédié. Le pipeline
récupère le fichier (anti-SSRF actif) et l'optimise.

Si la fondatrice **ne veut pas** rapatrier le fichier (logo
partenaire), elle coche `Source externe (passthrough)` : le média
sera rendu via l'URL d'origine, sans optimisation.

### Import en masse (script)

Pour seed initial ou migration :

```bash
pnpm tsx scripts/seed-media.ts \
  --dir docs/images/values \
  --quality-profile inline \
  --tag-prefix value
```

Le script lit chaque PNG, crée un média, crée un job `optimize`. Le
cron prend ensuite le relais.

---

## 2. Ré-encodage massif

Quand un réglage global change (nouveau profil, nouveau format), il
faut régénérer toutes les variantes.

### Depuis l'UI

`/admin/media/settings` → modifier → **Enregistrer**.

Modale de confirmation : "Ré-encoder N médias (~Y minutes) ?".

Cliquer **Confirmer** : un job `regenerate` est créé pour chaque
média concerné. Le cron les traite à 1 média/minute.

### Depuis la CLI (admin direct DB)

```sql
INSERT INTO media_jobs (id, media_id, kind, status, next_attempt_at, created_at)
SELECT
  'mj_' || substr(md5(random()::text), 1, 12),
  id,
  'regenerate',
  'pending',
  now(),
  now()
FROM media
WHERE deleted_at IS NULL
  AND status = 'ready';
```

### Surveillance

Pendant un re-encodage massif :

```bash
# tail le log cron
vercel logs --follow | grep media-optimize

# stats via /admin/media/health
curl https://femiglow.com/admin/media/health \
  -H "Cookie: __Secure-fg-admin=…" | jq
```

Sortie attendue :

```json
{
  "queue": { "pending": 142, "in_progress": 1, "failed": 0 },
  "last_cron_run": "2026-04-12T10:23:18Z",
  "avg_duration_ms": { "image": 3200, "video": 28400, "audio": 2100 }
}
```

---

## 3. Supprimer un média

### Soft delete (réversible 30 j)

UI : drawer du média → bouton **Supprimer** → confirmation.

CLI :

```sql
UPDATE media SET deleted_at = now() WHERE id = 'me_xxx';
```

Le média disparaît de la bibliothèque. Les variantes restent dans
Blob (utiles pour annulation).

### Annuler une suppression

`/admin/media?status=deleted` → ouvrir le média → **Restaurer**.

Ou :

```sql
UPDATE media SET deleted_at = NULL WHERE id = 'me_xxx';
```

### Hard delete (irréversible)

UI : drawer → **Supprimer définitivement** (deux modales de
confirmation, dont une avec saisie du slug).

Programmé : un cron hebdo (`scripts/purge-soft-deleted-media.ts`)
purge automatiquement les médias soft-deleted depuis ≥ 30 j.

---

## 4. Incident pipeline (cron en panne)

### Symptômes

- Beaucoup de médias en `status='pending'` qui ne passent pas à
  `ready`.
- Sentry remonte des erreurs sur `/api/cron/media-optimize`.
- `/admin/media/health` montre `last_cron_run` > 5 min.

### Diagnostic

1. Vérifier que le cron Vercel est actif :

   ```bash
   vercel cron ls
   ```

   Doit afficher `/api/cron/media-optimize  schedule="* * * * *"  enabled`.

2. Vérifier les logs :

   ```bash
   vercel logs --follow --output=json | jq 'select(.path == "/api/cron/media-optimize")'
   ```

3. Vérifier le secret :

   ```bash
   vercel env ls production | grep CRON_SECRET
   ```

### Causes fréquentes

| Symptôme | Cause | Fix |
|---|---|---|
| 401 Unauthorized | `CRON_SECRET` mismatch | Re-syncer la valeur dans Vercel env vars |
| Timeout 300 s | vidéo trop lourde | Cap `maxWidth` à 1280, ou réduire bitrate |
| 500 sharp error | binaire absent | Redéployer (npm rebuild sharp) |
| OOM | image > 50 MB en RAM | Stream `sharp().pipe()` au lieu de buffer |
| Blob 413 | quota plein | Archiver / supprimer anciens médias |

### Recovery

```bash
# Repique tous les jobs failed des 7 derniers jours
curl -X POST https://femiglow.com/api/cron/media-recover \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

Les jobs reviennent en `pending` avec `attempt_count = 0`.

---

## 5. Doublons et déduplication

### Détection

Le pipeline calcule un `phash` 64-bit pour chaque image. Deux médias
avec une distance de Hamming ≤ 5 sont considérés "perceptuellement
similaires".

### Workflow admin

1. `/admin/media/duplicates` affiche les clusters.
2. Pour chaque cluster, choisir :
   - **Garder** : ce média est canonique. Les usages des autres
     migrent vers lui via SQL :

     ```sql
     UPDATE media_usages SET media_id = 'me_canonical' WHERE media_id IN ('me_dup1', 'me_dup2');
     ```

     Puis soft-delete les doublons.
   - **Fusionner dans …** : sens inverse.
   - **Ignorer ce cluster** : ajoute un flag (`media.overrides.ignoreDedup`)
     pour ne plus le proposer.

### Faux positifs

Si la fondatrice voit des doublons trop agressifs (deux photos
légitimement différentes sont groupées) :

1. Marquer "Ignorer ce cluster".
2. Si récurrent, durcir le seuil de 5 → 3 bits dans
   `src/lib/media/queue/dedup.ts`.

---

## 6. Régression visuelle

### Symptôme

Une page rend une image cassée (`<img>` blanc, ou layout shift).

### Diagnostic rapide

1. Ouvrir DevTools → Network → filtrer `media`.
2. Si requête 404 → la variante n'existe pas, pipeline pas fini ou
   variante supprimée par erreur.
3. Si requête 200 mais image blanche → AVIF non décodé par le
   navigateur (Safari < 17). Vérifier que la `<source type="image/webp">`
   est bien présente.
4. Si `<picture>` absent → erreur RSC, voir Sentry.

### Recovery

```bash
# Forcer la régénération d'un média
curl -X POST https://femiglow.com/api/admin/media/me_xxx/regenerate \
  -H "Cookie: __Secure-fg-admin=…" \
  -d '{"reason":"manual"}'
```

Ou via UI : drawer → **Régénérer**.

Pendant la régénération, le SVG fallback / BlurHash s'affiche, donc
**la page reste utilisable**.

---

## 7. Migration de stockage (local → Vercel Blob)

Cas : développement local terminé, on bascule vers prod.

### Étapes

1. Configurer `BLOB_READ_WRITE_TOKEN` dans Vercel env vars.
2. Changer `MEDIA_STORAGE_DRIVER=vercelBlob`.
3. Lancer le script de migration :

   ```bash
   pnpm tsx scripts/migrate-storage.ts \
     --from local \
     --to vercelBlob \
     --batch-size 10
   ```

   Pour chaque variante : télécharge depuis `local`, upload vers
   `vercelBlob`, met à jour `media_variants.url` en base.

4. Vérifier qu'aucune URL `/_media/` ne subsiste :

   ```sql
   SELECT count(*) FROM media_variants WHERE url LIKE '/_media/%';
   ```

   Doit être 0.

5. Désactiver la route `/_media/[…path]` dans le code (Phase 2).

---

## 8. Snapshot S3 (Phase 2)

Backup hebdomadaire des variantes critiques.

```bash
pnpm tsx scripts/backup-media-to-s3.ts \
  --bucket femiglow-media-backup \
  --since "$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)"
```

Restauration en cas de perte Vercel Blob :

```bash
pnpm tsx scripts/restore-media-from-s3.ts \
  --bucket femiglow-media-backup \
  --target vercelBlob
```

---

## 9. Mise à jour dépendance critique (`sharp`)

Les versions de `sharp` peuvent casser le binaire Vercel.

### Procédure safe

1. Branche `chore/upgrade-sharp-X.Y.Z`.
2. Bump `pnpm add sharp@latest`.
3. Tests Vitest verts en local.
4. Push, attendre le **preview deploy**.
5. Tester `/admin/media/upload` avec une image en preview.
6. Si OK → merge.
7. Si build preview échoue → rollback (`pnpm add sharp@<previous>`).

---

## 10. Surveillance proactive

### Métriques à monitorer

| Métrique | Alerte si | Action |
|---|---|---|
| `media_jobs.failed` | > 5 sur 24 h | Vérifier Sentry, repique |
| `media_jobs.pending` | > 200 | Cron probablement en panne |
| Vercel Blob storage | > 80 % quota | Archiver anciens médias |
| LCP p75 mobile | > 2.5 s sur 24 h | Vérifier hero pre-load + AVIF |
| Cache hit ratio `/api/media/*` | < 90 % | Vérifier `s-maxage` headers |

### Dashboards

- Vercel Analytics → Web Vitals → filtrer par route.
- Sentry → projet `femiglow-web` → filtrer par `tag:media`.
- `/admin/media/health` → vue interne (pour la fondatrice).

---

## 11. Audit de cohérence

Cron mensuel (`scripts/audit-media-consistency.ts`) qui vérifie :

1. **Variantes orphelines** : clés Blob sans `media_variants` →
   purge.
2. **Médias sans variante** : `status='ready'` mais `variants=[]` →
   relance pipeline.
3. **Médias avec phash NULL** alors que `kind='image'` et
   `status='ready'` → relance `phash` job.
4. **Usages orphelins** : `media_usages` qui pointent vers un média
   `deleted_at NOT NULL` → soft delete les usages.

Sortie : rapport JSON dans `docs/admin/runs/media-audit/YYYY-MM-DD/`.

---

## 12. Procédure de rollback

Cas extrême : le module média a un bug critique en prod.

### Rollback front (rendu)

```bash
# Désactiver les composants <MediaImage> via feature flag
# (Phase 2 : ajouter MEDIA_DISABLED=true env var)
vercel env add MEDIA_DISABLED true production
vercel deploy --prod
```

Quand `MEDIA_DISABLED=true`, le composant rend directement le SVG
fallback et ignore les variantes. La page reste belle, juste sans les
images optimisées.

### Rollback DB

Les migrations sont **forward-only**. Pour rollback :

```bash
pnpm db:migrate:rollback --to 0000_init
```

Attention : supprime toutes les tables `media_*`. À utiliser
uniquement si le module n'a jamais été utilisé en prod.

---

## 13. Onboarding admin (fondatrice)

### Tutorial pas-à-pas

1. **Préparer ton premier import**
   - Choisir une image de qualité (≥ 1600 px de largeur).
   - Penser à un slug court : `kit-principal`, pas
     `IMG_2024_03_12_v3_FINAL_FINAL.png`.
   - Préparer un alt text descriptif (5–15 mots).

2. **Importer**
   - `/admin/media/upload` → drop.
   - Remplir alt, tags.
   - Cocher Hero si c'est une image LCP.

3. **Vérifier le résultat**
   - Attendre 30–90 s (cron + pipeline).
   - Tile passe en `✓ optimisé`.
   - Cliquer pour voir les variantes.

4. **L'utiliser dans une page**
   - Demander au dev d'ajouter `<MediaImage slug="kit-principal" />`.
   - Ou l'ajouter via le futur CMS Phase 3.

5. **Maintenir**
   - Une fois par semaine, jeter un œil à
     `/admin/media/duplicates` et `/admin/media?unused=true`.
   - Ne jamais hard-delete sans avoir vérifié les usages.

---

## 14. Contacts

| Rôle | Personne | Disponibilité |
|---|---|---|
| Fondatrice (admin) | Yasmine | UTC+1, 9h–19h |
| Dev principal | (à définir) | sur appel d'urgence |
| Vercel support | dashboard | 24/7 (plan Pro) |
| Neon support | dashboard | 24/7 (plan Scale) |

Pour incidents bloquants en prod, ouvrir un ticket via
`/admin/incidents/new` (lié au module admin existant) avec tag `media`.
