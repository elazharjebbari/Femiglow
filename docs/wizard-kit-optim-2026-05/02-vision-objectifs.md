# 02 — Vision & objectifs

## 1. Vision en une phrase

> Transformer le wizard de 3 steps d'un **formulaire utilitaire** en un
> **tunnel rassurant et chiffré** qui accompagne la cliente du premier
> champ au « commande reçue » — sans ajouter un seul step, sans
> changer la voix lente FemiGlow.

## 2. Personas et objectifs UX

| Persona | Avant la refonte | Après la refonte |
|---|---|---|
| **Yasmine** mobile-first | « Combien ça va prendre ? Je paie où ? » | Cart-recap permanent + estimateur « ≈ 90 s » + badge « 0 € maintenant » |
| **Salma** méthodique | « C'est sécurisé ? Y a-t-il un piège ? » | NoCommitmentBadge collé au CTA + consent reformulé « je veux » |
| **Amal** revenante | « J'avais commencé hier, faut-il tout retaper ? » | ResumeBanner « Bon retour, Amal — on reprend où vous en étiez » |

## 3. KPIs cibles précis (mesurés J+7 / J+30 / J+90)

### 3.1 Drop-off funnel

| Étape | Baseline | Cible J+30 | Cible J+90 |
|---|---|---|---|
| `/kit` visit → scroll `#commander-femiglow` | ~35 % | ≥ 40 % | ≥ 45 % |
| Scroll wizard → `checkout_intent` (1ère frappe) | ~50 % | ≥ 60 % | ≥ 65 % |
| `checkout_intent` → `lead_capture` | ~55 % | **≥ 70 %** | **≥ 75 %** |
| `lead_capture` → `address_completed` | ~80 % | **≥ 88 %** | **≥ 90 %** |
| `address_completed` → `purchase` | ~95 % | ≥ 96 % | ≥ 97 % |
| **Conversion globale `/kit` → `purchase`** | **~2-3 %** | **≥ 3,5 %** | **≥ 4 %** |

### 3.2 Engagement micro

| KPI | Mesure | Baseline | Cible J+30 |
|---|---|---|---|
| `wizard_field_filled` count par session | IO du field complété valide | — | ≥ 4 / 5 (firstName + phone + consent + city + line1) |
| `wizard_field_corrected` count | Frappe puis effacement | — | ≤ 1 / session en moyenne |
| `wizard_step_abandoned` | Scroll hors-wizard > 10s | — | ≤ 25 % par step |
| Mobile completion rate | `purchase` sur device mobile | ~50 % | ≥ 65 % |
| Temps moyen complétion | `checkout_intent` → `purchase` | ~3 min | ≤ 110 s |

### 3.3 Qualité technique

| KPI | Cible |
|---|---|
| Erreurs validation téléphone (`invalid_input`) | ≤ 4 % submits |
| Lighthouse `/kit` mobile | ≥ 92 (préservé) |
| CLS | ≤ 0.05 (cart-recap sticky ne bouge pas le contenu) |
| Bundle delta `/kit` | ≤ +5 kB gzipped |
| Axe violations sérieuses/critiques | 0 |
| Coverage `components/checkout/wizard/**` | ≥ 85 % branches |

## 4. Tracking events introduits

### 4.1 Micro-events (nouveaux — P8)

| Event | Trigger | Params Zod |
|---|---|---|
| `wizard_field_filled` | Champ devient valide (1 fois par champ par session) | `{field_name, step_name, form_id, time_since_focus_ms}` |
| `wizard_field_corrected` | Frappe puis effacement complet du champ | `{field_name, step_name, attempts}` |
| `wizard_step_abandoned` | Wizard sort du viewport > 10s avant submit | `{step_name, fields_completed, time_in_step_ms}` |
| `wizard_resume_shown` | ResumeBanner « Bon retour » affichée | `{step_name, time_since_last_visit_ms}` |
| `wizard_resume_dismissed` | Click sur le ✕ de la ResumeBanner | `{step_name}` |

### 4.2 Events existants — préservés

`checkout_intent`, `form_start`, `lead_capture`, `address_completed`, `add_payment_info` (serveur), `purchase`, `wizard_error`, `wizard_abandoned` (legacy).

## 5. Décisions éditoriales actées

| Champ | Valeur retenue |
|---|---|
| **CTA Lead** | `« Continuer · paiement à la livraison »` |
| **CTA Address** | `« Confirmer la commande »` (inchangé) |
| **Badge no-commitment** label | `« 🔒 Aucun paiement maintenant »` + sub `« Vous payez à la livraison, en main »` |
| **TimeEstimate header** | `« ≈ 90 secondes pour confirmer »` |
| **TimeEstimate per-step** | step 1 : `60 s` · step 2 : `30 s` · step 3 : `5 s` |
| **Consent label** | `« Je veux être rappelée pour confirmer ma commande »` |
| **Consent footnote** | `« Pas de revente, pas de spam — mentions légales »` |
| **ResumeBanner** | `« Bon retour, {firstName} — on reprend où vous en étiez. »` |
| **CartRecap label** | `« 1 × Pack FemiGlow »` + prix |
| **Field validation check** | ✓ couleur `text-sauge-dark`, taille 12 px |
| **Bouton Retour Step 2** | passe en `variant="link"` (au lieu de `secondary`) |

## 6. Critères de réussite

La refonte est réussie quand à J+30 :

- [ ] Drop-off `checkout_intent` → `lead_capture` ≤ 30 % (vs ~45 % baseline)
- [ ] Drop-off `lead_capture` → `address_completed` ≤ 12 % (vs ~20 %)
- [ ] Conversion globale `/kit` → `purchase` ≥ 3,5 %
- [ ] Mobile completion ≥ 65 %
- [ ] Temps moyen ≤ 110 s
- [ ] Lighthouse `/kit` mobile inchangé (≥ 92)
- [ ] 0 régression sur composants adjacents (PriceBlock, StepsTimeline, PackVisualBound)
- [ ] Axe 0 violation sérieuse/critique
- [ ] Tests vitest + Playwright 100 % verts
- [ ] Tracking enrichi (P8) opérationnel — drop-off précisément localisé

## 7. Anti-objectifs

Ce qu'on **ne cherche PAS** à faire :

- Pas de countdown / urgency (incompatible voix maison)
- Pas de pop-up / modale d'interruption
- Pas de mention nominale fondatrice dans la copy wizard
- Pas de cliché orientaliste
- Pas d'ajout/suppression de step (les 3 steps restent)
- Pas de code promo / cross-sell intra-wizard
- Pas de demande d'email au step 1 (reste en opt-in step 3)
- Pas de social login / SSO (out of scope)
- Pas de A/B test multi-bras dans cette itération — réservé pour v2 post-J+30
