# F17 — E2E Parcours client fidélité (wizard → ThankYou → carte code)

## Rôle & surface

Parcours bout-en-bout **Playwright** du point de vue de la cliente **Yasmine** (visiteuse
anonyme). Elle passe une commande via le wizard `/kit` et reçoit, sur l'écran de
remerciement, un **code de fidélité mémorable** (`FG-…`) pour sa prochaine visite.

- **Surface** : `/kit` → wizard 3 étapes `lead → address → thank_you`.
- **Composants** : `LeadCaptureStep`, `AddressStep`, `ThankYouStep` + `LoyaltyCodeCard`.
- **Fichier cible** : `e2e/loyalty-issuance.spec.ts` (NOUVEAU).
- **Tag** : `@coupon-loyalty-issuance` (famille `@coupon-*`).
- **Auth** : AUCUNE (parcours visiteur anonyme — pas de `storageState`).

## ⚠️ Préconditions de données (bloquant — à lire avant exécution)

L'émission du code de fidélité dans `POST /api/checkout/order` est **conditionnée** par la
présence d'un **template `post_purchase` ACTIF** (cf. `route.ts` :
`listCoupons({ type: 'post_purchase', status: 'active' })`). Sans ce template, la réponse
order ne porte PAS de `loyalty` et la `LoyaltyCodeCard` ne s'affiche jamais → le test
échouerait pour une raison de seed, pas de régression.

**Stratégie de seeding (précondition F17)** :
1. `cd apps/web && pnpm tsx scripts/seed-coupons.ts` — crée/upsert le template
   `LOYALTY_INPUT` (type `post_purchase`, `status:'active'`, `valueAmount=2000` = 20 MAD,
   `target:'product_price'`). Idempotent : préserve un statut existant.
2. **Vérifier que le statut est bien `active`** : l'upsert idempotent (`upsertByType`) ne
   réaligne QUE `valueKind/valueAmount/target/holdoutPct` et **préserve** le `status`
   existant. Si un run précédent l'a mis en pause, il restera `paused` → **réactiver via
   l'admin** (`POST /api/admin/coupons/{id}/status {active}`) ou via un ops script.
3. Pour un environnement CI, ajouter `seed-coupons.ts` à la séquence de bootstrap AVANT le
   lancement Playwright (ordre : DB → migrations → seed-coupons → tests).

**Caveat émission idempotente (INV-IDEMP-PHONE / INV-IDEMP-ORDER)** : un téléphone ⇒ au plus
un grant `issued` ; un `sourceOrderId` ⇒ au plus un grant. Pour garantir l'émission d'un
**nouveau** code observable, le test doit utiliser un **téléphone unique par run** (ex.
suffixe horodaté sur les 9 chiffres : `06` + 7 chiffres dérivés du timestamp). Sinon un
parcours répété sur le même numéro réémet le code existant (toujours valide pour l'oracle
« un code FG- est affiché », mais pas un nouveau).

## Fonctionnement optimal (ce qui DOIT se passer)

1. **Lead.** `goto /kit`, dérouler jusqu'au wizard. Étape
   `[data-testid="wizard-step-lead"]` : remplir `input[name="firstName"]` (« Yasmine »),
   `input[name="phone"]` (9 chiffres uniques, ex. `0612xxxxxx`), cocher
   `input[name="consent"]`. Le bouton `[data-testid="wizard-lead-submit"]` devient actif
   (le formulaire est `mode:onChange`, disabled tant qu'invalide). Clic → PATCH lead →
   passage à l'étape adresse.
2. **Adresse.** `[data-testid="wizard-step-address"]`. Saisir la ville via
   `[data-testid="wizard-address-city"]` ; quand le listbox `wizard-address-city-listbox`
   s'ouvre, choisir une option `wizard-address-city-option-{slug}` (ex. Casablanca) pour
   alimenter l'ETA (→ délai d'activation civil). Remplir
   `[data-testid="wizard-address-line1"]`. Clic `[data-testid="wizard-address-submit"]`.
3. **Chaîne serveur.** Sur submit : PATCH address → PATCH payment(cod) →
   `POST /api/checkout/order`. L'order crée la commande, émet un `coupon_grant` (code
   `FG-…`, `activatesAt = orderDate + maxDeliveryDays(eta) + 1j`), et renvoie
   `{ ...order, loyalty: { code, valueCents, activatesAt } }`. La mutation appelle
   `setLoyalty(res.loyalty)` puis `goToStep('thank_you')`.
