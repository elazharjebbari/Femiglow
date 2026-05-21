# 10 — Acceptance criteria & non-régression

Checklist exhaustive. Référence : `08-plan-action-phases.md` (5 phases
W0→W4 + W5 optionnel).

## 1. Critères globaux (toute phase)

- [ ] `pnpm --filter web exec tsc --noEmit` clean (0 erreur fichiers wizard)
- [ ] `pnpm -r lint` clean (warnings tolérables si pré-existants)
- [ ] `pnpm --filter web exec vitest run` 100 % vert
- [ ] `pnpm --filter web exec playwright test --grep '@wizard-'` 100 % vert × 3 runs
- [ ] Couverture `lib/checkout/helpers/**` ≥ 90 % branches
- [ ] Couverture `components/checkout/wizard/**` ≥ 80 % branches
- [ ] Pas de `eslint-disable` non commenté
- [ ] Pas de `console.log` oublié
- [ ] Commits : `feat(wizard)` / `test(wizard)` / `docs(wizard)`
- [ ] Aucune mention nominale fondatrice
- [ ] Pas de cliché orientaliste

---

## 2. Phase W0 — Tracking + helpers + store

### 2.1 Acceptation helpers
- [ ] `formatPhoneFR('')` → `''`
- [ ] `formatPhoneFR('0612345678')` → `'06 12 34 56 78'`
- [ ] `formatPhoneFR('06123456789')` → `'06 12 34 56 78'` (trim 10)
- [ ] Idempotence : `formatPhoneFR(formatPhoneFR(x))` === `formatPhoneFR(x)`
- [ ] `parsePhoneFR('06 12 34 56 78')` → `'0612345678'`
- [ ] `detectCorrection('Yasmine', 'Yas')` → `true` (drop > 50 %)
- [ ] `detectCorrection('Yasmine', 'Yasmi')` → `false` (drop < 50 %)
- [ ] `detectCorrection('', 'Y')` → `false`

### 2.2 Acceptation copy
- [ ] `DEFAULT_WIZARD_COPY` exporte les 11 champs documentés
- [ ] `resolveWizardCopy(undefined)` retourne defaults
- [ ] `resolveWizardCopy({ ctaLead: 'Custom' })` merge sur defaults

### 2.3 Acceptation schemas tracking
- [ ] `wizard_field_filled` accepte payload {field_name, step_name, form_id, time_since_focus_ms}
- [ ] Rejette field_name inconnu (enum strict)
- [ ] `wizard_field_corrected` valide attempts > 0
- [ ] `wizard_step_abandoned` valide fields_completed ≥ 0
- [ ] `wizard_resume_shown` + `_dismissed` valides

### 2.4 Acceptation store
- [ ] `registerFieldFocus('firstName')` → fieldFocusedAt['firstName'] = Date.now()
- [ ] `markFieldFilled('firstName', 'lead')` → ajoute à filledFieldsThisSession
- [ ] Re-call markFieldFilled même champ → no-op
- [ ] `incrementFieldCorrection('phone')` → compteur incrémenté
- [ ] `markResumeBannerShown()` → flip flag à true
- [ ] `dismissResumeBanner()` → flip resumeBannerDismissed à true
- [ ] Persistence : resumeBannerDismissed survit dans localStorage
- [ ] Persistence : filledFieldsThisSession NE survit PAS (reset session)

### 2.5 Non-régression W0
- [ ] Tests `wizard-store.test.ts` existants tous verts
- [ ] Tests `lead_capture`, `address_completed`, `purchase` events existants tous verts
- [ ] Schema `eventSchemas` rétro-compat (events précédents préservés)
- [ ] Composants wizard existants ne lisent pas encore les nouveaux fields → 0 régression

---

## 3. Phase W1 — Quick wins copy

### 3.1 Acceptation
- [ ] CTA Step 1 = « Continuer · paiement à la livraison »
- [ ] Consent label = « Je veux être rappelée pour confirmer ma commande »
- [ ] Consent footnote = « Pas de revente, pas de spam — mentions légales »
  - [ ] Le lien `mentions légales` est cliquable et pointe vers `/mentions-legales`
