# 01 — Contexte & audit Kolenda

## 1. Périmètre et architecture actuelle

```
/kit (page App Router)
└── KitCommanderSection (Client, ancre #commander-femiglow)
    ├── Header
    │   ├── Kicker « Commander le rituel »
    │   ├── H2 italic « Trois gestes, livrés chez vous. »
    │   └── Sub réassurance « Quelques coordonnées… 24-48 h »
    └── WizardShell (Client, store Zustand persistent)
        ├── WizardStepIndicator (01 · 02 · 03)
        ├── Step 1 LeadCaptureStep
        │   ├── Prénom (TextField · 2-60 chars)
        │   ├── Téléphone (TextField · transform → 9 digits)
        │   ├── Consent checkbox (literal true)
        │   ├── Honeypot caché (anti-bot)
        │   └── CTA « Continuer » primary fullWidth (disabled !isValid)
        ├── Step 2 AddressStep
        │   ├── StockIndicator (premier variantId)
        │   ├── CityAutocomplete (DB-driven /api/delivery-cities/search)
        │   ├── TextField addressLine1
        │   ├── ShippingNotice (dynamique prix + ETA)
        │   ├── TextAreaField notes (max 500, compteur)
        │   └── Retour (secondary) · « Confirmer la commande » (primary)
        └── Step 3 ThankYouStep (confirmation)
```

**Stack technique** :
- React Hook Form + Zod validation `onChange`
- Zustand `wizardStore` avec persistence localStorage (`leadDraft`, `addressDraft`)
- `useLeadCaptureMutation`, `useAddressMutation` (orchestrateurs API)
- Tracking events : `checkout_intent`, `form_start`, `lead_capture`, `address_completed`, `add_payment_info`, `purchase`
- A11y : `aria-labelledby`, `role="alert"`, `aria-invalid`, autocomplete navigateur
- i18n : `useWizardTranslation` (FR par défaut, AR latent)

## 2. Rôle dans le funnel

Le wizard est **le tunnel de conversion final** : tout ce qui se passe sur
`/kit` au-dessus (hero, video, composition, pack, steps grid) sert à
amener la cliente jusqu'à cette section. C'est ici que la conversion se
joue **réellement**.

**Drop-off attendus** (estimés sans tracking enrichi actuel) :
- `/kit` visit → scroll vers `#commander-femiglow` : ~30-40 %
- Scroll wizard → 1ère frappe (`checkout_intent`) : ~40-60 %
- 1ère frappe → submit lead (`lead_capture`) : **~50-60 %** ← **friction #1**
- Submit lead → submit address (`address_completed`) : **~70-85 %**
- Submit address → `purchase` (auto-confirm serveur) : ~95 %

Le **plus gros levier de conversion** est entre la 1ère frappe et le
submit lead. C'est ce que ce plan adresse en priorité (P1-P5).

## 3. Audit Kolenda — faiblesses (W1–W12)

### Score actuel : **7/20** (frictions actives)

| # | Faiblesse | Principe Kolenda | Sévérité | Impact conv. |
|---|---|---|---|---|
| **W1** | Aucun récap panier permanent dans le wizard. La cliente perd visuellement le pack pendant le checkout | **Pricing #6** + **Trust #2** | 🔴 Critique | -10 à -15 % step 2 |
| **W2** | CTA Step 1 = « Continuer » — verbe neutre, ne rappelle ni le bénéfice ni l'absence d'engagement financier | **Copy #9** + **Pricing #11** | 🔴 Critique | -5 à -8 % submit |
| **W3** | Aucun temps estimé affiché (« 90 sec pour confirmer ») | **Attention #18** | 🟡 Moyen | -3 à -6 % entry |
| **W4** | Réassurance « paiement à la livraison » noyée dans le sub-titre — pas mise en avant comme garantie « zéro risque » près du CTA Address | **Trust #1** | 🟡 Moyen | -3 à -5 % step 2 |
| **W5** | Pas de feedback visuel pendant la frappe (✓ sur champ valide) — la cliente avance « à l'aveugle » | **Attention #2** | 🟢 Faible | -1 à -3 % |
| **W6** | `leadDraft` restauré silencieusement après refresh, mais aucune mention « Bon retour, Yasmine » | **Trust #5** | 🟢 Faible | +1 à +2 % halo |
| **W7** | Téléphone : pas de masque de saisie live (`06 12 34 56 78` est juste un placeholder) | **Trust #3** | 🟡 Moyen | -2 à -4 % submit |
| **W8** | CTA « Continuer » ne précise pas ce qui se passe ensuite (rappel ? signature ? livreur ?) | **Copy #15** | 🟡 Moyen | -3 à -5 % step 2 |
| **W9** | Consent : « J'accepte d'être contactée » sonne formel et défensif — friction émotionnelle | **Trust #6** | 🟢 Faible | -1 à -2 % |
| **W10** | Aucun social proof inline dans le wizard — les avis lus 800 px plus haut sont oubliés | **Ecom #14** | 🟡 Moyen | -2 à -4 % |
| **W11** | Bouton « Retour » au step 2 même poids visuel que « Confirmer » | **Hierarchy #1** | 🟢 Faible | -1 % erreurs |
| **W12** | Erreur réseau bannier rouge anxiogène — fond petale-soft/30 trop visible | **Trust #4** | 🟢 Faible | -1 % retry |

### Forces actuelles (à préserver)

