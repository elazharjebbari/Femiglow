# Scénarios métier — Cockpit transactionnel

> Persona : **Salma** (opératrice). Le cockpit est son poste de travail pour
> diagnostiquer et corriger les envois. Les scénarios privilégient les défauts
> P0 de l'audit (faux succès, pagination, sémantique). Oracles = assertions de
> la batterie.

---

## Scénario 1 — Gérer un incident de 200 échecs SMTP, du tri à la résolution

**Contexte métier.** Une coupure SMTP de 20 min a fait échouer ~200 confirmations
de commande. Le SMTP est revenu. Salma doit retrouver les 200, les relancer, et
**vérifier** que la relance a réellement abouti (pas un faux succès).

**Préconditions data.**
- `email_outbox` : 200 rows `failed` (`last_error='SMTP 421 temporary'`), template
  `order-confirmation`, créées dans la dernière heure. + bruit : 4 000 autres rows variées.

**Déroulé & oracles.**
1. Salma ouvre le cockpit. Le `KpiHeader` montre *Échecs* élevé.
   - *Oracle cible* : la tendance *Échecs* en hausse est **rouge** (mauvais), pas verte. `CKP-MSW-060`.
   - *Oracle* : clic sur la carte *Échecs* applique `status:failed,dlq`. `CKP-MSW-065`.
2. Elle affine en ⌘K : `status:failed template:order-confirmation after:-1h`.
   - *Oracle* : les 3 filtres sont résolus, Entrée les applique au tableau. `CKP-MSW-092`, `CKP-UNIT-001`, `CKP-UNIT-008`.
3. Le tableau montre « 50 affichés sur 200 total ». Elle veut les 200.
   - *Oracle cible* : `select-all` avertit « 50 sur cette page · sélectionner les 200 correspondant aux filtres » ; elle choisit la sélection étendue. `CKP-MSW-033`, `CKP-MSW-034`.
4. Elle clique **Retry sélection**. Le serveur ne relance que les éligibles.
   - *Oracle* : feedback honnête « 200 relancés, 0 ignorés » (ou « 197 relancés, 3 ignorés (wrong_status) » si certains ont déjà bougé). La sélection n'est vidée **qu'après** confirmation de succès `res.ok`. `CKP-MSW-040`, `CKP-MSW-046`, `CKP-DB-047`.
5. Le re-fetch montre les rows repassées `pending`. Le cron les drainera.
   - *Oracle DB* : `bulkRetry` a remis `status='pending'`, `attempts=0`, `last_error=null` sur les éligibles uniquement. `CKP-DB-047`.
6. **Anti-piège F-013** : si l'étape 4 avait renvoyé 500, l'oracle exige une **alerte
   visible + sélection conservée**, JAMAIS un faux « succès » avec sélection vidée. `CKP-MSW-043`.

---

## Scénario 2 — Session expirée en plein bulk (faux succès, audit C1)

**Contexte métier.** Salma laisse l'onglet ouvert pendant le déjeuner. Sa session
iron-session expire. À son retour elle sélectionne 80 lignes et clique **Retry**.

**Préconditions data.**
- 80 rows `dlq` sélectionnables ; session admin expirée (le `requireAdmin` route renvoie 401).

**Déroulé & oracles.**
1. Clic **Retry sélection** → la route `bulk-retry` répond **401**.
   - *Oracle cible (F-013)* : un `role="alert"` « session expirée, reconnecte-toi » s'affiche. `CKP-MSW-041`, `CKP-E2E-111`.
2. *Oracle anti-faux-succès* : la **sélection de 80 est CONSERVÉE** (`selection-count` inchangé), aucun re-fetch trompeur n'a « avalé » l'échec. `CKP-MSW-041`.
3. Salma se reconnecte (autre onglet), revient, re-clique **Retry**.
   - *Oracle* : cette fois 200/résultat partiel honnête. `CKP-MSW-040`.
4. **Variante suppress** : même grille pour `bulk-suppress` 401/500 → alerte + sélection conservée. `CKP-MSW-051`, `CKP-MSW-052`.

---

## Scénario 3 — Pagination : l'opérateur doit atteindre la 51ᵉ ligne (audit F-011)

**Contexte métier.** Salma cherche un envoi précis vers `cliente@exemple.test`,
mais il est en position 73 dans le tri par date. Aujourd'hui, **impossible** : le
cockpit est bloqué aux 50 premières lignes.

**Préconditions data.**
- 5 000 rows ; la cible est en 73ᵉ position du tri `date_desc`.