- [ ] Bouton « Retour » step 2 = variant `link` (souligné, pas de border)
- [ ] Le CTA Step 2 reste « Confirmer la commande » (variant primary)

### 3.2 Non-régression W1
- [ ] Tests `LeadCaptureStep` : 8/8+ verts (assertions ajustées sur texte)
- [ ] Tests `AddressStep` : 7/7+ verts
- [ ] Tests `KitCommanderSection` : prop passing OK
- [ ] Aria-labels et roles préservés
- [ ] Submit serveur fonctionne (les events `lead_capture`, `address_completed` émis)

---

## 4. Phase W2 — Réassurance

### 4.1 Acceptation NoCommitmentBadge
- [ ] Composant rend `<section role="note">` avec aria-label
- [ ] Icône cadenas SVG aria-hidden true
- [ ] Label par défaut : « Aucun paiement maintenant »
- [ ] Sub par défaut : « Vous payez à la livraison, en main »
- [ ] Override labels via props
- [ ] Classes sauge-dark/25 + bg-sauge-soft/40
- [ ] Affiché UNIQUEMENT step `address` (pas step lead)

### 4.2 Acceptation TimeEstimateBadge
- [ ] Composant rend `<p data-testid="wizard-time-estimate">`
- [ ] Style italic + text-encre/60 + centré
- [ ] Texte par défaut = `copy.timeEstimateTotal`

### 4.3 Acceptation WizardStepIndicator enrichi
- [ ] Prop `timesPerStep?` optionnelle (rétro-compat)
- [ ] Si fournie, affiche `· {time}` à droite du label
- [ ] Si absente, comportement inchangé (5 cas tests précédents préservés)
- [ ] Time positionné sur la même ligne que le label

### 4.4 Non-régression W2
- [ ] StepIndicator tests existants tous verts
- [ ] Wizard render reste cohérent
- [ ] CartSnapshot props pas modifiés
- [ ] Submit serveur fonctionne

---

## 5. Phase W3 — Cart-recap + thumb pack mobile

### 5.1 Acceptation WizardCartRecap
- [ ] Rend `<aside role="region" aria-label="Récapitulatif…">`
- [ ] Affiche label `1 × Pack FemiGlow`
- [ ] Affiche prix total formaté `199 MAD`
- [ ] Affiche prix barré `390 MAD` si `priceCompareAt` fourni
- [ ] Sticky `top-0 z-30` sur mobile, statique desktop
- [ ] Image thumbnail `alt=""` (decorative)
- [ ] Backdrop blur sur mobile pour lisibilité scroll
- [ ] Z-index ≥ 30 (au-dessus du contenu wizard)
- [ ] Rend `null` si cart vide

### 5.2 Acceptation WizardMobilePackThumb
- [ ] Rend `<div data-testid="wizard-mobile-pack-thumb">`
- [ ] Affiché `< lg`, masqué `lg+` (`lg:hidden`)
- [ ] Image 64×80
- [ ] alt non vide
- [ ] Layout flex dans KitCommanderSection header

### 5.3 Non-régression W3
- [ ] Tests KitCommanderSection préservés
- [ ] Z-index n'écrase pas le chat widget (z-30 vs chat-launcher)
- [ ] CLS ≤ 0.05 (le cart-recap a une hauteur déterministe)
- [ ] Pas d'hydration mismatch (cart-recap dispose de initialCart côté SSR)

---

## 6. Phase W4 — Micro-feedback

### 6.1 Acceptation PhoneMaskInput
- [ ] Format live `0612345678` → `06 12 34 56 78`
- [ ] Renvoie au form parent la valeur **RAW** (pas le masque)
- [ ] Max 10 digits enforced
- [ ] Reject caractères non-numériques (visuellement)
- [ ] `autoComplete="tel"` préservé
- [ ] `inputMode="tel"` préservé
- [ ] Reference forwarded (ref propagé)

### 6.2 Acceptation WizardCheckmark
- [ ] Rend `✓` si `visible=true`
- [ ] Retourne `null` si `visible=false`
- [ ] `aria-hidden="true"`
- [ ] Classe `text-sauge-dark` + `text-xs` + animation `motion-safe:animate-fade-in`
- [ ] Affiché à droite du label firstName quand champ valide
- [ ] Idem pour phone (≥ 9 chiffres)

