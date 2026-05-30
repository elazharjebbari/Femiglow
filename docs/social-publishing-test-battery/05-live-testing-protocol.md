# Live Testing Protocol — Instagram AlFenna Beauty

> Protocole opérationnel pour le **seul** test E2E qui poste réellement sur Instagram. Toute déviation à ce protocole = risque d'incident.

## 1. Objectif

Valider en chaîne réelle :
1. L'opérateur peut publier un post depuis l'UI FemiGlow
2. Postiz reçoit + accepte le payload
3. Postiz publie sur Instagram AlFenna Beauty
4. La DB FemiGlow reflète l'état (delivery sent, postizPostId, audit log)
5. Le post peut être nettoyé (cleanup automatique ou manuel)

## 2. Pré-requis stricts (non négociables)

### Compte
- Compte Instagram **AlFenna Beauty** existant (`@alfenna_beauty`)
- Compte connecté à Postiz via OAuth Instagram Business / Meta Business
- L'opérateur de la session a un accès admin FemiGlow

### Postiz
- Compte Postiz actif avec quota disponible
- API key Postiz valide
- Intégration Instagram sync vers FemiGlow effectuée préalablement

### Variables d'env
```bash
# Activation du live test (GATE STRICT)
export E2E_LIVE_POSTIZ=1

# Authentification Postiz
export POSTIZ_BASE_URL=https://api.postiz.com
export POSTIZ_API_KEY=<your-secret-key>

# Compte AlFenna sur Postiz
export E2E_LIVE_ACCOUNT_ID=<postiz-integration-id-for-alfenna>
export E2E_LIVE_INSTAGRAM_HANDLE=alfenna_beauty

# Cleanup automatique (recommandé)
export E2E_LIVE_CLEANUP=1

# Optionnel: image asset URL (sinon utilise un mock interne)
export E2E_LIVE_TEST_IMAGE_URL=https://example.com/test.jpg
```

### Caption test marquée
Le live test utilise une caption qui contient un marqueur visible permettant un identifiant rapide en cas de problème :

```
[TEST AUTO — FemiGlow QA — {timestamp ISO}]
Test automatisé de publication. À supprimer après validation.
```

Cette caption permet :
- Une recherche rapide sur Instagram si cleanup échoue
- D'éviter toute confusion avec un vrai post AlFenna
- D'auditer la traçabilité

### Image test
- 1080x1080 JPEG/PNG
- Logo FemiGlow + texte "TEST QA" en surimpression
- Hébergée sur un CDN public HTTPS (ou hardcoded via `E2E_LIVE_TEST_IMAGE_URL`)

## 3. Pré-flight check (avant chaque run)

```bash
# 1. Confirmer les vars
[ -n "$E2E_LIVE_POSTIZ" ] && [ -n "$POSTIZ_API_KEY" ] && [ -n "$E2E_LIVE_ACCOUNT_ID" ] || \
  { echo "ENV missing"; exit 1; }

# 2. Smoke test Postiz API
curl -s -H "Authorization: $POSTIZ_API_KEY" "$POSTIZ_BASE_URL/api/public/v1/integrations" | jq '.[] | select(.id == "'"$E2E_LIVE_ACCOUNT_ID"'") | .id'
# attendu : echo de l'id si tout va bien

# 3. Vérifier que le compte AlFenna est sync côté FemiGlow
curl -s -H "Cookie: $ADMIN_SESSION_COOKIE" \
  http://localhost:8012/api/admin/content-studio/postiz/integrations/sync \
  -X POST | jq '.accounts[] | select(.remoteId == "'"$E2E_LIVE_ACCOUNT_ID"'") | .name'
# attendu : "AlFenna Beauty" ou similaire

# 4. Vérifier qu'aucun post test n'est déjà en cours
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U femiglow -d staging_femiglow \
  -c "SELECT count(*) FROM content_postiz_delivery WHERE response::text LIKE '%TEST AUTO%' AND createdAt > now() - interval '10 minutes';"
# attendu : 0 (sinon attendre que le précédent soit nettoyé)
```

## 4. Le test live (workflow attendu)

```
Step 1: Setup
  └ Create draft via API (skip UI pour stabilité)
  └ Approve draft via API → postId disponible
  └ Bind un media test (image hébergée)

Step 2: UI flow (Playwright)
  └ Navigate to /admin/content-studio-v2/create?draftId=<id>
  └ Wait for ApproveButton enabled
  └ Click "Valider et préparer la publication"
  └ Wait for "Draft validé" toast
  └ Click Publier → "Publier maintenant" → Confirm
  └ Wait for "Publication lancée" toast

Step 3: Job verification (DB polling)
  └ Poll social_publish_job WHERE postId=$postId
  └ Wait for status='published' (timeout 90s)
  └ Capture remoteId (= postizPostId)

Step 4: Postiz verification
  └ GET $POSTIZ_BASE_URL/api/public/v1/posts/$postizPostId
  └ Expect: status='SENT' or 'PUBLISHED', permalink contains 'instagram.com'

Step 5: DB delivery verification
  └ SELECT * FROM content_postiz_delivery WHERE postId=$postId
  └ Expect: status='sent', postizPostId=$postizPostId, lastError IS NULL

Step 6: Audit log verification
  └ SELECT * FROM audit_log WHERE action='social.publish.published' AND resourceId=$postId
  └ Expect: 1 row, actorId match admin, meta contains remoteId

Step 7: Visual Instagram check (manual or automated)
  └ Option A (manual): open https://instagram.com/alfenna_beauty in incognito, find the test post
  └ Option B (auto): screenshot of the post URL → tesseract OCR to find "TEST AUTO" marker

Step 8: Cleanup (auto if E2E_LIVE_CLEANUP=1)
  └ DELETE $POSTIZ_BASE_URL/api/public/v1/posts/$postizPostId
  └ Expect: 200 or 204
  └ Audit log entry: social.publish.cleaned
  └ UPDATE content_postiz_delivery SET cleanupAt=now() WHERE postizPostId=$postizPostId
```

