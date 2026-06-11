# CPN-12 — Stats & incrémentalité (opérateur)

> Périmètre : agrégation des `coupon_events` en indicateurs de performance et
> d'**incrémentalité** (uplift treatment vs holdout), et leur **affichage dans le
> panneau stats de la page d'édition** `/admin/coupons/[id]`.
> Route à créer : `GET /api/admin/coupons/[id]/stats`.
> Le bucketing déterministe est en CPN-19 ; le logging des events en CPN-09.
> Criticité **P1** (décision business ; ne doit pas tromper l'opérateur avec des
> chiffres non significatifs ou une fausse incrémentalité).

---

## (a) Fonctionnement optimal — parcours opérateur détaillé

### Modèle de données (rappel)
`coupon_events` : une ligne par évènement avec `phase` ∈ {exposed, applied,
converted} et `bucket` ∈ {treatment, holdout}.

Agrégats par bucket :
- `exposed` : nb de visiteurs exposés au coupon (vus).
- `applied` : nb d'applications effectives (treatment uniquement par construction).
- `converted` : nb de conversions (commande payée).

Indicateurs :
- **Taux de conversion** `convRate(bucket) = converted(bucket) / exposed(bucket)`.
- **Uplift (absolu)** `uplift = convRate(treatment) − convRate(holdout)`.
- **Uplift (relatif)** `upliftRel = uplift / convRate(holdout)` (si holdout > 0).
- **Incrémentalité** : interprétation de l'uplift = vrai gain attribuable au
  coupon (commandes que le holdout n'aurait pas générées au plein tarif).

### Parcours opérateur
1. L'opérateur ouvre `/admin/coupons/[id]`. Le panneau **« Performance »**
   appelle `GET /api/admin/coupons/[id]/stats` (option `?from&to` pour la
   fenêtre).
2. Affichage : un tableau **treatment / holdout** (exposed, converted, taux de
   conv), un encart **Uplift** (absolu + relatif), et un libellé de
   **signification** (« Échantillon suffisant » / « Échantillon insuffisant —
   non significatif »).
3. **État 0 donnée** : « Pas encore de données » (le coupon n'a jamais été exposé).
4. **Petit échantillon** : avertissement non bloquant « Échantillon insuffisant
   (n < seuil) : uplift non significatif » ; l'uplift est affiché en sourdine
   (grisé / mention).
5. **holdout = 0** : pas de groupe contrôle → encart uplift remplacé par « Pas de
   groupe contrôle (holdout 0 %) : l'incrémentalité ne peut pas être mesurée. »
6. **Cohérence** : `applied ≤ exposed(treatment)`, `converted(bucket) ≤
   exposed(bucket)`, totaux = treatment + holdout. Aucune PII affichée
   (`visitorKey` jamais montré ; seulement des compteurs).

---

## (b) Contrats I/O

### `GET /api/admin/coupons/[id]/stats`
- Query optionnelle : `from`, `to` (ISO ; fenêtre temporelle).
- `200` :
  ```json
  {
    "couponId": "cpn_welcome",
    "window": { "from": "2026-06-01T00:00:00.000Z", "to": "2026-06-08T00:00:00.000Z" },
    "buckets": {
      "treatment": { "exposed": 1000, "applied": 940, "converted": 130 },
      "holdout":   { "exposed": 200,  "applied": 0,   "converted": 18  }
    },
    "rates": { "treatmentConv": 0.13, "holdoutConv": 0.09 },
    "uplift": { "absolute": 0.04, "relative": 0.4444 },
    "significance": { "level": "sufficient", "minSamplePerBucket": 100 }
  }
  ```
- `significance.level` ∈ {`no_data`, `insufficient`, `sufficient`} ; quand
  `holdout.exposed === 0` → `uplift` est `null` + un drapeau `noControl: true`.
- `404 not_found` si coupon inconnu. `401`/`403` selon auth/RBAC (action `read`).

### Calcul (fonction pure testable — `lib/coupons/stats.ts`)
```ts
function computeUplift(agg): {
  rates: { treatmentConv: number; holdoutConv: number | null };
  uplift: { absolute: number | null; relative: number | null };
  significance: 'no_data' | 'insufficient' | 'sufficient';
  noControl: boolean;
}
```
- `convRate = exposed === 0 ? 0 : converted / exposed`.
- `holdout.exposed === 0` → `noControl = true`, `uplift = null`.
- `significance = no_data` si `treatment.exposed + holdout.exposed === 0` ;
  `insufficient` si min(exposed par bucket pertinent) < `minSamplePerBucket` ;
  sinon `sufficient`.
- Division par zéro toujours gardée ; aucun `NaN`/`Infinity` propagé à l'UI.

---

## (c) Points de vérification par axe

**Backend**
- Agrégation SQL `GROUP BY phase, bucket` (pas de N+1 par event).
- Fenêtre `from/to` appliquée à la requête.
- Calcul d'uplift = **fonction pure** (déterministe, testée isolément en U).

**Frontend**
- Tableau treatment/holdout + encart uplift + libellé significativité.
- États distincts : chargement (skeleton), 0 donnée, insuffisant, suffisant,
  pas de contrôle, erreur.
- Taux formatés en % avec une précision fixe (ex. 1 décimale) ; pas de `NaN`.

**UI/UX opérateur**
- L'avertissement « non significatif » est visible mais non alarmiste.
- L'incrémentalité expliquée en une phrase compréhensible (pas de jargon brut).

**Design / charte admin**
- Sobre ; uplift positif en sauge, négatif en encre (pas de rouge retail criard).
- Pas d'emoji, pas de countdown.

**Data**
- Cohérence : `converted ≤ exposed` par bucket ; `applied ≤ exposed(treatment)` ;
  totaux cohérents.
- Aucune PII : seuls des compteurs agrégés, jamais de `visitorKey`/email.

**Sécurité / RBAC**
- `read` suffit pour consulter les stats ; pas de mutation ici.
- Pas de fuite d'identité visiteur dans la réponse.

**Performance**
- Une requête agrégée. Réponse < 300 ms sur volumes réalistes (index sur
  `coupon_id, phase, bucket, created_at`).

**Accessibilité**
- Tableau avec en-têtes (`<th scope>`), valeurs lisibles au lecteur d'écran.
- L'avertissement significativité a un `role="status"` (non bloquant).

**i18n**
- Libellés FR Phase 1 ; pourcentages formatés selon locale.

**Observabilité / audit**
- Consultation stats = lecture (pas d'audit de mutation requis). Optionnel :
  trace d'accès si politique d'audit lecture.

---

## (d) Edge cases & matrice d'états

| Catégorie | Cas | Attendu |
|---|---|---|
| Nominal | treatment+holdout suffisants | tableau + uplift + « suffisant » |
| Vide | aucun event | « Pas encore de données » ; uplift absent |
| Limite | exposed treatment > 0, converted = 0 | convRate = 0 (pas de NaN) |
| Limite | holdout.exposed = 0 | « Pas de groupe contrôle », uplift `null` |
| Limite | échantillon juste sous le seuil | « insuffisant » + uplift grisé |
| Limite | échantillon juste au seuil | « suffisant » |
| Invalide | `converted > exposed` (donnée corrompue) | clamp/garde, signalé en cohérence (test data) |
| Calcul | division par zéro (exposed=0) | convRate=0, jamais Infinity/NaN |
| Calcul | uplift négatif (holdout convertit mieux) | uplift négatif affiché en encre, pas masqué |
| Fenêtre | `from/to` réduit l'échantillon | agrégats recalculés sur la fenêtre |
| Erreur réseau | `404` coupon inconnu | message « Coupon introuvable » |
| Erreur réseau | `500` | « Impossible de charger les statistiques », bouton réessayer |
| Latence | réponse lente | skeleton panneau |
| Sécurité | réponse ne contient aucun visitorKey | assertion d'absence de PII |

---

## (e) Risques

| ID | Risque | Impact | Mitigation testée |
|---|---|---|---|
| R-12-1 | Division par zéro → NaN/Infinity affiché | UI cassée / chiffre absurde | Garde exposed=0 → 0 ; test U |
| R-12-2 | Uplift affiché alors que holdout=0 | Fausse incrémentalité | `noControl` → message dédié, uplift `null` |
| R-12-3 | Petit échantillon présenté comme fiable | Décision business erronée | Seuil `minSamplePerBucket` + libellé « insuffisant » |
| R-12-4 | Compteurs incohérents (converted>exposed) | Stats fausses | Cohérence vérifiée ; clamp/garde |
| R-12-5 | Fuite de PII (visitorKey) dans la réponse | Confidentialité | Réponse = compteurs agrégés ; test anti-PII |
| R-12-6 | Uplift négatif masqué | Biais d'optimisme | Affichage neutre du négatif |
| R-12-7 | Fenêtre from/to ignorée | Mauvaise période analysée | Agrégat filtré par fenêtre testé |
| R-12-8 | N+1 sur events | Lenteur panneau | Requête agrégée unique |

---

## (f) Critères d'acceptation

- **AC-12-1** : `computeUplift` — treatment 130/1000 (13 %), holdout 18/200 (9 %)
  → `uplift.absolute === 0.04`, `uplift.relative ≈ 0.4444`, `significance ===
  'sufficient'`.
- **AC-12-2** : aucun event → `significance === 'no_data'`, panneau « Pas encore
  de données », pas d'encart uplift.
- **AC-12-3** : `holdout.exposed === 0` → `noControl === true`, `uplift === null`,
  message « Pas de groupe contrôle (holdout 0 %) : l'incrémentalité ne peut pas
  être mesurée. »
- **AC-12-4** : `exposed > 0` & `converted === 0` → convRate 0, aucun `NaN`.
- **AC-12-5** : min(exposed) < seuil → `significance === 'insufficient'` + libellé
  « Échantillon insuffisant ».
- **AC-12-6** : uplift négatif (holdout convertit mieux) → affiché, non masqué.
- **AC-12-7** : la réponse `GET stats` ne contient aucune clé `visitorKey`/email
  (assertion d'absence de PII).
- **AC-12-8** : `converted ≤ exposed` et `applied ≤ exposed(treatment)` sur toute
  fixture valide.
- **AC-12-9** : `500` → panneau « Impossible de charger les statistiques » +
  bouton « Réessayer ».
- **AC-12-10** : fenêtre `from/to` → l'agrégat ne compte que les events dans la
  fenêtre.
