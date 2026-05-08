# Rapport d'amélioration — Système chat & leads (post-CHA-225)

> Audit du `2026-05-07` après livraison de CHA-225 (union `leads` + `chat_lead`,
> filtre converted, voyant, KPIs conversions, onglet « Leads chat »).
> Couvre 1 544 tests verts (+29 nouveaux), 0 régression.

L'objectif n'est pas de tout corriger d'un coup mais d'avoir une **vue claire
des dettes** et de pouvoir prioriser. Chaque item est tagué par effort et
risque.

---

## 1. Trous fonctionnels (critique → important)

### 1.1 `attributeConversion` n'est jamais appelé en runtime — DETTE CRITIQUE

`apps/web/src/lib/chat/services/session-service.ts:79` définit
`attributeConversion(sessionId, orderId)` : c'est la fonction qui pose
`chat_session.converted_at` et `chat_session.converted_order_id`. **Aucun**
appelant dans le repo (`grep -rn sessionService.attributeConversion src/` →
0 résultat).

Conséquence : avant CHA-225, le KPI `conversions` sur `/admin/chat` restait
**toujours à 0**. Le patch read-side (UNION sur `chat_lead.outcome='converted'`)
masque le problème côté affichage, mais on **perd l'attribution session ↔
order** pour les sessions converties **sans capture de lead** (achat
spontané après chat sans formulaire). Ces conversions n'apparaissent dans
aucun KPI.

**À faire** :
- Hook dans `apps/web/src/app/api/checkout/route.ts` (ou step `order.paid`)
  pour appeler `sessionService.attributeConversion(sessionId, orderId)`
  quand le visiteur a une session chat active (`cookie chat_session_id`).
- Ajouter test e2e : « commande passée pendant chat → KPI conversions
  incrémenté ».
- Effort : **1-2 j**. Risque : **élevé** (cookie de tracking, edge cases
  paiement asynchrone).

### 1.2 Aucune UI admin pour modifier `chat_lead.outcome`

Pour passer un lead de `pending` → `reached` → `converted`, il faut
actuellement **éditer la DB en SQL direct**. Le tableau `/admin/chat/leads`
est en lecture seule, et `/admin/leads/[id]` (vue détail mutualisée) ne
gère que les `leads` ecommerce — pas les `chat_lead`.

**À faire** :
- Endpoint `POST /api/admin/chat/leads/[id]/outcome` (Zod + audit log).
- Composant `OutcomeMenu` similaire à `LeadStatusMenu` mais pour les
  outcomes chat (`pending|reached|no-answer|converted|discarded`).
- Form ajouter `convertedOrderId` quand outcome=converted (sélecteur
  parmi les commandes du visiteur).
- Effort : **1 j**. Risque : **faible**.

### 1.3 Pas d'**export CSV** sur `/admin/chat/leads`

Le composant `ExportCsvButton` existe déjà
(`src/components/admin/analytics/primitives/ExportCsvButton.tsx`) mais
n'est pas branché sur la page leads chat. Pour un commercial qui veut
ouvrir une feuille de calcul ou nourrir un CRM externe, c'est bloquant.

**À faire** :
- Endpoint `GET /api/admin/chat/leads/export?format=csv` (renvoie tous
  les filtres de la page).
- Brancher le bouton dans le header de la page.
- Effort : **0,5 j**. Risque : **faible**.

### 1.4 Pas de pagination sur `/admin/chat/leads`

La page passe `limit: 200` en dur. Au-delà, on tronque silencieusement.
Pas de tri non plus (toujours `desc(createdAt)`).

**À faire** :
- Pagination cursor (`?cursor=cl_xxx`) ou page-based.
- Tri par colonne (createdAt, outcome, triggerReason, page).
- Effort : **0,5 j**. Risque : **faible**.

### 1.5 Pas de webhook automatique sur `outcome=converted`

Le `dispatchLeadWebhook` est appelé à la création (`lead.created`), mais
**rien** ne se déclenche quand le outcome passe à `converted`. Or c'est
l'événement business le plus précieux : « lead transformé en client ».
Un CRM externe doit aujourd'hui *poller* la base pour le savoir.

**À faire** :
- Étendre le contrat webhook : event `lead.outcome_changed` avec
  `oldOutcome`, `newOutcome`, `convertedOrderId`.
- Hook dans le futur endpoint outcome (1.2) : si `outcome=converted`,
  dispatcher l'event.
- Effort : **0,5 j**. Risque : **moyen** (bump version contrat → coordo
  côté receveur).

### 1.6 Toggle `lead_form_enabled` non exposé en UI admin

La route `/api/chat/lead/contact` court-circuite à 503 si
`getRuntimeBool('lead_form_enabled')` est faux. Mais aucune UI ne permet
de toggle ce flag — il faut éditer `chat_runtime_setting` en SQL.

