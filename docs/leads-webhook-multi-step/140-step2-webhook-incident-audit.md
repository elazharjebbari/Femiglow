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

3. Sur l'environnement inspecte, l'endpoint visible dans `/admin/webhooks`
   appartient au registre `webhook_endpoints`, alors que le step2 initial
   n'utilisait que le dispatcher env-only `OUTBOUND_WEBHOOK_URL`.
   - Effet: l'endpoint admin actif (`lead.created`, `order.created`) n'etait
     jamais consulte par le step2.

## Corrections code appliquees

- `step2_webhook_at` est maintenant tamponne uniquement si `dispatchOutbound` retourne `status='sent'`.
- Le read model admin leads priorise le statut reel de `outbound_webhook_log` sur les timestamps legacy.
- `/admin/webhooks` affiche maintenant une table "Outbound plat" basee sur `outbound_webhook_log`.
- Les labels admin gerent le statut `skipped`.
- Le step2 utilise maintenant en priorite les endpoints admin actifs :
  - `lead.step2_completed` si l'endpoint y est abonne ;
  - fallback compatibilite `lead.created` pour les endpoints existants.
- Si aucun endpoint admin ne matche, le fallback `OUTBOUND_WEBHOOK_URL` reste supporte.
- Tests de regression ajoutes:
  - pas de stamp si aucun endpoint outbound n'est configure;
  - dispatch step2 via endpoint admin legacy `lead.created`;
  - mapping admin depuis `outbound_webhook_log`;
  - priorite du statut outbound sur les anciens timestamps.

## Runbook de validation

1. Configurer l'endpoint recepteur dans `/admin/webhooks`:
   - event recommande : `lead.step2_completed`;
   - compatibilite : un endpoint existant `lead.created` recevra aussi le step2.
   - `OUTBOUND_WEBHOOK_URL` / `OUTBOUND_WEBHOOK_SECRET` restent un fallback env-only si aucun endpoint admin ne matche.

2. Redemarrer le service apres changement `.env`:
   - `systemctl restart femiglow.service`

3. Creer un lead wizard et completer l'adresse.

4. Verifier:
   - `/admin/leads`: le lead doit afficher `step2 envoye` uniquement si le POST a reussi.
   - `/admin/webhooks/<endpoint>/deliveries`: ligne `lead.step2_completed` ou `lead.created` avec `payload.event_name=lead.step2_completed`.
   - Serveur recepteur: reception d'un POST signe via le moteur admin `webhook_deliveries`.

5. En cas d'absence de reception:
   - regarder `status`, `responseStatus`, `attemptCount`, `errorCode` dans `webhook_deliveries`;
   - si le fallback env-only est utilise, regarder `outbound_webhook_log`;
   - verifier que le secret recepteur valide `x-femiglow-signature`;
   - verifier que l'URL est joignable depuis le serveur.