### 6.3 Acceptation ResumeBanner
- [ ] Rend si `leadDraft.firstName` présent ET `!resumeBannerDismissed`
- [ ] Template avec `{firstName}` remplacé correctement
- [ ] Émet `wizard_resume_shown` au mount (1 fois)
- [ ] Click ✕ → émet `wizard_resume_dismissed` + setVisible(false)
- [ ] Auto-hide après `autoHideMs` (default 5000)
- [ ] `role="status"` + `aria-live="polite"`
- [ ] Ne s'affiche plus après dismiss (persistence localStorage)

### 6.4 Acceptation tracking enrichi runtime
- [ ] `wizard_field_filled` émis 1 fois par champ valide par session
- [ ] Re-validation du même champ après invalid → invalid → valid n'émet PAS un 2ᵉ event
- [ ] `wizard_field_corrected` émis quand `detectCorrection` retourne true
- [ ] `wizard_step_abandoned` émis si visibility timeout > 10s
- [ ] Params correctement populés (field_name, step_name, time_since_focus_ms, etc.)

### 6.5 E2E Playwright
- [ ] `@wizard-render` : KitCommanderSection visible, WizardShell mount
- [ ] `@wizard-render` : WizardCartRecap + TimeEstimate + Indicator OK
- [ ] `@wizard-render` : NoCommitmentBadge visible step 2 only
- [ ] `@wizard-interaction` : PhoneMaskInput formate live
- [ ] `@wizard-interaction` : Checkmark apparaît si champ valide
- [ ] `@wizard-interaction` : CTA enabled quand isValid
- [ ] `@wizard-interaction` : Submit step 1 → step 2
- [ ] `@wizard-interaction` : Bouton Retour = link visuel
- [ ] `@wizard-resume` : Refresh → ResumeBanner affichée avec firstName
- [ ] `@wizard-resume` : Click ✕ → banner disparaît + persist dismiss
- [ ] `@wizard-tracking` : `wizard_field_filled` capturé via `page.on('request')`
- [ ] `@wizard-responsive` : Mobile sticky + thumb pack
- [ ] `@wizard-responsive` : Desktop statique + pas de thumb
- [ ] `@wizard-a11y` : 0 violation axe sérieuse/critique

### 6.6 Non-régression W4
- [ ] Existants Playwright `@kit`, `@pack-*`, `@steps-*`, `@composition-*` restent verts
- [ ] Lead submit → `lead_capture` émis (event existant)
- [ ] Address submit → `address_completed` + `purchase` émis
- [ ] Honeypot fonctionne (bot block silencieux)
- [ ] Validation Zod serveur miroir client toujours OK
- [ ] Mobile Safari sticky top-0 fonctionne sans freeze

---

## 7. Phase W5 (optionnelle) — Admin override

### 7.1 Acceptation backend
- [ ] Store memoryStore via `ext('kit-wizard')` singleton id
- [ ] Resolver cascade mock → override-published (public), inclut draft (admin)
- [ ] API routes auth obligatoire (401 sans session)
- [ ] Validation Zod stricte (422 si invalid)
- [ ] Audit log `kit_wizard.update/publish/reset`

### 7.2 Acceptation admin UI
- [ ] `/admin/kit/wizard` accessible
- [ ] Statut Mock / Draft / Published
- [ ] Édition 11 champs copy + 7 toggles features
- [ ] Aperçu live à droite md+
- [ ] Save désactivé si dirty=false ou !isValid
- [ ] Publish désactivé si dirty=true
- [ ] Reset magic word `RESET-WIZARD`
- [ ] AdminShell entry « Wizard /kit »

### 7.3 Acceptation bind public
- [ ] `KitCommanderSectionBound` (ou intégré inline RSC) appelle `resolveKitWizard()` côté serveur
- [ ] Override published patche les valeurs visibles
- [ ] Cache `revalidateTag('kit-wizard')` après publish

---

## 8. Non-régression globaux