**À faire** :
- Section « Toggles runtime » sur `/admin/chat` (ou `/admin/chat/system`).
- Listing des toggles connus (`chat_active`, `lead_form_enabled`,
  `humanizer_enabled`, etc.) avec form POST.
- Effort : **0,5 j**. Risque : **faible**.

### 1.7 `chat_lead.handledBy` / `handledAt` jamais peuplés

Les colonnes existent (`schema.ts:499`) mais aucun code ne les set —
même pas dans le futur endpoint outcome. Sans, on ne peut pas tracer
qui a appelé/qualifié le lead côté équipe.

**À faire** :
- À chaque update outcome, set `handledBy=session.email` +
  `handledAt=now()`.
- Afficher la colonne dans `/admin/chat/leads` (cachée par défaut, accent
  hover).
- Effort : **0,2 j** (intégrée dans 1.2). Risque : **faible**.

---

## 2. Qualité de code

### 2.1 5 erreurs TypeScript pré-existantes — DETTE FONDÉE

```
src/lib/chat/admin/queries.ts(204,26): error TS2339: Property 'rows' does
  not exist on type 'RowList<...> | NeonHttpQueryResult<...>'.
src/lib/chat/repos/knowledge.ts(156,24): même erreur
src/lib/chat/repos/message.ts(72,17): même erreur
src/lib/chat/secrets.test.ts(34,19): error TS2554: Expected 0 args, got 1.
src/lib/db/queries/media-jobs.ts(249,18): error TS2554: Expected 0 args, got 1.
```

Le pattern `db.execute(sql\`…\`)` retourne un type **union** entre
`postgres-js` (`RowList`) et `Neon HTTP` (`NeonHttpQueryResult`). On
accède à `.rows` partout, donc TypeScript râle quand le path
postgres-js est sélectionné.

**À faire** :
- Helper `executeRows<T>(db, sql)` qui normalise les deux drivers et
  renvoie `T[]` directement.
- Migrer les 3 callers chat + 2 callers ailleurs.
- Effort : **0,5 j**. Risque : **faible**.

### 2.2 `convertedSessionIds` appelé deux fois sur `/admin/chat/conversations`

Page `/admin/chat/conversations` :
1. `listConversations({ converted })` → si filtre actif, calcule les
   converted ids en interne.
2. Ensuite, le RSC re-appelle explicitement
   `await adminQueries.convertedSessionIds()` pour décorer les lignes.

Coût : 4 SELECTs au lieu de 2. Sur une base à 100k sessions, c'est
sensible (les index couvrent mais le coût reste).

**À faire** :
- Renvoyer le set depuis `listConversations` (option `withConvertedSet:
  true`) ou cacher au niveau composant.
- Effort : **0,2 j**. Risque : **faible**.

### 2.3 Mock Drizzle dupliqué dans les tests

`leads.union.test.ts` (CHA-225 partie 1) et `queries.test.ts` (CHA-225
partie 2) ré-implémentent chacun un `makeChainable` similaire. Aucun
code partagé.

**À faire** :
- Helper `src/test/db/chainable.ts` exposant un builder Drizzle
  mockable, paramétrable par table → rows.
- Effort : **0,3 j**. Risque : **faible** (refactor de tests).

---

## 3. Sécurité & observabilité

### 3.1 RBAC monolithique

`requireAdmin()` est binaire : soit tu es admin (accès tout), soit pas.
Pour une équipe de 3-5 personnes (commercial, conseillère, fondatrice),
il faudrait :
- rôle `viewer` : voit `/admin/chat/leads` + `/admin/chat/conversations`,
  pas `/admin/chat/providers`.
- rôle `editor` : peut update outcome.
- rôle `admin` : tout.

**À faire** :
- Champ `role` sur `admin_user` + middleware `requireRole('editor')`.
- Effort : **2-3 j**. Risque : **moyen** (impact tous les routes admin).

### 3.2 Pas d'audit log sur les modifications de lead

Il n'y a pas de table `chat_lead_audit` qui capture qui a changé quoi
quand. Si un lead `converted` est repassé à `discarded` par erreur, on
n'a aucune trace.

**À faire** :
- Étendre `chat_conversation_event` ou créer table dédiée :
  `chat_lead_audit(leadId, actor, action, oldValue, newValue, at)`.
- Logger à chaque update outcome (1.2).
- Effort : **0,5 j**. Risque : **faible**.

### 3.3 Idempotence webhook lead

`dispatchLeadWebhook` ne pose pas de header `Idempotency-Key`. Si le
receveur reçoit le payload puis renvoie 5xx alors qu'il l'a déjà traité,
le retry crée un doublon côté CRM.

**À faire** :
- Header `Idempotency-Key: lead-${leadId}-v${attempt}` ou
  `lead-${leadId}` (constant) — selon contrat receveur.
