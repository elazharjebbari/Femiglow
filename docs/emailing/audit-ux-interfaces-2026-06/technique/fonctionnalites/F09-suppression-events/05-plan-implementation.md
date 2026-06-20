# F09 — Plan d'implémentation (Suppression & Events)

> Ordre : **P1.5** (pilote socle sur le retrait existant) PUIS **P5.1**
> (ajout / filtres / bulk / export / events). On ne livre P5.1 qu'une fois le
> socle validé sur un écran réel.

---

## Étape P1.5 — Pilote du socle sur le retrait unitaire

**But** : `SuppressionList` est l'**écran pilote** du socle F01. On migre le
retrait unitaire EXISTANT (déjà testé par le code modèle) avant d'ajouter quoi
que ce soit. C'est le banc d'essai qui prouve que ConfirmDialog / Toast /
EmptyState tiennent sur un écran réel.

**Travaux** :
1. Remplacer `window.confirm` (lignes ~132 de `SuppressionList.tsx`) par
   **ConfirmDialog** (variante danger, verbe « Retirer », corps = conséquences
   « pourra de nouveau recevoir des emails transactionnels ET campagnes »).
2. Remplacer le bandeau succès maison (`role=status` inline) par le **toast**
   du `ToastProvider` (auto-dismiss 4 s, message RÉSULTAT).
3. Remplacer les blocs vides maison (`suppression-empty`) par **EmptyState**
   (variantes `empty` / `filtered`).
4. Conserver strictement : ligne préservée sur erreur, zéro faux succès,
   anti-double-clic, refetch après succès.
5. Activer le verrou ESLint `no_window_confirm` sur le fichier.

**Tests** : grille réseau retrait déjà fournie par le modèle
(`F09-C-001/010..015/020` — NE PAS dupliquer) ; ajouter `F09-C-082/083/084`
(migration socle observable) + `F09-C-085/086` (EmptyState).

**Sortie de phase** : invariants `INV-1/INV-2/INV-3/INV-5/INV-7` verts sur
SuppressionList (ligne ajoutée au `describe.each` du socle).

---

## Étape P5.1 — Pilotage complet de la suppression + events

### Backend (à faire d'abord — les contrats verrouillent les mocks)
1. `POST /api/admin/emails/suppression` : Zod `superRefine` (détail requis ssi
   `manual_admin`), ordre 422 → 409 allowlist → 409 doublon → 201 ; source par
   défaut selon raison ; audit `mail.suppression.add`.
2. `lib/mail/suppression.ts` : `addSuppression` **refuse** une adresse interne
   (`isInternalAddress` → no-op / signal), pour fermer R-009 à la source (pas
   seulement à la route).
3. `POST /api/admin/emails/suppression/bulk-remove` : cap 500, dédoublonnage,
   `DELETE … IN … RETURNING`, réponse `{removed, notFound}`, audit
   `mail.suppression.bulk_remove` **systématique**.
4. `GET /api/admin/emails/suppression/export` : rejoue le WHERE de la liste
   sans pagination, stream CSV BOM + RFC4180, `Content-Disposition` daté.
5. `lib/user-events/queries.ts` : `getRecentEvents` accepte `eventName`,
   `email`, `windowMs` (number | null) ; `window=24h` borne le stream.
6. Tests intégration (`F09-I-030..042`) + conformité contrat (`F09-I-042`).

### Frontend Suppression
7. Filtres **raison** / **source** (selects) + correction du libellé
   « Filtrer par email » ; URL persistée `?email=&reason=&source=&offset=` ;
   bouton Réinitialiser ; `offset=0` à tout changement de filtre.
8. Dialog **ajout manuel** (ConfirmDialog) : champs + validation conditionnelle
   du détail + messages d'erreur distincts (422 / 409 allowlist / 409 doublon).
9. **Bulk** : checkboxes + tout-la-page + bulk bar + ConfirmDialog unique avec
   nombre + résultat partiel honnête + sélection préservée sur échec.
10. **Export CSV** : bouton propageant les filtres courants.
11. Grilles réseau `F09-C-043..048` (ajout), `F09-C-067..072` (bulk),
    `F09-C-076..081` (export).

### Frontend Events
12. Filtres **event** / **email** + toggle **fenêtre 24 h / Tout** (cohérence
    compteurs) ; URL persistée.
13. **Expand** `<details>` JSON formaté complet ; **corrélation** outbox/campagne
    par clé exacte ; **overflow-x-auto** sur le stream ; titre désambiguïsé.
14. Tests `F09-C-088..101` + unitaires `F09-U-039/040`.

### Navigation (dépendance F02)
15. L'onglet « Suppression » (SUP-01 / NAV-F04) est livré par F02 ; F09 suppose
    l'accès non-orphelin mais ne le porte pas. Coordonner pour ne pas régresser
    le deep-link `?email=` existant.

