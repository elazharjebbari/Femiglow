# Automatisation

## Automatisations v0

| Job | Fréquence | Rôle |
| --- | --- | --- |
| `content-studio-sync-postiz-integrations` | manuel + quotidien | Vérifier comptes actifs |
| `content-studio-retry-deliveries` | toutes les 10 min | Retry Postiz failures |
| `content-studio-import-postiz-status` | toutes les 30 min | Reprendre statut posts |
| `content-studio-import-performance` | quotidien | Import analytics si disponible |
| `content-studio-budget-reset` | quotidien | Reset budget génération |

## Implémentation staging actuelle

Endpoints cron protégés par `Authorization: Bearer $CRON_SECRET` :

| Endpoint | Méthode | Effet |
| --- | --- | --- |
| `/api/cron/content-studio/postiz-sync` | `POST` | Interroge les intégrations Postiz et journalise le nombre de comptes actifs/inactifs. |
| `/api/cron/content-studio/retry-deliveries` | `POST` | Retente les livraisons Postiz échouées de façon bornée et idempotente côté studio. |
| `/api/cron/content-studio/import-status` | `POST` | Lit les posts Postiz sur une fenêtre temporelle et enregistre un snapshot `postiz_status`. |
| `/api/cron/content-studio/import-performance` | `POST` | Lit les analytics d’un nombre limité de posts livrés et enregistre un snapshot `postiz_analytics`. |

Paramètres utiles pour le retry :

- `dryRun=true` : liste les candidats sans créer de brouillon Postiz ni uploader de média.
- `limit=1..25` : nombre maximum de candidats traités.
- `maxAttempts=1..10` : plafond de tentatives par livraison.

Paramètres utiles pour les imports :

- `dryRun=true` : liste les livraisons candidates sans appeler les endpoints d’import ni écrire de snapshot.
- `import-status`: `pastDays`, `futureDays`, `limit`.
- `import-performance`: `days`, `limit`.

Garde-fous v0 :

- Le retry ne retente que le dernier état échoué pour un couple `postId + integrationId`.
- Une livraison plus récente en `sent` ou `auth_failed` bloque le retry d’un ancien échec.
- Les erreurs `auth_failed` ne sont pas retentées automatiquement pour éviter de marteler Postiz quand la clé est invalide.
- Chaque retry réel repasse par le service `createDraftInPostiz`, donc les validations de statut, charte, média prêt et upload Postiz restent centralisées.
- Les imports statut/performance écrivent des snapshots, mais ne modifient pas automatiquement le statut métier FemiGlow tant que le mapping exact des états Postiz n’est pas validé.

Commande de vérification non destructive :

```bash
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:8012/api/cron/content-studio/retry-deliveries?dryRun=true&limit=5"
```

Sources API Postiz utilisées :

- `GET /posts` pour lister les posts sur une fenêtre.
- `GET /analytics/post/{postId}` pour les analytics post par post.

## Automatisations explicitement interdites v0

- Générer et publier sans approbation.
- Modifier automatiquement un post déjà approuvé.
- Remplacer un média produit par une image IA non validée.
- Générer des promesses produit non sourcées.

## Queue

Utiliser une table DB simple au prototype plutôt qu’une nouvelle dépendance :

```txt
content_job(id, type, payload_json, status, attempts, next_attempt_at, last_error)
```

Plus tard, si volume fort : Redis/BullMQ ou worker dédié.

## Idempotence

Clés recommandées :

- génération : `generate:{briefId}:{promptVersion}:{hash(input)}`
- review : `review:{draftId}:{rulesVersion}:{hash(content)}`
- postiz schedule : `postiz:{postId}:{scheduledAt}`
- upload : `upload:{mediaId}:{variant}:{hash(file)}`