- Effort : **0,1 j**. Risque : **faible**.

### 3.4 Pas de DLQ pour les webhooks chat lead

Si `webhook_status='failed'` après MAX_ATTEMPTS, le lead reste tel quel.
Aucun cron ne re-tente, aucune alerte n'est envoyée. Le canal
`webhook_endpoints` (e-commerce) a un système de retry async géré par
`attemptDelivery` ; le canal chat lead est **synchronisé** dans la
requête HTTP (3 tentatives en ligne, puis abandon).

**À faire** :
- Brancher `dispatchLeadWebhook` sur le même engine que
  `webhook_endpoints` (queue async, cron tick).
- Effort : **1 j**. Risque : **moyen** (impact contrat de réponse de la
  route `/api/chat/lead/contact`).

### 3.5 Le tableau `/admin/chat/leads` n'affiche **pas** le champ `note`

La colonne `chat_lead.note` est saisissable mais jamais affichée. Le
commercial voit Trigger / Outcome / Phone mais pas la note libre laissée
par le visiteur.

**À faire** :
- Ajouter une expansion ligne (`<details>`) ou tooltip.
- Effort : **0,1 j**. Risque : **faible**.

---

## 4. UX admin

### 4.1 Recherche `/admin/leads` ne normalise pas les téléphones

Si l'utilisateur tape `0612345678`, le LIKE échoue car la base stocke
`+212612345678` (E.164). Ce point est déjà documenté dans
`leads.union.test.ts:259` : *« Le caller doit donc taper une sous-chaîne
reconnaissable »*. UX inacceptable pour un commercial qui n'apprend pas
le format E.164 par cœur.

**À faire** :
- Normaliser la query : si elle commence par 0 et fait 10 chiffres,
  préfixer `+212` ; si 9 chiffres, préfixer `+212`.
- Effort : **0,2 j**. Risque : **faible**.

### 4.2 Pas de filtre date sur `/admin/chat/leads`

Filtres actuels : outcome + trigger. Manque une fenêtre temporelle
(« 7 derniers jours », « ce mois », range custom). Surtout utile pour
isoler les leads d'une campagne (UTM).

**À faire** :
- Filtres `from` + `to` (date input) + presets.
- Effort : **0,3 j**. Risque : **faible**.

### 4.3 Pas de filtre UTM / page sur `/admin/chat/leads`

Les colonnes `utm` (jsonb) et `page` existent mais ne sont pas
filtrables en UI. C'est dommage car c'est exactement ce qui permet de
mesurer l'efficacité d'une campagne.

**À faire** :
- Filtre par `utm_source`, `utm_campaign`, `page` (search libre).
- Effort : **0,5 j**. Risque : **faible**.

### 4.4 Pas de drill-down depuis le KPI `Conversions`

Sur `/admin/chat`, cliquer sur la carte « Sessions converties » devrait
amener à `/admin/chat/conversations?converted=yes`. Aujourd'hui les
cartes ne sont pas cliquables.

**À faire** :
- Wrap chaque `<Kpi>` pertinent dans un `<Link>`.
- Effort : **0,1 j**. Risque : **faible**.

### 4.5 Voyant converted absent sur `/admin/leads` (vue mutualisée)

Le voyant CHA-225 a été ajouté sur `/admin/chat/conversations` mais pas
sur `/admin/leads` (la vue qui mélange ecommerce + chat). Pour un lead
chat marqué converted, on voit `status=converted` (badge) mais pas la
session associée ni le voyant visuel.

**À faire** :
- Ajouter le voyant + lien vers la conversation (`/admin/chat/
  conversations/${l.sessionId}`).
- Effort : **0,2 j**. Risque : **faible**.

---

## 5. Tests (au-delà de cette livraison)

### 5.1 Tests `attributeConversion` absents

Aucun test ne couvre la fonction. Si on l'appelle effectivement (cf.
1.1), il faudra :
- test unitaire : update OK quand `convertedAt` est null.
- test : idempotent (deuxième appel ne change pas `convertedAt`).
- test : `chat_lead.outcome` linké à la session passe à `converted`
  automatiquement (cascade ou pas ?).

### 5.2 Playwright login flaky en local

Les tests qui appellent `login()` plantent en local — l'ancien comme le
nouveau. Symptôme : `waitForURL(/\/admin/)` timeout 15s. Cause probable :
rate-limit après plusieurs runs successifs, ou form submission via
`fetch` qui n'attend pas le redirect côté React.

**À faire** :
- Pattern `storageState` (login une fois, dump cookie, réutilisé par
  tous les tests).
- Effort : **0,3 j**. Risque : **faible**. Bénéfice : **gros** (suite
  E2E utilisable).

### 5.3 Aucun test e2e du flow complet `/api/chat/lead/contact` → webhook → admin