### 8.1 Métadonnées critiques
- [ ] `<title>` `/kit` inchangé
- [ ] `<meta name="description">` `/kit` inchangée
- [ ] JSON-LD Product valide
- [ ] OG image `/kit` inchangée

### 8.2 Sections adjacentes intactes
- [ ] HeroProduit `/kit` reste fonctionnel
- [ ] Section composition (§4.3 + §4.5) intacte
- [ ] Section vidéo (§4.4) intacte
- [ ] Section pack (§4.6) — PriceBlock + PackVisualBound intacts
- [ ] Section steps (§4.7) — StepsTimeline intact
- [ ] Témoignages mains intacts
- [ ] Sticky cart mobile inchangé

### 8.3 Performance
- [ ] LCP `/kit` mobile ≤ 2,5 s
- [ ] CLS ≤ 0.05 (cart-recap a height stable)
- [ ] FID / INP ≤ 100 ms
- [ ] Bundle delta `/kit` ≤ +5 kB gzipped
- [ ] TTFB SSR ≤ 500 ms p75

### 8.4 Accessibilité
- [ ] Axe 0 violation sérieuse/critique
- [ ] Navigation clavier complète : firstName → phone → consent → CTA → city → line1 → CTA
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Contraste texte ≥ 4.5:1
- [ ] Lecteurs d'écran : ResumeBanner annoncée via aria-live="polite"
- [ ] Lecteurs d'écran : NoCommitmentBadge role="note" annoncé sans interrompre
- [ ] Cart-recap aria-label « Récapitulatif de votre commande »

### 8.5 Comportement public
- [ ] Submit lead < 800 ms (POST + navigate step)
- [ ] Submit address < 1200 ms (POST address + POST order + navigate)
- [ ] `prefers-reduced-motion` désactive fade-in checkmark
- [ ] Tracking events émis conformément aux schemas
- [ ] Pas de re-émission ou duplication d'events

### 8.6 Mobile spécifique
- [ ] Cart-recap sticky fonctionne iOS Safari 16+ sans freeze
- [ ] Pack thumb 64×80 ne déforme pas le header
- [ ] PhoneMaskInput compatible avec autofill iOS / Android Chrome
- [ ] Touch targets ≥ 44 px (bouton Retour link respecte hit area)

---

## 9. Sign-off

Une phase est close quand :
1. Cases section validées
2. PR review (auto-review minimum)
3. Smoke post-déploiement OK
4. Aucune alerte 5xx 24 h post-deploy

Le plan global est livré quand :
- W0-W4 closes
- Couverture ≥ 80 % `components/checkout/wizard/**`
- KPIs §3 mesurés J+7 et J+30
- `components/checkout/wizard/README.md` à jour
- Démo : un test utilisateur a complété le wizard mobile en < 110 s

---

## 10. Show stoppers

Bloquants absolus pour merge sur `master` :

- ❌ Régression sur section adjacente (hero, composition, ingredients, pack, vidéo, steps, témoignages)
- ❌ Hydration mismatch sur `/kit`
- ❌ Lighthouse `/kit` mobile < 90
- ❌ Axe violation sérieuse/critique
- ❌ Schema mock invalide
- ❌ Bundle delta `/kit` > 5 kB gzipped
- ❌ E2E flake > 1 fail / 3 runs
- ❌ Mention nominale fondatrice dans copy wizard
- ❌ Cliché orientaliste introduit
- ❌ PhoneMaskInput casse le format serveur (Zod refuse les 9 digits)
- ❌ Cart-recap sticky freeze iOS Safari
- ❌ Submit serveur lead/address/order ne fonctionne plus
- ❌ XSS via champ admin (W5)

Si touché → revert immédiat de la phase problématique.

---

## 11. Métriques de qualité du dossier

- [ ] 11 docs présents (README + 01..10)
- [ ] Cross-références cohérentes
- [ ] Pas de contradiction entre 08 (plan) et 09 (runbook)
- [ ] Pas de contradiction entre 07 (tests) et acceptances §2-§7
- [ ] Sommes j-h cohérentes (~2 j-h pour W0-W4, +½ j W5)