## 5. Critères de validation

Tous doivent être verts pour considérer le test passé :

- [ ] `social_publish_job.status = 'published'` dans 90s
- [ ] `social_publish_job.publishedAt` non null
- [ ] `social_publish_job.lastError IS NULL`
- [ ] `content_postiz_delivery.status = 'sent'` (status code Postiz)
- [ ] `content_postiz_delivery.postizPostId` non null et matching
- [ ] Postiz API `GET /posts/:id` retourne le post avec permalink Instagram
- [ ] `audit_log` row `social.publish.published` enregistrée avec actorId, jobId, remoteId
- [ ] (Manuel) Post visible sur https://instagram.com/alfenna_beauty
- [ ] Cleanup réussi (si activé)

## 6. Cleanup et recovery

### Cleanup automatique
Si `E2E_LIVE_CLEANUP=1`, le test exécute après tous les asserts :
```ts
test.afterEach(async () => {
  if (postizPostId) {
    await fetch(`${POSTIZ_BASE_URL}/api/public/v1/posts/${postizPostId}`, {
      method: 'DELETE',
      headers: { Authorization: POSTIZ_API_KEY },
    });
  }
});
```

### Recovery si crash
Si le test crash entre la publication et le cleanup, un script de récupération doit pouvoir nettoyer manuellement :

```bash
# scripts/social-publishing-live-cleanup.sh
#!/bin/bash
TIMESTAMP=${1:-$(date -u -d '1 hour ago' +%Y-%m-%dT%H:00:00Z)}

# Find dangling test posts
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U femiglow -d staging_femiglow \
  -c "SELECT postizPostId FROM content_postiz_delivery WHERE response::text LIKE '%TEST AUTO%' AND createdAt > '$TIMESTAMP' AND cleanupAt IS NULL;" \
  -t -A | while read POSTID; do
  curl -X DELETE -H "Authorization: $POSTIZ_API_KEY" \
    "$POSTIZ_BASE_URL/api/public/v1/posts/$POSTID"
  echo "Cleaned $POSTID"
done
```

À exécuter en cas de doute après un run live.

## 7. Limitations connues

- **Rate limit Instagram** : max 1 publish par 30min recommandé
- **Cleanup latency Postiz** : 5-30s entre DELETE et disparition Instagram (les abonnés peuvent voir brièvement)
- **Stories non testées** : seul format `post` (carré) testé dans le live ; reel/story = backlog
- **Pas de rollback complet** : si Instagram a posté avant qu'on demande DELETE, les vues comptent ; les notifications aux followers sont parties

## 8. Gating CI

- Le live test est **JAMAIS** lancé en CI par défaut
- Pour le lancer : un workflow GitHub Actions dédié, déclenché manuellement (workflow_dispatch), avec confirmation explicite (input "I_UNDERSTAND_THIS_POSTS_LIVE=yes")
- Le workflow vérifie l'horaire (ne pas tourner avant 11h ou après 17h Casa time)
- Le workflow alerte sur Slack avant et après le run

## 9. Métriques à tracker

Pour chaque live run, logger :
- Timestamp ISO
- postizPostId
- Durée totale (start → cleanup)
- Status final
- Erreurs intermédiaires (s'il y en a)
- Coût estimé Postiz (~$0.02)

Stocker dans `test-results/live-runs.csv` (ou table dédiée `qa_live_runs`).

## 10. Escalation si problème

| Problème | Action |
|----------|--------|
| Post visible mais cleanup échoue | Suppression manuelle via Instagram app ou Postiz UI |
| Postiz API down | Reporter le test ; alerter ops via Slack |
| AlFenna account disconnected | Re-OAuth via Postiz UI ; re-sync FemiGlow |
| Plus de 10 posts test sur le feed | Suspension immédiate des live tests ; cleanup script massif |
| Compte suspendu Instagram | Escalation @ ops/legal ; stop tous live tests |

## 11. Audit post-run

Après chaque run live, archiver :
- Trace Playwright (`trace.zip`)
- DB snapshot (jobs + delivery + audit)
- Postiz response logs
- Screenshot Instagram (si capturé)
- Coût engagé

Dans `test-results/live-runs/{timestamp}/`.

---

**TL;DR** :
- Gate `E2E_LIVE_POSTIZ=1` strict
- Caption marquée "[TEST AUTO]"
- Cleanup auto
- Vérif DB + Postiz + audit + visuel manuel
- 4 assertions au minimum
- Recovery script disponible