4. **Remerciement.** Conteneur `[data-testid="wizard-step-thankyou"]` (⚠️ testid = **thankyou**
   en DOM, alors que la clé d'étape interne est `thank_you`). La référence d'order est dans
   `[data-testid="wizard-thankyou-orderref"]`. La carte fidélité
   `[data-testid="loyalty-code-card"]` est rendue : `[data-testid="loyalty-code-value"]`
   contient un code `FG-…`, bouton `[data-testid="loyalty-code-copy"]` présent. La carte
   indique la valeur (20 MAD en terracotta `#C28A6E`) et une **date d'activation civile**
   (« Utilisable à partir du <jour mois> · valable 60 jours. ») — JAMAIS de compte à rebours.

## Contrat I/O

| Étape | Appel | Réponse |
|---|---|---|
| Lead | `PATCH /api/checkout/lead` (ou équivalent mutation) | lead id + `address` step |
| Adresse | `PATCH address`, `PATCH payment(cod)`, `POST /api/checkout/order` | order créé |
| Order | `POST /api/checkout/order` | `{ orderId, status:'pending_confirmation', totalCents, currency, loyalty:{ code:'FG-…', valueCents:2000, activatesAt:ISO } }` |

Code mémorable : motif `^FG-[A-Z]+-\d{4}$` (cf. `_loyalty-live-check.ts`).
Attendre la réponse : `page.waitForResponse((r) => r.url().includes('/api/checkout/order') && r.request().method() === 'POST')`.

## Cas limites & non-happy-path

- **Template absent / inactif** → pas de `loyalty` dans la réponse → carte absente. Documenter
  comme **précondition de seed** (cf. ci-dessus), pas comme un assert d'échec attendu du test.
- **Réémission même téléphone** (INV-IDEMP-PHONE) → même code renvoyé ; pour un nouveau code
  observable, téléphone unique par run.
- **PII** : asserter qu'AUCUN texte de la carte / de la page ThankYou ne contient le numéro de
  téléphone saisi en clair (le code `FG-…` est lié au numéro mais ne l'expose pas).
- **Activation civile** : la carte affiche une date au format `fr-MA` (`day numeric, month long`),
  PAS de minutes/secondes, PAS de countdown (charte). Oracle souple : présence de
  « Utilisable à partir du » + « valable 60 jours » (FR).
- **Ville libre non reconnue** → ETA absent → `computeActivatesAt(now, null)` =
  `DEFAULT_MAX_DELIVERY_DAYS (4) + 1` jours ; la carte reste cohérente. Le test choisit une
  ville reconnue pour un délai déterministe, mais l'oracle date reste tolérant.
- **Compile-on-demand** : `test.setTimeout(90_000)` (parcours multi-étapes à froid).
- **Combobox flaky** : attendre le listbox `wizard-address-city-listbox` avant de cliquer
  une option ; jamais `waitForTimeout`.

## Invariants couverts

- **INV-ACTIVATION** — `activatesAt = orderDate + maxDeliveryDays(eta) + 1j` reflété dans la
  date civile affichée.
- **INV-IDEMP-PHONE / INV-IDEMP-ORDER** — adressés par le choix d'un téléphone unique
  (documenté ; assertion principale = présence d'un `FG-…`).
- **INV-PII** — le numéro saisi n'apparaît jamais en clair sur l'écran de remerciement.
- Lacune audit adressée : **parcours fidélité complet wizard→ThankYou + carte** (🔴 audit §3).

## Critères d'acceptation (observables)

- `wizard-step-thankyou` visible après la commande.
- `wizard-thankyou-orderref` contient une référence non vide.
- `loyalty-code-card` visible ; `loyalty-code-value` matche `/^FG-[A-Z]+-\d{4}$/`.
- La carte contient « valable 60 jours » et une date civile ; pas de `⏰`, pas de countdown.
- Le numéro de téléphone saisi n'est PAS présent dans le `textContent` de la page ThankYou.

## Points à vérifier — tous points de vue

- **Backend** : émission best-effort non bloquante ; la commande réussit même si l'émission
  échoue (mais alors pas de carte). Le test exige le seed actif pour observer la carte.
- **Frontend** : `setLoyalty` hydrate le store ; la carte ne se monte que si `loyalty?.code`.
- **UI/UX/design** : valeur en terracotta `#C28A6E`, code en `tabular-nums`, ton « geste de la
  maison » (pas de sticker retail).
- **Data** : `activatesAt` ISO → date civile localisée fr-MA / ar-MA.
- **A11y** : carte = `aside` ; bouton copier `aria-label`.
- **i18n** : variante AR (`/ar/kit`) — `dir="rtl"`, « درهم », « صالح ابتداءً من … · لمدة 60 يومًا. ».