| Force | Principe Kolenda |
|---|---|
| 2 champs Step 1 seulement (prénom + téléphone) | **Friction #2** *(minimum fields)* ✓ |
| Step 2 : CityAutocomplete avec ETA + prix dynamiques | **Pricing #7** *(transparent shipping)* ✓ |
| Validation `onChange` instantanée | **Attention #5** *(immediate feedback)* ✓ |
| Honeypot + Zod miroir client/serveur | Anti-fraud propre ✓ |
| Resume après refresh (leadDraft / addressDraft persistents) | **Trust #5** *(memory)* partiel ✓ |
| Tracking branche complète (`checkout_intent` → `purchase`) | Observabilité solide ✓ |
| A11y : aria-labelledby, role=alert, autocomplete | WCAG 2.1 AA ✓ |
| Pas de step paiement UI (CHA-231) | **Friction #6** *(skip steps)* ✓ |

## 4. Personas et leurs frictions

### Persona 1 — Yasmine, 28 ans, mobile-first

Achète en scrollant le soir. Tape vite. Aurait besoin de :
- voir le pack qu'elle commande (W1)
- savoir combien de temps ça va prendre (W3)
- être rassurée qu'aucun argent ne sort maintenant (W4)
- voir son téléphone formaté pendant la frappe (W7)

### Persona 2 — Salma, 45 ans, méthodique

Lit tout. Hésite. Aurait besoin de :
- voir la garantie « 0 € maintenant » au moment précis du clic (W4)
- comprendre clairement ce qui se passe après « Continuer » (W8)
- voir des étoiles ou témoignages dans le wizard (W10)

### Persona 3 — Amal, 35 ans, revenante

A fermé l'onglet hier, revient aujourd'hui. Aurait besoin de :
- être reconnue (« Bon retour, Amal ») (W6)
- reprendre où elle s'était arrêtée (déjà géré côté store, pas mis en valeur UX)

## 5. Hypothèses conversion (chiffrées)

| Levier | Hypothèse de lift | Confiance |
|---|---|---|
| P1 Cart-recap permanent | +5 à +8 % submit step 2 | Forte (Baymard #checkout-summary) |
| P2 CTA outcome (« paiement à la livraison ») | +3 à +6 % submit step 1 | Moyenne (test A/B éventuel) |
| P3 Badge « 0 € maintenant » | +2 à +4 % submit step 2 | Moyenne |
| P4 Estimateur temps | +1 à +3 % entry rate | Faible (effet halo difficile à isoler) |
| P5 Masque téléphone | +1 à +3 % validation passes | Moyenne (réduction erreurs) |
| P6 Bon retour | +0,5 % retention | Faible |
| P7 Photo pack mobile | +1 à +2 % engagement | Faible |
| P8 Tracking enrichi | Outil pilotage (pas direct) | — |
| P9 Hierarchy bouton | +0,5 % erreurs évitées | Faible |
| P10 Consent reformulé | +1 % consent rate | Moyenne |
| **Lift combiné estimé** | **+12 à +20 %** conversion globale | Moyenne |

## 6. Risques identifiés

| Risque | Probabilité | Mitigation |
|---|---|---|
| Refonte trop chargée → casse la voix lente | Faible | Toutes les modifs sont **additives**, voix mock/copy inchangée |
| Cart-recap sticky mobile prend de la place | Moyen | Hauteur ≤ 64 px, repli automatique au-delà step 1 |
| Masque téléphone interfère avec autocomplete OS | Moyen | Garder `autoComplete="tel"`, masquer uniquement au focus + après-frappe |
| Tracking enrichi pollue analytics | Faible | Events `wizard_*` namespace dédié + sample 100 % débuts puis 10 % |
| Badge « 0 € » contredit le wording cart-recap | Faible | Les 2 messages cohabitent ; cart-recap dit le prix, badge dit « pas maintenant » |
| Hydration mismatch sur WizardCartRecap | Moyen | SSR-safe : panier déjà côté serveur (initialCart prop) |
| A11y régression (focus order, role) | Faible | Tests E2E axe `@wizard-a11y` × 3 viewports |

## 7. Alignement avec les autres refontes

| Refonte | Élément aligné |
|---|---|
| Pack section (§4.6) | Cart-recap réutilise le même formatage de prix `199 MAD · 390 MAD barré` |
| Steps grid (§4.7) | TimeEstimateBadge reprend la grammaire « ≈ 90 s » du steps header « ≈ 5 minutes » |
| Composition (§4.5) | PostCtaLink existant (style chuchoté) inspire `ResumeBanner` voix |
| Components-CMS | Photo pack header réutilise le slot `kit-pack-visual/primary` déjà actif |

## 8. Anti-patterns à éviter

| Anti-pattern | Conséquence | Mitigation |
|---|---|---|
| Ajouter un step (panier → adresse → paiement → confirm) | Friction × 1.3 | Garder 3 steps figés |
| Bouton « Suivant » avec compte à rebours | Anxiogène | Estimateur sans countdown |
| Pop-up « offer ! » au scroll vers wizard | Casse la voix | Aucune modal, tout inline |
| Champ "Code promo" visible | Distraction Pricing #3 | Pas dans le scope (cf. CHA-231) |
| Témoignages avec photo dans wizard | Trop visuel, distraction | Garder le social proof DANS la section pack, pas DANS le wizard |
| Cart-recap éditable inline | Friction edit | Read-only (modifier = sortir du wizard) |
| Auto-save brutal toutes les 500 ms | Network spam | Déjà géré : debounced merge sur `mergeLeadDraft` |