On a maintenant :
- unit tests pour la route (`route.test.ts`)
- MSW tests pour le webhook (`chat-lead-webhook.test.ts`, ajouté dans
  cette livraison)
- mais pas de test « bout à bout » qui valide : capture inline →
  insertion DB → webhook reçu → lead visible dans `/admin/chat/leads`.

**À faire** :
- Test Playwright qui simule un visiteur chat, pose son téléphone, puis
  navigue vers `/admin/chat/leads` et vérifie qu'il est listé.
- Effort : **0,5 j**. Risque : **moyen** (orchestration test DB).

### 5.4 Pas de coverage report

`vitest run --coverage` n'est jamais lancé. On ne sait pas quelle est la
couverture réelle des chemins critiques (chat/repos, chat/services,
admin/queries).

**À faire** :
- Activer `c8` ou `v8` provider dans `vitest.config.ts`.
- Cible initiale : 70 % statements pour `lib/chat/**`.
- Effort : **0,2 j** (config) + dette progressive.

---

## 6. Performance / scalabilité

### 6.1 `convertedSessionIds()` ne scale pas linéairement

À 100k sessions / 50k leads, on récupère **toutes** les ids dans deux
arrays Node, on les met dans un Set en mémoire, puis on filtre. Pour une
plage temporelle large, ça consomme inutilement de la RAM serveur RSC.

**À faire** :
- Passer à une vraie sous-requête SQL (`WHERE id IN (SELECT … UNION
  SELECT …)`) plutôt qu'un round-trip Node.
- Effort : **0,3 j**. Risque : **faible** (test couverture en place).

### 6.2 `overviewKpis` fait 8 round-trips DB séquentiels

Chaque KPI = un SELECT séparé. À pleine charge (admin qui rafraîchit en
boucle pendant un live), c'est 8x latence DB par render.

**À faire** :
- Combiner en une seule CTE (`WITH s AS …, m AS …, c AS … SELECT *`).
- Effort : **0,5 j**. Risque : **moyen** (testabilité du builder).

### 6.3 Pas d'index composé sur `chat_lead(outcome, createdAt)` filtré

Index existant : `chat_lead_outcome_idx` sur `(outcome, createdAt)` →
**OK** pour le filtre liste. Pas de remarque ici, juste validation.

---

## 7. Documentation

### 7.1 Doc `19-lead-capture-form.md` ne mentionne pas l'union read-side CHA-225

La spec d'origine décrit le pipeline de capture mais pas le **lien
back** vers `/admin/leads` ni le filtre converted. À mettre à jour.

### 7.2 Pas de doc « cycle de vie d'un chat lead »

Diagramme manquant : `pending → reached → no-answer → (rejected |
converted | discarded)`. Utile pour onboarding équipe.

**À faire** :
- Ajouter `21-chat-lead-lifecycle.md` avec diagramme Mermaid.
- Effort : **0,3 j**. Risque : **nul**.

---

## Synthèse priorisée

| # | Item | Effort | Risque | Priorité |
|---|------|--------|--------|----------|
| 1.1 | Hook `attributeConversion` runtime | 1-2 j | élevé | **P0** |
| 1.2 | Endpoint admin update outcome | 1 j | faible | **P0** |
| 2.1 | Helper `executeRows` (5 erreurs TS) | 0,5 j | faible | **P1** |
| 1.3 | Export CSV `/admin/chat/leads` | 0,5 j | faible | **P1** |
| 1.5 | Webhook `lead.outcome_changed` | 0,5 j | moyen | **P1** |
| 5.2 | Playwright `storageState` | 0,3 j | faible | **P1** |
| 4.1 | Normalisation phone search | 0,2 j | faible | **P1** |
| 1.6 | Toggle UI `lead_form_enabled` | 0,5 j | faible | **P2** |
| 3.1 | RBAC `viewer/editor/admin` | 2-3 j | moyen | **P2** |
| 3.2 | Audit log lead | 0,5 j | faible | **P2** |
| 1.4 | Pagination `/admin/chat/leads` | 0,5 j | faible | **P2** |
| 5.4 | Coverage report | 0,2 j | nul | **P3** |
| 6.1 | `convertedSessionIds` SQL only | 0,3 j | faible | **P3** |
| 6.2 | `overviewKpis` 1-CTE | 0,5 j | moyen | **P3** |
| 7.2 | Doc cycle de vie | 0,3 j | nul | **P3** |

**Total dette identifiée** : ~14 j-homme cumulés. P0+P1 (immédiats) :
~4 j.

**Recommandation : sprint dédié sur les P0** (1.1 + 1.2 = 2-3 j) pour
fermer le trou principal — sans `attributeConversion` runtime, les KPIs
ne reflètent pas la réalité business et le voyant CHA-225 ment par
omission sur ~30 % des conversions (estimation à valider via les logs).
