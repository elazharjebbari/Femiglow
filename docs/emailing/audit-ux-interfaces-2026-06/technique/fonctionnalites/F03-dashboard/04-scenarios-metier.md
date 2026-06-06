# F03 — Scénarios métier (E2E Playwright)

> Un spec Playwright par scénario (IDs `SM-F03-nn`). Suite cible :
> `e2e/emails-dashboard.spec.ts` (parcours nominaux) + extension de
> `e2e/emails-degraded.spec.ts` (incidents infra). États initiaux posés par
> helpers DB (`e2e/_helpers/{emails-db,mailpit}.ts`), jamais par l'UI quand
> évitable. Oracles **binaires**, observables à l'écran.

---

## SM-F03-01 — « L'écran mural du matin »

**Persona** : Salma, opératrice support, arrive à 9 h. Elle laisse le dashboard
`/admin/emails` ouvert en plein écran sur un second moniteur, fenêtre `7 j`. Elle
ne le touche plus de la matinée — c'est son mur de supervision.

**Préconditions**
- DB seedée : envois récents sur 7 j, livraisons confirmées, webhook vivant.
- Au render initial : carte Livrés en **E1** (tracked), badge santé 🟢, aucun
  bandeau d'alerte.

**Déroulé**
1. La page s'ouvre, la carte Livrés montre `38` + « 90.5 % des envoyés », badge
   « Système OK », « ↻ auto · à jour il y a 0 s (Casablanca) ».
2. À 10 h 14, le webhook Stalwart tombe (simulé : on coupe l'arrivée des events
   `delivered` côté instance). De nouveaux envois partent (`sent` croît) mais plus
   aucun `delivered`.
3. **Sans aucune action de Salma**, au prochain tick auto-refresh (≤ 60 s), le
   segment RSC se recharge.

**Oracles**
- Après l'auto-refresh, la carte Livrés bascule en **E2** : affiche `0` +
  « webhook muet depuis HH:MM », ton rose.
- Le bandeau « Livraison silencieuse … » (`role="alert"`) **apparaît** au-dessus
  des cartes.
- Le badge santé passe 🔴 « Incident » (check Webhook ✗).
- À aucun moment l'écran n'a affiché un « 0 » neutre trompeur ni un faux « à jour
  il y a 0 s » : l'âge a couru en continu puis s'est réinitialisé au refresh.

**Mapping E2E** : `F03-E-001` (`emails-degraded.spec.ts`).

---

## SM-F03-02 — « Comparer hier et la semaine »

**Persona** : Karim, responsable CRM, veut savoir si le pic d'échecs d'hier est
anormal ou dans la tendance.

**Préconditions**
- DB seedée sur 60 j (2 fenêtres de 30 j) avec des volumes contrastés.
- Dashboard ouvert, fenêtre par défaut `7 j`.

**Déroulé**
1. Karim clique `24 h` dans le sélecteur de fenêtre.
2. L'URL devient `?window=24h`, les cartes affichent les chiffres 24 h, les
   tendances « vs 24 h préc. ».
3. Il clique `7 j` puis `30 j` ; à chaque fois URL et chiffres suivent.
4. Il clique la carte Échecs.

**Oracles**
- L'URL porte `?window=24h` puis `7d` puis `30d` (binaire : présent/absent).
- La tendance de la carte Échecs change de libellé selon la fenêtre
  (« +1 % vs 24 h préc. » → « +12 % vs 7 j préc. » → …) et son ton est rose pour
  une hausse d'échecs.
- Le clic carte Échecs ouvre le cockpit `?status=failed,bounced_soft,bounced_permanent&window=30d` (fenêtre propagée).

**Mapping E2E** : `F03-E-002` (`emails-dashboard.spec.ts`).

---

## SM-F03-03 — « Livraison silencieuse → diagnostic »

**Persona** : Salma voit le bandeau rose et doit diagnostiquer en ≤ 2 clics.

**Préconditions**
- DB seedée : `sent > 0`, `delivered = 0`, webhook déjà armé par le passé
  (`webhookLastSuccessAt` connu) → carte Livrés en **E2**.

**Déroulé**
1. La carte Livrés affiche `0` + « webhook muet depuis 16:49 » + lien
   « diagnostiquer → ».
2. Salma clique « diagnostiquer → ».

**Oracles**
- Le cockpit s'ouvre filtré `?status=sent,delivered` avec `?from=health&check=deliveredFreshness`.
- La **bannière contextuelle** du cockpit (CKP-F15) affiche « Vous arrivez depuis
  le check santé … (relevé HH:MM) ».
- La distinction E2 (webhook armé → alerte) vs E3 (jamais armé → « non suivi »
  neutre) est respectée : un environnement sans aucun event delivered historique
  n'aurait PAS produit ce bandeau (vérifié en variante).

**Mapping E2E** : `F03-E-003` (`emails-degraded.spec.ts`).

---

## SM-F03-04 — « DB down → message honnête + retry »

**Persona** : Salma ouvre le dashboard pendant une coupure DB.

**Préconditions**
- L'instance E2E voit la DB injoignable (simulée au niveau réseau).

**Déroulé**
1. Salma ouvre `/admin/emails`.
2. L'error boundary s'affiche.
3. La DB revient ; Salma clique « Réessayer ».

**Oracles**
- Le message d'erreur est **neutre** : « Le tableau de bord n'a pas pu être
  chargé. » — il NE contient PAS « base de données » ni aucune cause présumée
  (DASH-09).
- Le `digest` est affiché (corrélation logs) ; un bouton « Réessayer » et un lien
  retour `/admin` sont présents.
- Après reprise DB, « Réessayer » (`reset()`) recharge le dashboard complet
  (cartes peintes, badge santé) sans rechargement navigateur manuel.

**Mapping E2E** : `F03-E-004` (`emails-degraded.spec.ts`).

---

## Couverture croisée

| Scénario | Audit | Batterie E2E | Composants exercés |
|----------|-------|--------------|--------------------|
| SM-F03-01 | DASH-02, DASH-03, TRV-04 | F03-E-001 | KpiCards (tri-état), DashboardAutoRefresh, HealthBadge, bandeau |
| SM-F03-02 | DASH-01, DASH-06 | F03-E-002 | sélecteur fenêtre, tendances, drill-down |
| SM-F03-03 | DASH-12, TRV-04 | F03-E-003 | KpiCards E2, deep-link, bannière cockpit |
| SM-F03-04 | DASH-09 | F03-E-004 | error.tsx neutre |
| (astreinte santé) | DASH-12 | F03-E-005 | HealthBadge deep-links |
