# 20.03 — Conventions de qualité, a11y & non-régression

## 1. Nommage & structure des tests

- **Titre** : `FN-<id> [/ AF-<id>] — <geste opérateur> -> <résultat attendu>`.
  Ex. `FN-CTA-08/AF-02 — achat 199 MAD attribué -> revenu 199 MAD`.
- **Structure** : Arrange (fixtures/MSW) · Act (geste) · Assert (conséquence visible).
- **Un comportement par test** ; pas d'assertions fourre-tout.
- **Fichiers** : `*.spec.ts(x)` co-localisés (unit/composant), `e2e/analytics/*.spec.ts` (Playwright).

## 2. Sélecteurs (stabilité)

Ordre de préférence : **rôle ARIA / label** > `data-testid` > texte. **Jamais** de classe CSS.
`data-testid` déjà disponibles : `funnel-dashboard`, `cta-dashboard`, `checkout-dashboard`,
`*-skeleton`, `filter-bar` (+`data-pending`), `filter-period`, `filter-device`, `filter-traffic`,
`filter-reset`. **À ajouter au code applicatif** si manquants : `kpi-<name>`, `data-table-<view>`,
`empty-state`, `error-state`, `export-csv`, `insights-refresh`, `insights-drawer`.

> Ajouter un `data-testid` manquant fait partie du correctif de la fonctionnalité testée (petit
> changement applicatif, tracé dans le plan d'action).

## 3. Accessibilité (axe-core)

- Chaque onglet passe `axe` **sans violation critique/serious** (`@axe-core/playwright`).
- Vérifs ciblées : tables avec `<th scope>`, onglets `role=tab`+`aria-selected`, charts avec
  **équivalent textuel** (table ou `aria-label` descriptif), drawer **focus-trap** + `Échap`,
  contrôles de filtre **labellisés**, focus visible, info jamais portée par la **couleur seule**
  (drop-off, isDeleted, abandon → texte/icône en plus).
- RTL : sur `/ar`, l'ordre de lecture et le miroir des graphes restent cohérents (Insights export
  PNG inclus, F-INS-05).

## 4. Données & déterminisme

- `faker.seed(42)` global (déjà `vitest.faker.ts` dans le repo).
- Horloge : `now` injectée dans les queries ; Playwright avec horloge serveur figée ou fixtures
  ancrées. CI lance les tests fuseau avec `TZ=Africa/Casablanca` **et** `TZ=UTC` (matrice).
- Aucune dépendance à la date réelle, à l'ordre des tests, ou à un service externe.

## 5. Politique de non-régression (le filet)

1. **Tout finding** du `findings-register.csv` reçoit un test « rouge avant / vert après » référencé
   par son ID (`AF-01`…). Tant que le fix n'est pas fait, le test est marqué `test.fixme`/`it.todo`
   avec le lien vers le finding — **jamais supprimé**.
2. **Gate CI** : la suite analytics (unit + composant + e2e) est **bloquante** sur toute PR touchant
   `lib/analytics/**`, `components/admin/analytics/**`, `app/api/admin/analytics/**`,
   `app/admin/analytics/**`.
3. **Anti-flaky** : un test e2e doit passer **3×** consécutivement en CI nightly ; sinon quarantaine
   + ticket. Pas de `waitForTimeout` arbitraire — utiliser `expect.poll`/`toPass`.
4. **Couverture** : seuils dans `config/coverage-targets.yaml` ; baisse = échec CI.

## 6. Revue (Definition of Done d'un test)

- [ ] Relié à un `FN-*` (et `AF-*`/`F-*` si non-régression).
- [ ] Déterministe, isolé, sans réseau réel.
- [ ] Assertion orientée comportement observable.
- [ ] a11y vérifiée si c'est un cas UI clé.
- [ ] Passe en local **et** en CI (UTC + Casablanca pour les cas temporels).
- [ ] Lisible par un non-auteur en < 30 s.
