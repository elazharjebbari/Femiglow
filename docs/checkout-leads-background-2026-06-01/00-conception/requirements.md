# 00 — Exigences (traçables)

Chaque exigence a un ID stable, référencé par les tâches ([`../03-dev-plan/tasks.csv`](../03-dev-plan/tasks.csv))
et les tests ([`../04-tests/test-matrix.csv`](../04-tests/test-matrix.csv)).

## Exigences fonctionnelles (FR)

| ID | Exigence | Critère d'acceptation | Priorité |
|---|---|---|---|
| FR-01 | Le `leadId` est généré côté client avant tout appel réseau. | `createId('cl')` produit un id valide ; envoyé dans chaque envelope ; accepté tel quel par le serveur. | MUST |
| FR-02 | L'UI avance dès le submit, sans attendre la réponse réseau. | Sous réseau coupé/throttlé 5 s, l'étape suivante est visible < 50 ms. | MUST |
| FR-03 | Chaque mutation est mise en file et envoyée en tâche de fond. | Envelope présente dans `lead-sync-queue` ; envoi non-awaité ; observable via logs/devtools. | MUST |
| FR-04 | Les endpoints serveur sont idempotents et en upsert-by-leadId. | Rejeu d'une envelope (même `Idempotency-Key`) ⇒ même réponse, 0 doublon ; arrivée désordonnée tolérée. | MUST |
| FR-05 | Les rows `chat_lead` partielles continuent d'être écrites à chaque étape. | Après lead_capture/address, la row existe avec les timestamps attendus. | MUST |
| FR-06 | À la fermeture/masquage de l'onglet, les envelopes en attente sont flushées. | `pagehide`/`visibilitychange:hidden` ⇒ `sendBeacon('/api/checkout/lead/sync')` avec le reste de la file. | MUST |
| FR-07 | La conversion (commande) embarque le snapshot complet du lead. | `order_create` réussit même si les écritures de fond ne sont pas encore arrivées. | MUST |
| FR-08 | Les effets de bord lourds (tracking serveur, webhook) passent par l'outbox. | Une row `lead_event_outbox` est créée ; le worker la traite ; retry sur échec. | MUST |
| FR-09 | Le funnel chat (`LeadFormBubble`/`use-chat-send`) bénéficie du même pattern optimiste. | Le chat n'attend plus le réseau pour confirmer la saisie. | SHOULD |
| FR-10 | Le comportement legacy (await bloquant) reste disponible via flag OFF. | Flag OFF ⇒ chemin actuel inchangé (bit-à-bit). | MUST |
| FR-11 | Surfaçage non-bloquant des erreurs de sync persistantes. | Après N échecs, un indicateur discret (toast/badge) invite à réessayer, sans bloquer la navigation. | SHOULD |

## Exigences non-fonctionnelles (NFR)

| ID | Exigence | Mesure / seuil |
|---|---|---|
| NFR-01 | Latence transition UI | p95 < 50 ms, indépendant du RTT. |
| NFR-02 | Aucune perte de lead validé | 0 perte mesurée sur scénario fermeture-en-vol (test Playwright + beacon). |
| NFR-03 | Idempotence | Propriété vérifiée par test : rejeu ×N ⇒ 1 effet. |
| NFR-04 | Délai persistance background | p95 < 5 s ; borne dure : flush beacon garantit ≤ fin de session. |
| NFR-05 | Délai effet outbox | p95 < 90 s (cron 60 s). |
| NFR-06 | Observabilité | logs structurés `owbs.*`, métriques file/outbox, alertes sur backlog. |
| NFR-07 | Réversibilité | kill-switch (flag OFF) effectif sans redeploy. |
| NFR-08 | Qualité de code | TS strict, 0 `any` non justifié, lint clean, couverture ≥ 90 % sur le cœur. |
| NFR-09 | Compatibilité | Comportement identique iOS Safari / Chrome Android (cibles principales Maroc). |
| NFR-10 | Sécurité/RGPD | PII jamais loggée en clair ; consentement respecté ; idempotency-key non-PII. |

## Matrice de traçabilité (extrait)

| Exigence | ADR | Module | Test |
|---|---|---|---|
| FR-01 | ADR-0002 | `client/lead-id.ts` | TST-U-01 |
| FR-02 | ADR-0001 | `state/wizard-store.ts` | TST-E-01 |
| FR-03 | ADR-0003 | `state/lead-sync-queue.ts` | TST-U-10..14 |
| FR-04 | ADR-0002, ADR-0006 | `repos/lead-repo.ts`, `idempotency-*` | TST-I-01..04 |
| FR-06 | ADR-0005 | `client/beacon-flush.ts` | TST-E-04 |
| FR-08 | ADR-0004 | `lib/leads/outbox/*`, `cron/lead-outbox` | TST-I-05..08 |
