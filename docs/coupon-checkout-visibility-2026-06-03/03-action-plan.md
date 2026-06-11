# 03 — Plan de conception + plan de dev (action plan)

## Plan de conception (validé dans 00/01)
- Parti-pris : enrichir le récap (pas de nouveau bloc) d'une ligne « geste d'accueil + économie absolue », calme, adossée à la trust row.
- Tokens : encre / terracotta (accent économie unique) / sauge (puce) / `tabular-nums` / filet fin.
- Voix : « Votre geste d'accueil est appliqué » (desktop) / « Geste d'accueil appliqué » (mobile) · « Économie 90 MAD ».
- États : actif ↔ masqué ; cumul crédit fidélité géré ; holdout → masqué.

## Plan de dev — étapes ordonnées (chaque étape testée avant la suivante)

### D1 — `WizardCartRecap` : ligne welcome (présentation pure)
- Props `welcomeCoupon?: { active: boolean }`, `welcomeLabel?: string`, `economyLabel?: (amount) => string`.
- Calcule `economy = compareAtTotalCents − totalCents` ; rend la ligne ssi `welcomeCoupon?.active && economy > 0`.
- Tokens charte ; `data-testid="wizard-welcome-coupon"` ; « Économie » en terracotta + `tabular-nums`.
- **Tests** : `WizardCartRecap.welcome.test.tsx` (vitest/RTL) — actif → ligne + « 90 MAD » + accent ; inactif → absente (non-régression) ; pas de compareAt → absente ; charte (pas de « ! »/emoji).

### D2 — `WizardShell` : passage de la prop + i18n
- Prop `welcomeCoupon?`, transmise au récap avec `welcomeLabel`/`economyLabel` (libellés depuis `useWizardTranslation` ou littéraux fr/ar).
- **Tests** : couvert via D1 (props) + e2e D5.

### D3 — `KitCommanderSection` (client) : prop passthrough
- Prop optionnelle `welcomeCoupon?`, transmise à `WizardShell`.

### D4 — `KitCommanderSectionBound` (server) : résolution
- `resolveCoupon(buildCouponContext({referer,userAgent,sessionId}))` → `active = coupon?.type === 'welcome_auto'`. Passe `welcomeCoupon={{active}}`.
- Tolérant (try/catch déjà dans le moteur) → `active=false` si indispo.
- **Tests** : la résolution réutilise le moteur déjà testé ; vérif e2e/preview D5.

### D5 — E2E + preview
- `e2e/coupon-checkout.spec.ts` : `/kit` → ouvrir/scroller le wizard → la mention « geste d'accueil » + « Économie 90 MAD » est visible dans le récap quand le coupon est actif.
- Preview/admin : pauser welcome → la mention disparaît du wizard ET de `/kit` ; réactiver → réapparaît ; valeur −50 → « Économie 50 MAD ».

### D6 — Vérification finale
- `tsc --noEmit` 0 erreur ; suite checkout+coupons+sections verte (non-régression `WizardCartRecap` existant) ; lint 0 erreur ; `/kit` 200.

## Ordre & dépendances
D1 → D2 → D3 → D4 (chaîne de props bottom-up) → D5 → D6. D1 est autonome et testable seul.

## Risques & parades
| Risque | Parade |
|---|---|
| 2ᵉ zone saillante qui dilue le CTA | Ligne calme (texte, filet fin), pas de carte colorée ; un seul accent (terracotta sur « Économie ») |
| Rouge / sticker / countdown | Tokens charte stricts ; revue anti-pattern (06 playbook) |
| Régression récap | Prop défaut `welcomeCoupon` absent → rendu identique ; tests non-régression D1 |
| Incohérence /kit ↔ wizard | Même `resolveCoupon` + revalidateTag déjà câblé |
| Double comptage visuel (welcome + crédit) | Ordre vertical défini (01 §3.4) ; économie welcome distincte de la ligne crédit |

---

## Statut d'exécution (2026-06-03)

| Étape | Statut | Preuve |
|---|---|---|
| D1 récap ligne welcome | ✅ | WizardCartRecap.welcome.test.tsx (8) + 3 non-régression crédit |
| D2 WizardShell prop + i18n | ✅ | welcomeLabel/economyLabel fr/ar selon `dir` |
| D3 KitCommanderSection passthrough | ✅ | prop welcomeCoupon |
| D4 KitCommanderSectionBound résolution | ✅ | resolveCoupon → active (tolérant) |
| D5 E2E | ✅ écrit | e2e/coupon-checkout.spec.ts (@coupon-checkout) |
| D6 vérif | ✅ | tsc 0 · 466 tests verts (checkout+sections+coupons) · /kit 200 · **live browser** : « • Geste d'accueil appliqué · Économie 90 MAD », total 199, accent #C28A6E (terracotta), 0 rouge/% / countdown |

Charte tenue : une seule mention calme dans le récap (pas de 2ᵉ objet saillant), économie absolue (pas de %), terracotta = seul accent chaud (Kolenda §4.6), voix maison, `tabular-nums`, filet fin. Non-régression : prop absente/`active:false` → récap inchangé.

---

## Itération 2 (2026-06-03) — S3+S1 + clin d'œil crédit (retour mobile)

Suite au rendu mobile (casse « Économie 90 / MAD » + effet trop discret) :
- **Anti-casse** : la mention sort en ligne dédiée ; « −90 MAD » est `whitespace-nowrap`, copie courte mobile (`Geste d'accueil · −90 MAD`), longue desktop (`Votre geste d'accueil est appliqué · Économie 90 MAD`).
- **Effet succès (S1)** : coche fine SVG sauge (signal « appliqué »), `−90 MAD` en terracotta `#C28A6E` semi-bold (accent unique).
- **Clin d'œil crédit (V-a)** : ligne forward `Et un crédit de {valeur} vous attend après cette commande.` — valeur résolue depuis le template `post_purchase` actif (admin-driven), **pas** une 2ᵉ remise sur ce panier (conforme coupon-doc).
- Tests : WizardCartRecap.welcome.test.tsx (W1–W12) + non-régression. Live mobile (620px) : 1 ligne sans casse, coche présente, terracotta, forward 20 MAD.