---

## Risques & parades

| Risque | Gravité | Parade |
|---|---|---|
| **Faux retrait massif** (bulk sur mauvais filtre) = clientes débloquées à tort, ou pire un retrait qui aurait dû rester | élevée (sécurité délivrabilité / conformité) | ConfirmDialog avec **nombre** ; export-preuve avant action (SM-F09-01) ; **audit-log systématique** testé (`F09-I-036`) ; résultat honnête `{removed,notFound}` |
| **Faux ajout interne** (R-009) coupe les notifications équipe | élevée (canal lead invisible) | refus **à deux niveaux** : route (409) ET `addSuppression` (lib) ; tests `F09-I-032/040` + `F09-C-040` ; `isSuppressed` bypass inchangé |
| **Détail manquant** sur `manual_admin` = suppression non traçable | moyenne | validation Zod conditionnelle serveur (`F09-I-031`) + bouton désactivé client (`F09-C-033`) |
| **Export grosses listes** (12 500+ lignes) = mémoire/latence | moyenne | stream CSV (pas de buffer total) ; export rejoue le WHERE filtré (pas la table entière par défaut) ; pas de `limit` mais filtre encouragé |
| **Incohérence fenêtre events** persiste si toggle mal câblé | faible | oracle binaire `F09-C-091` : aucune ligne `ts < now-24h` quand `window=24h` |
| **Lien outbox/campagne deviné** sur clé absente | faible | corrélation par clé exacte + valeur non vide (`F09-U-039`, `F09-C-098/099`) |
| **Faux succès** réseau (toast vert sur échec) | élevée | invariant zéro faux succès, grilles réseau 6 cas par action |

---

## Rollback

- **Backend** : les 3 nouvelles routes (POST, bulk-remove, export) sont
  **additives** — pas de migration destructive, pas de changement de schéma DB
  (`email_suppression` inchangée). Rollback = retirer les routes ; GET/DELETE
  existants intacts.
- **Frontend** : la refonte de `SuppressionList` / `EventsDashboardView` est
  remplaçable par les composants actuels (feature-flag possible si besoin de
  livraison progressive, sinon revert de commit).
- **Socle (P1.5)** : si un invariant régresse, revert isolé du retrait migré
  (retour `window.confirm`) sans toucher P5.1.
- Déploiement prod = build + `systemctl restart femiglow.service`
  (single-instance, migrations additives uniquement — cf. mémoire infra).
- **Garde-fou irréversible** : aucune commande ne **vide** la liste ; toute
  suppression de lignes passe par bulk-remove audit-loggé → un rollback
  applicatif n'efface jamais de données de suppression.

---

## Quality gates spécifiques F09

- G1 : batterie F09 (`03-batterie-tests.csv`) 100 % verte.
- G7 : grille réseau 6/6 présente pour **add**, **bulk-remove**, **export**,
  **retrait unitaire** (4 blocs `— grille réseau`).
- G9 : conformité contrat pour POST + bulk-remove (`F09-I-042`).
- G6 : axe 0 serious/critical (jsdom `F09-A-030..032` + E2E `F09-E-003`).
- G8 : `SM-F09-01`, `SM-F09-02` verts en fin de phase (Mailpit prouve le
  re-blocage / déblocage réel).

---

## Enrichissement barème relevé (2026-06-20) — gates G10–G15

> Référence : ../../09-charte-ux-qualite.md. Ces exigences s'ajoutent au plan
> ci-dessus et conditionnent le gate de phase (cf. 07-plan-action-global.yaml,
> 08-runbook.md §5). Nouvelles couches de batterie à créer : **F09-D-*** (design)
> et **F09-S-*** (sécurité).

### Design haut calibre (G10)

- Livrer un **wireframe ASCII cible** pour les 3 surfaces NEUVES avant dev
  (chaîne d'artefacts 03-plan-conception, critère de sortie de revue de spec) :
  dialog d'ajout manuel (SUP-F03), bulk bar (SUP-F05), expand `<details>` JSON
  des events (EVT-F03). Layout, densité, hiérarchie aujourd'hui non dessinés.
- **Bulk bar (SUP-F05)** : trancher et dessiner sticky-bas vs bandeau-haut, le
  comportement au scroll d'une liste de 200 lignes (SM-F09-01, pagination 50),
  et une transition d'apparition explicite (le design-system note « apparitions
  sèches des drawers » comme défaut — F09 ne doit pas le reproduire).
- **Expand JSON (EVT-F03)** : passer de `JSON.stringify` brut dans un `<pre>` à
  un rendu d'outil de debug — coloration syntaxique, `max-height` + scroll,
  bouton **Copier**, ellipsis/borne sur très grosses payloads.