**Déroulé & oracles (état CIBLE).**
1. Tableau : « 50 affichés sur 5 000 total ». Salma voit un contrôle de pagination.
   - *Oracle cible* : bouton **Suivant** présent et actif. `CKP-MSW-020`.
2. Elle clique **Suivant**.
   - *Oracle cible* : nouveau POST `search` avec `pagination.offset=50` ; indicateur « 51–100 sur 5 000 ». `CKP-MSW-021`, `CKP-MSW-025`.
3. Elle trouve sa ligne (73ᵉ), clique le destinataire → page détail.
   - *Oracle* : navigation vers `/admin/emails/transactional/{id}`. `CKP-E2E-112`.
4. Bornes : en page 1 **Précédent** est désactivé ; sur la dernière page **Suivant** l'est. `CKP-MSW-023`, `CKP-MSW-024`.
5. Si elle change un filtre, retour page 1. `CKP-MSW-026`.
6. **Non-régression** : tant que `setOffset` n'est pas câblé à un contrôle UI, `CKP-MSW-020`/`021` échouent (rouge volontaire).

---

## Scénario 4 — Suppression de masse avec propagation Listmonk (audit F-014)

**Contexte métier.** Une fuite de liste a généré 30 hard bounces vers un domaine
mort. Salma veut blocklister ces adresses **partout** (transactionnel + campagnes).

**Préconditions data.**
- 30 rows `bounced_permanent` vers `@domainemort.test`.

**Déroulé & oracles.**
1. Filtre `status:bounced_permanent`, select-all (30 < 50, pas d'avertissement étendu). `CKP-MSW-032`.
2. Clic **Marquer en suppression** → `window.confirm`.
   - *Oracle* : confirmation honorée ; annuler ⇒ 0 POST. `CKP-MSW-054`.
3. Validation → POST `bulk-suppress`.
   - *Oracle DB* : insertion dans `email_suppression` + rows passées `suppressed`. `CKP-DB-057`.
   - *Oracle cible (F-014)* : un **POST blocklist Listmonk** est aussi émis. `CKP-MSW-056`.
4. Vérification d'efficacité bout-en-bout.
   - *Oracle DB cible* : un `sendTransactional` ultérieur vers ces adresses est **bloqué**, ET elles sont **exclues du prochain snapshot de campagne**. `CKP-DB-058`.
5. **Anti-piège** : si le POST échoue (500), alerte + sélection conservée, pas de faux succès. `CKP-MSW-051`.

---

## Scénario 5 — Vues sauvegardées réellement appliquées (audit F-016)

**Contexte métier.** Salma a une routine quotidienne : « voir les échecs des dernières
24h ». Elle veut une vue cliquable qui **applique** ce filtre, pas un simple highlight.

**Préconditions data.**
- Vues système seedées + 1 vue custom « Échecs 24h » (`filterState: status:failed,dlq after:-24h`).

**Déroulé & oracles (état CIBLE).**
1. Salma clique la vue « Échecs 24h » dans la sidebar.
   - *Oracle cible (F-016)* : un POST `search` part avec le `filterState` de la vue ; le tableau se recharge filtré ; la vue est surlignée (`aria-current`). `CKP-MSW-070`, `CKP-MSW-071`.
2. Elle crée une nouvelle vue « DLQ du jour » via **+ Nouvelle vue**.
   - *Oracle cible* : un vrai formulaire s'ouvre (pas `window.alert`) ; la sauvegarde fait POST `/views`. `CKP-MSW-072`, `CKP-MSW-073`.
3. Elle renomme une vue ; le PATCH échoue (500).
   - *Oracle* : message d'erreur ; le nom local **n'est pas** modifié à tort. `CKP-MSW-074`.
4. Les vues **système** n'ont pas de menu rename/delete. `CKP-MSW-076`.

---

## Scénario 6 — Export CSV honnête (audit F-017) + a11y/i18n

**Contexte métier.** Salma exporte les 30 suppressions du scénario 4 pour le support.

**Déroulé & oracles (état CIBLE).**
1. Sélection active → **Exporter CSV**.
   - *Oracle cible* : un téléchargement se déclenche (Blob/anchor), **pas** `window.alert`. `CKP-MSW-080`.
2. Un sujet contient une virgule et des guillemets.
   - *Oracle* : virgule entre guillemets, guillemets internes doublés, BOM UTF-8 pour Excel fr. `CKP-MSW-081`, `CKP-MSW-082`, `CKP-MSW-083`.
3. *Oracle a11y* : colonnes triables exposent `aria-sort` ; bulk bar `role=toolbar`. `CKP-A11Y-120`, `CKP-A11Y-122`.
4. *Oracle i18n* : libellés français partout. `CKP-I18N-123`.
