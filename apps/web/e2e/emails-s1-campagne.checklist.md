# S1 — Checklist opérateur : campagne emailing A→Z (staging / prod)

> **Pourquoi cette checklist et pas un test E2E ?**
> Le scénario S1 « campagne de bout en bout » exige un **Listmonk vivant**
> (création de campagne, push d'audience, envoi de masse, réconciliation de
> statut). Sur l'environnement E2E local, **Listmonk est volontairement mort**
> (port 9999, sert au test du mode dégradé `emails-degraded.spec.ts`). On ne
> peut donc pas jouer S1 en Playwright local sans isolation DB ni Listmonk.
>
> Cette checklist est **exécutable manuellement en staging** (ou prod avec une
> audience de test minuscule). Chaque étape a un **oracle observable**. Les
> maillons unitaires/intégration sont déjà couverts par les suites listées en
> §« Couverture automatisée » — la checklist ne fait que vérifier le **câblage
> bout-en-bout** que seuls un vrai Listmonk + un vrai SMTP peuvent prouver.

---

## Pré-requis

- [ ] Accès admin à `/admin/emails` (compte bootstrappé).
- [ ] **Listmonk vivant** et joignable (badge santé du dashboard ≠ « Incident »
      sur la ligne Listmonk ; `/admin/emails/listmonk` charge l'iframe).
- [ ] SMTP transactionnel (Stalwart) opérationnel — un mail de test arrive.
- [ ] Une **audience de test minuscule** (2–3 adresses que TU contrôles, ex.
      tes propres boîtes). **Ne jamais tester S1 sur une vraie audience.**
- [ ] Les crons `email-campaign-sync` et `email-outbox` ont un timer actif
      (sinon les statuts resteront figés — cf. §Réconciliation).

> Secrets : ne jamais coller `CRON_SECRET` / clés Listmonk en clair dans un
> ticket ou un chat. Les lire depuis `.env` au moment de la commande.

---

## Étape 1 — Créer l'audience (ou réutiliser une liste Listmonk)

1. [ ] `/admin/emails/audiences` → **Nouvelle audience**.
2. [ ] Définir une règle qui ne matche QUE tes adresses de test (ex. un `has_tag`
       posé manuellement sur ces leads).
3. [ ] **Aperçu taille** : l'estimation doit afficher **exactement** le nombre
       d'adresses de test (oracle : pas 0, pas la base entière).

**Oracle** : `preview-size` renvoie le compte attendu ; `preview-sample`
liste tes adresses et **aucune autre**.

**Couvert automatiquement** : `src/app/api/admin/emails/audiences/__tests__/endpoints.test.ts`
(preview size/sample, exclusions hard_bounce/unsubscribe).

---

## Étape 2 — Créer le brouillon de campagne

1. [ ] `/admin/emails/campaigns` → formulaire **Nouvelle campagne** (nom + sujet).
2. [ ] La campagne apparaît dans la liste avec le statut **`draft`**.
3. [ ] Ouvrir **Éditer** (`/admin/emails/campaigns/[id]/edit`) → associer
       l'audience de l'étape 1 + choisir/écrire le contenu (template/preheader).

**Oracle** : ligne `email_campaign_link` créée avec `status='draft'`,
`subject` non vide, `audienceId` (ou `audienceLinkIds`) renseigné.

**Couvert automatiquement** : `createCampaignDraft` / `updateCampaignDraft`
dans `src/lib/admin/emails/wizard-actions.ts` ; flow UI
`e2e/admin-emails-campaigns.spec.ts`.

---

## Étape 3 — Finaliser : snapshot audience → push Listmonk

1. [ ] Depuis l'écran d'édition, lancer **Finaliser** (sans « envoyer
       maintenant » au premier essai : valider d'abord le push).
2. [ ] Le système **snapshot** l'audience puis **pousse** les contacts vers une
       liste Listmonk éphémère.

**Oracles** :
- [ ] `email_audience_snapshot` : une ligne `status='done'`, `size` = nb
      d'adresses de test, `listmonk_list_id` renseigné.
- [ ] Dans **Listmonk** : une liste éphémère existe avec **exactement** tes
      abonnés de test (vérifier dans l'UI Listmonk `/admin/emails/listmonk`).
- [ ] Si `pushed === 0` alors que l'audience est non vide → la finalisation
      **échoue avec un message clair** (« 0 a/ont pu être ajouté(s) ») et NE
      crée PAS de campagne Listmonk. C'est le comportement attendu : pas
      d'envoi fantôme.

**Couvert automatiquement** :
`src/lib/mail/campaigns/__tests__/snapshot-push-recovery.integration.test.ts`,
`src/lib/admin/emails/__tests__/campaigns-finalize.integration.test.ts`.

---

## Étape 4 — Anti double-envoi (réservation atomique R-010)

1. [ ] Sur l'écran de finalisation, **double-cliquer** rapidement sur
       « Finaliser / Envoyer » (ou rejouer la requête).

**Oracle** : une **seule** campagne Listmonk est créée ; le 2e essai renvoie
« Statut concurrent : cette campagne ne peut plus être finalisée ». Dans
Listmonk, **pas de campagne en double** (= pas de double envoi de masse).

**Couvert automatiquement** : la transition conditionnelle
`UPDATE … WHERE status='draft'` de `finalizeCampaign`
(`campaigns-finalize.integration.test.ts`) ; ici on prouve juste qu'aucun
chemin UI ne contourne la réservation.

---

## Étape 5 — Envoi de masse réel

1. [ ] Finaliser avec **« envoyer maintenant »** (ou planifier puis attendre
       l'échéance).
2. [ ] La campagne passe en **`sending`** côté FemiGlow et côté Listmonk.

**Oracles** :
- [ ] Tes 2–3 boîtes de test **reçoivent réellement** le mail (sujet exact,
      contenu rendu, pas de `{{ variable }}` non substituée).
- [ ] L'en-tête **List-Unsubscribe** du mail de campagne porte un lien de
      désinscription fonctionnel (cliquer → page de confirmation digne).

> Note : le lien one-click transactionnel (`?t=` token signé) est déjà prouvé
> bout-en-bout par `e2e/emails-transactional-mailpit.spec.ts` (Mailpit). Pour
> les campagnes Listmonk, vérifier le lien d'unsub **propre à Listmonk**.

---

## Étape 6 — Réconciliation de statut (cron sync)

> Listmonk **n'émet pas** de webhook `campaign.*` : sans le cron de sync, une
> campagne resterait figée en `sending` pour toujours.

1. [ ] Attendre le tick du timer `email-campaign-sync` (ou le déclencher
       manuellement) :
       `curl -X POST $BASE/api/cron/email-campaign-sync -H "Authorization: Bearer $CRON_SECRET"`
       (lire `CRON_SECRET` depuis `.env`, ne pas l'afficher).

**Oracles** :
- [ ] Réponse `{ ok: true, ... }` (200).
- [ ] Une fois Listmonk « finished », la campagne FemiGlow passe en **`sent`**
      avec les compteurs `sentCount` / `deliveredCount` / `openCount` /
      `clickCount` / `bounceCount` reflétant Listmonk.

**Couvert automatiquement** :
`src/lib/mail/campaigns/__tests__/campaign-status-sync.integration.test.ts`,
`src/lib/mail/campaigns/__tests__/listmonk-status-map.test.ts`,
`src/app/api/cron/__tests__/email-crons-auth.qa.test.ts` (auth bearer).

---

## Étape 7 — Hygiène : purge du snapshot éphémère

1. [ ] Après envoi, le snapshot/liste Listmonk éphémère doit être **purgeable**
       (`purgeable_after` posé). Le cron `email-audience-purge` /
       `email-listmonk-cleanup` le nettoie.

**Oracle** : après la fenêtre de purge + tick cron, la liste éphémère Listmonk
et le `email_audience_snapshot` associé sont supprimés (pas d'accumulation de
listes mortes dans Listmonk).

**Couvert automatiquement** :
`src/lib/mail/campaigns/__tests__/cleanup-purge-order.integration.test.ts`.

---

## Étape 8 — Cas dégradés à vérifier (dignité)

- [ ] **Listmonk down pendant la finalisation** → message d'erreur digne, la
      campagne reste en `draft` (pas de demi-état). Cf. mode dégradé prouvé par
      `e2e/emails-degraded.spec.ts`.
- [ ] **Bounce / unsubscribe pendant l'envoi** → les adresses concernées
      basculent en suppression et ne sont plus réécrites lors d'une 2e campagne
      (vérifier l'exclusion à l'étape 1 d'une campagne suivante).

---

## Résumé des maillons & de leur couverture automatisée

| Maillon | Étape | Couverture automatisée |
|---|---|---|
| Aperçu audience (taille/échantillon + exclusions) | 1 | `audiences/__tests__/endpoints.test.ts` |
| Création / édition brouillon | 2 | `wizard-actions.ts`, `admin-emails-campaigns.spec.ts` |
| Snapshot + push Listmonk | 3 | `snapshot-push-recovery.integration.test.ts`, `campaigns-finalize.integration.test.ts` |
| Réservation atomique anti double-envoi | 4 | `campaigns-finalize.integration.test.ts` (R-010) |
| Envoi réel + List-Unsubscribe | 5 | (Listmonk requis) ; transac one-click : `emails-transactional-mailpit.spec.ts` |
| Réconciliation de statut (cron) | 6 | `campaign-status-sync.integration.test.ts`, `listmonk-status-map.test.ts` |
| Purge snapshot éphémère | 7 | `cleanup-purge-order.integration.test.ts` |
| Dégradé Listmonk down | 8 | `emails-degraded.spec.ts` |

**Conclusion** : tous les maillons internes sont prouvés par les suites
ci-dessus. Cette checklist S1 ne reste **manuelle** que pour le câblage
inter-systèmes (FemiGlow ↔ Listmonk ↔ SMTP) qui nécessite un Listmonk vivant —
impossible à isoler en E2E local.