- **Rappel pédagogique** « bloquée pour transactionnel ET campagnes » (corps du
  ConfirmDialog de retrait + dialog d'ajout) : le designer comme **callout
  sémantique info** (icône + hiérarchie vs champs), pas un paragraphe gris.
- **Micro-moments destructifs** : animer le compteur « N sélectionnées » et
  distinguer visuellement le résultat « 21 retirées · 2 introuvables » — le
  `notFound` au ton neutre/warning (pas un échec), le `removed` confirmé.
- **États de chargement dessinés** : skeleton de la table suppression pendant le
  refetch post-bulk ; feedback de progression de l'export potentiellement long
  (12 500 lignes) au-delà du seul bouton passant en « Export… ».
- **Responsive ≤375 px** : oracles sur le dialog d'ajout et la bulk bar (sticky,
  non débordante), pas seulement `overflow-x-auto` sur le stream events
  (F09-C-100). Ajouter **prefers-reduced-motion** (toast auto-dismiss, dialog,
  bulk bar sans transition quand la préférence est active) — manque §6 du DS.
- **Snapshots visuels F09-D-*** à créer : `F09-D-001` dialog ajout (desktop +
  375 px), `F09-D-002` bulk bar avec compteur, `F09-D-003` expand JSON,
  `F09-D-004` résultat partiel removed/notFound.

### Assistance à la saisie (G11)

- **Email du dialog d'ajout (SUP-F03)** → typeahead/combobox alimenté par
  `GET /api/admin/emails/recipients/suggest?q=` (DISTINCT leads + `user_event.email`
  + outbox recipients, cap 10). Test : taper « cli » propose `cliente@example.com` ;
  acceptation : faute de frappe impossible quand l'adresse existe déjà.
