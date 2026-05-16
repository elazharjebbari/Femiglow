# Audit incident - webhook step2 affiche envoye sans livraison

## Symptomes

- L'admin leads peut afficher `step2 envoye`.
- L'ecran `/admin/webhooks` ne montre aucune livraison correspondante.
- Le serveur recepteur ne recoit aucun POST.

## Causes racines

1. `dispatchLeadStep2Webhook` posait `chat_lead.step2_webhook_at` apres l'appel dispatcher, sans verifier que le statut retourne etait `sent`.
   - Effet: `disabled`, `failed` ou `skipped` pouvaient etre presentes comme `step2 envoye`.

2. L'ecran `/admin/webhooks/:id/deliveries` lit `webhook_deliveries`, alors que le webhook plat des leads step2 journalise dans `outbound_webhook_log`.
   - Effet: l'admin webhooks paraissait vide meme quand le pipeline outbound avait cree un log.

3. Sur l'environnement inspecte, `apps/web/.env` ne contient pas `OUTBOUND_WEBHOOK_URL` ni `OUTBOUND_WEBHOOK_SECRET`.
   - Effet: le dispatcher retourne `disabled/no-endpoint-configured` et aucun POST externe ne peut partir.

## Corrections code appliquees

- `step2_webhook_at` est maintenant tamponne uniquement si `dispatchOutbound` retourne `status='sent'`.
- Le read model admin leads priorise le statut reel de `outbound_webhook_log` sur les timestamps legacy.
- `/admin/webhooks` affiche maintenant une table "Outbound plat" basee sur `outbound_webhook_log`.
- Les labels admin gerent le statut `skipped`.
- Tests de regression ajoutes:
  - pas de stamp si aucun endpoint outbound n'est configure;
  - mapping admin depuis `outbound_webhook_log`;
  - priorite du statut outbound sur les anciens timestamps.

## Runbook de validation

1. Configurer l'endpoint recepteur:
   - `OUTBOUND_WEBHOOK_URL=<url HTTPS du recepteur>`
   - `OUTBOUND_WEBHOOK_SECRET=<secret HMAC >= 32 caracteres>`

2. Redemarrer le service apres changement `.env`:
   - `systemctl restart femiglow.service`

3. Creer un lead wizard et completer l'adresse.

4. Verifier:
   - `/admin/leads`: le lead doit afficher `step2 envoye` uniquement si le POST a reussi.
   - `/admin/webhooks`: section `Outbound plat`, ligne `lead-step2 / lead.step2_completed`.
   - Serveur recepteur: reception d'un POST avec `x-femiglow-event=lead.step2_completed`.

5. En cas d'absence de reception:
   - regarder `status`, `responseStatus`, `attemptCount`, `lastError` dans `outbound_webhook_log`;
   - verifier que le secret recepteur valide `x-femiglow-signature`;
   - verifier que l'URL est joignable depuis le serveur.