- **Email du dialog** → inline-validation au-delà du format : avertissement doux
  « adresse inconnue du système (jamais reçu d'email / aucun event) » + détection
  de domaine probablement mal tapé (gmial.com). Test : email absent → warning.
- **Nom d'event (EVT-F02)** → combobox/datalist alimentée par
  `SELECT DISTINCT event_name FROM user_event` (avec comptes), saisie libre en
  fallback. Test : la liste contient cart_add, cart_remove… ; ensemble fini.
- **Filtre Email liste (q, SUP-F02)** et **Filtre Email events (EVT-F02)** →
  même endpoint de suggestion (typeahead des emails réellement présents). Test :
  SM-F09-02 (`cliente@example.com`) complété sans saisie intégrale.
- **Détail du dialog (manual_admin / cndp_request)** → smart-default / snippets
  des motifs stéréotypés (« Demande WhatsApp du JJ/MM, ticket # »,
  « Demande CNDP réf CNDP-AAAA-NNN », cf. SM-F09-02/03), placeholder structuré.
  Test : choix cndp_request pré-remplit le gabarit de référence.
- **Raison (select 7 valeurs, SUP-F03)** → smart-default **contextuel** : si
  l'email arrive d'un deep-link depuis un event bounce, pré-sélectionner
  `hard_bounce` au lieu du `manual_admin` figé. Test : deep-link bounce → raison
  pré-remplie.
- Renseigner chaque champ ci-dessus dans **10-inventaire-assistance.csv** (champ
  → mécanisme → test) ; gate : aucun champ « saisie nue » non justifié.

### Sécurité (G12) — batterie F09-S-*

- **CSV formula-injection** (F09-S-001) : préfixer `'` les cellules `detail` /
  email commençant par `=`, `+`, `-`, `@`, TAB, CR avant le formatage RFC4180 —
  export destiné au registre CNDP/Excel (SM-F09-03), RFC4180 ≠ neutralisation
  formule. Test unitaire dédié, **bloquant**.
- **Posture CSRF** (F09-S-002) affirmée et testée sur les routes POST neuves
  (`/suppression`, `/suppression/bulk-remove`) — ce sont des routes API, pas des
  server actions ; la posture doit être explicite.
- **Rate-limit / anti-abus bulk-remove** (F09-S-003) : le cap 500 borne la
  taille mais pas la fréquence — un script viderait la liste par lots de 500.
  Garde de fréquence + test.
- **Redaction PII** (F09-S-004) : emails hashés/masqués dans les logs
  applicatifs (système de conformité) ; `mail.suppression.add` audit-loggue
  `{ email, reason, source, hasDetail }` mais les logs `logger.*` ne doivent pas
  porter de PII en clair.
- **XSS stocké** (F09-S-005) : affirmer l'échappement du `detail` libre
  (2000 car) à l'affichage liste ET dans l'expand — critère explicite, pas
  « React le fait par défaut » implicite.
- **Concurrence ajout** (cf. G15) : check-then-act → `INSERT … ON CONFLICT (email)
  DO NOTHING RETURNING`, 409 dérivé du rowcount=0 — ferme la race condition.
- F09-S-* à écrire : F09-S-001 (formula-injection), F09-S-002 (CSRF POST),
  F09-S-003 (rate-limit bulk), F09-S-004 (redaction PII logs), F09-S-005 (XSS
  detail).

### Observabilité / débogabilité (G14)

- Chaque mutation émet un **log structuré sans champ event** :
  `logger.info('mail.suppression.add', …)`, `mail.suppression.bulk_remove`,
  `mail.suppression.export`, `mail.suppression.remove` (retrait unitaire) — avec
  `{ actorId, count, requestId, emailHash }`. Test asserttant **la forme des
  champs**, pas seulement la présence de l'audit DB.
- **Correlation-id** : propager un `requestId` reliant la requête bulk à
  l'audit-log `mail.suppression.bulk_remove` (meta `{ requested, removed,
  notFound }` aujourd'hui sans id de requête ni acteur) — permet de tracer « qui
  a retiré ces 200 lignes et via quelle requête ».
- **Export** : log de volume + durée (`{ rows, ms }`) pour diagnostiquer une
  lenteur sur grosse liste (risque mémoire identifié, aujourd'hui non observable).
- **Chemins d'erreur tracés** : 422 / 409 allowlist / 409 doublon / 500 des
  routes neuves émettent un log corrélé ; tests d'émission (pas seulement le
  succès).

### Performance / optimal (G13)

- **Débounce 300 ms** sur les filtres texte `q` (SUP-F02), `event` et `email`
  (EVT-F02) — aujourd'hui chaque frappe peut déclencher un GET. Test : 1 seul
  GET après pause de frappe.
- **Index pg_trgm additifs** (migrations additives autorisées) sur
  `user_event.event_name`, `user_event.email` et `email_suppression.email` — les
  filtres ILIKE `%x%` font sinon un scan séquentiel. Assertion EXPLAIN.
- **Budget export** : streaming vérifié par un **test de volume ≥10 000 lignes**
  (le « stream CSV, pas de buffer total » reste un vœu sans test), cap mémoire
  chiffré, cible de latence.
- **Borne du rendu** : limite de taille rendue de l'expand JSON (très grosse
  payload = DOM lourd) et borne/virtualisation du stream events en mode « Tout »
  (100 lignes OK, « tout » non borné côté rendu).

### Modularité / évolutivité / concurrence (G15)

- **Module CSV unique** `lib/csv.ts` (BOM + RFC4180 + neutralisation formule)
  partagé avec l'export F04 — aujourd'hui inline dans la route export, risque de
  double implémentation RFC4180 divergente. Test unitaire partagé.
- **Source unique des enums/labels** `lib/mail/suppression-enums.ts` (7 raisons,
  4 sources, `reason_labels` / `source_labels`, map reason→source par défaut) +
  **constantes FR** importées par route + composant + tests + MSW (zéro littéral
  dupliqué entre route, MSW et assertions). Helper d'échappement LIKE unique et
  testé (partagé GET liste / GET export).
- **Contrat versionné / paramétrable** : `windowMs` paramétrable plutôt qu'enum
  binaire 24h/Tout en dur — aligner sur F03 dashboard (`24h|7d|30d`) pour lever
  l'incohérence d'API entre deux écrans du même programme. Cap bulk=500 en
  constante partagée.
- **Découpage anti god-component** : `SuppressionList` absorbe ajout + filtres +
  bulk + export + retrait + URL-state → extraire `useSuppressionFilters` et
  `useBulkSelection`. Test de non-régression du deep-link `?email=` (F02).
- **Concurrence ajout (TOCTOU)** : `INSERT … ON CONFLICT (email) DO NOTHING
  RETURNING` + test de concurrence (2 POST simultanés → 1 inséré, 1 doublon,
  aucune 500).
- **Atomicité bulk DELETE** : transaction + comportement sur timeout partiel
  (le `{ removed, notFound }` suppose un RETURNING complet — spécifier le cas
  « timeout après 300 suppressions »). Test dédié.
- **Cohérence sélection ↔ données** : si la liste est refetchée (autre onglet /
  filtre) pendant une sélection bulk active, sélection conservée par email,
  lignes disparues retirées. Test dédié.
- **Complétude du scénario phare** : livrer (ou planifier-dater en P5.2) le
  pattern « sélectionner les N résultats du filtre » via `bulk-remove-by-filter`
  (modèle F04 bulk-retry-by-filter, dry-count d'abord) — sinon SM-F09-01
  (retirer un spike de 200 lignes) reste manuel multi-pages. Exiger une **saisie
  de confirmation** (re-taper le nombre ou « RETIRER ») dès N>50 (standard
  transverse §3.1) ou consigner la dérogation dans 02-spec-technique.yaml.
