# A/B testing — Doctrine + 5 expérimentations prioritaires

> Tester avant de croire. Une UX qu'on aime n'est pas une UX qui convertit. Doctrine A/B + 5 expériences chiffrées pour Wave V5-V7.

## Doctrine

### 1. Hypothèse claire avant test

Chaque expérience commence par une hypothèse en 3 parties :
```
[CHANGE] aura [IMPACT] sur [METRIC] parce que [REASONING]
```

Exemple :
> Ajouter un emoji 💎 dans la pill "Voir le Pack" **augmentera** le CTR de pills de 15% parce que les emojis rendent l'action plus saillante visuellement.

### 2. Métrique primaire unique

Chaque expérience a **une** métrique primaire (statistiquement). Métriques secondaires possibles mais non-déclencheurs.

### 3. Pas d'A/B/C/D

Variants `control` + `treatment`. Max. Sinon split trop fin = pas de signal.

### 4. Taille d'échantillon pré-calculée

Avant de lancer, on calcule la `N` requise pour MDE (Minimum Detectable Effect) à 95% confidence, 80% power.

Outil : `evanmiller.org/ab-testing/sample-size.html` ou calcul manuel.

### 5. Durée min 14 jours

Couvre 2 semaines complètes pour absorber day-of-week effects.

### 6. Pas de peeking

On regarde le résultat **après** la durée fixée. Pas de "j'arrête plus tôt parce que ça gagne".

### 7. Documenter le résultat

Win ou loss, on documente dans `docs/experiments/{date}-{key}.md` :
- Hypothèse.
- Variants.
- Échantillons.
- Résultats (p-value, lift, CI).
- Décision.

## Stack technique

### V5-V6 : Cookie-based simple

Variant assigné au premier `chat_session_created`, persisté en cookie `ab_{experimentKey}`.

```ts
function assignVariant(experimentKey: string): 'control' | 'treatment' {
  const cookie = getCookie(`ab_${experimentKey}`)
  if (cookie) return cookie as 'control' | 'treatment'
  
  const variant = Math.random() < 0.5 ? 'control' : 'treatment'
  setCookie(`ab_${experimentKey}`, variant, { maxAge: 30 * 86400 })
  
  // Fire event
  analytics.track('ab_test_assigned', { experimentKey, variant })
  return variant
}
```

### V7+ : GrowthBook

Migration vers GrowthBook self-hosted :
- Targeting avancé (audience, page, lang).
- Multi-variant.
- Stratification automatique.
- Analyse bayésienne intégrée.

## 5 expérimentations prioritaires

### Exp 1 — Greeting darija par défaut sur home

**Hypothèse** : Servir le greeting en darija par défaut (au lieu de FR) sur page home **augmentera** le `chat_engagement_rate` de 10% parce que la majorité du trafic est marocain et la familiarité de la langue baisse la friction.

**Variants** :
- Control : greeting FR sur `/`.
- Treatment : greeting AR-MA sur `/`.

**Métrique primaire** : `chat_engagement_rate` (chats opened / visitors).
**Métriques secondaires** :
- Time-to-first-message
- Lead capture rate

**Audience** : 100% trafic home (≈ 60k visiteurs/mois).
**Échantillon nécessaire** : ~3,500 per arm pour MDE 10% à baseline 8%.
**Durée** : 14 jours.

**Risque** :
- Les visiteurs FR pourraient se sentir exclus.
- Mitigation : la 1ère pill propose "🇫🇷 Français" si on détecte UA non-MA.

**Décision attendue** : Treatment win → switch défaut darija.

---

### Exp 2 — Position du LeadForm dans le flux

**Hypothèse** : Offrir le LeadForm **après 3 questions** (vs après 2 actuellement) **augmentera** le `lead_form_completion_rate` de 20% parce que l'utilisateur sera mieux informé donc plus engagé.

**Variants** :
- Control : LeadForm offert après 2 messages user.
- Treatment : LeadForm offert après 3 messages user.

**Métrique primaire** : `lead_form_completion_rate` = `lead_submitted / lead_form_offered`.
**Métriques secondaires** :
- `lead_form_displayed_rate` (peut baisser)
- `chat_to_purchase_rate` (NS)

**Audience** : sessions chat avec ≥ 2 messages user (≈ 1,500/mois).
**Échantillon** : 380 per arm pour MDE 20% à baseline 45%.
**Durée** : 21 jours.

**Risque** :
- Si LeadForm trop tardif, opportunité ratée.
- Suivre NS de près.

---

### Exp 3 — CTA inline vs sous-message

**Hypothèse** : Mettre le CTA "Voir le Pack" **inline dans la bulle canned** (vs en bouton sous-bulle séparé) **augmentera** le `cta_clicked` rate de 25% parce que la proximité visuelle réduit la friction.

**Variants** :
- Control : CTA en bouton séparé sous la bulle.
- Treatment : CTA inline en fin de bulle (style hyperlien stylisé).

**Métrique primaire** : `cta_clicked / canned_used`.
**Métriques secondaires** :
- `chat_to_purchase_rate`
- Time-to-first-action après canned

**Audience** : sessions avec canned-used (≈ 2,000/mois).
**Échantillon** : 600 per arm.
**Durée** : 14 jours.

---

### Exp 4 — Streaming wpm sur canned

**Hypothèse** : Augmenter la vitesse `wpm` de 180 à 230 sur canned **n'affectera pas négativement** la perception ni la satisfaction, **et réduira** le `time-to-message-completed` de 25%.

**Variants** :
- Control : wpm = 180.
- Treatment : wpm = 230.

**Métrique primaire** : feedback rate (+1) sur canned (pas de régression).
**Métriques secondaires** :
- Time spent reading bubble (heatmap)
- chat_closed_during_streaming (mesure abandon impatience)

**Audience** : 100% canned.
**Échantillon** : 800 per arm.
**Durée** : 14 jours.

**Note** : Si test guardrail (pas de dégradation), 1.0 = no harm, treatment OK car économise du temps utilisateur.

---

### Exp 5 — Suggestion proactive après 30s inactivity

**Hypothèse** : Afficher un **badge "1" + pulse** sur le launcher après 30s d'inactivité utilisateur **augmentera** le `chat_engagement_rate` de 20% parce que la visibilité contextuelle des suggestions invite à l'action.

**Variants** :
- Control : launcher statique.
- Treatment : launcher avec badge + pulse à 30s.

**Métrique primaire** : `chat_engagement_rate`.
**Métriques secondaires** :
- `chat_closed_within_5s` (rejet immédiat = signal négatif)
- Bounce rate page

**Audience** : 100% visiteurs.
**Échantillon** : 5,000 per arm.
**Durée** : 14 jours.

**Risque** :
- Annoying si trop souvent.
- Mitigation : pulse 1 fois max par session, badge persist mais discret.

---

## Process A/B opérationnel

### Étape 1 : Proposition

Document (Notion ou inline `docs/experiments/proposals/`) :
- Hypothèse formelle.
- MDE et N requise.
- Métriques.
- Durée.
- Risques + mitigations.
- Approval PO.

### Étape 2 : Implémentation

Code derrière feature flag :
```ts
const variant = useAbVariant('greeting-darija-default')
const greeting = variant === 'treatment' ? greetingAr : greetingFr
```

### Étape 3 : Ramp-up

Démarrage à 10% pendant 24h pour vérifier qu'aucun bug n'émerge (pas de spike d'errors), puis 50/50.

### Étape 4 : Monitoring quotidien

Dashboard d'expérience montre :
- Échantillon en cours par arm.
- Métrique primaire vs control (mais on n'agit pas).
- Guardrails (errors, latency) en rouge si dérive.

### Étape 5 : Analyse à fin de période

- Test statistique (Chi-square pour conversion, t-test pour latence).
- IC à 95%.
- Décision : win / loss / no-effect.

### Étape 6 : Décision

- Win significatif : ship le treatment partout.
- Loss significatif : revert.
- No-effect : ship le moins coûteux (souvent control).

### Étape 7 : Post-mortem

Document publié, partagé avec équipe. Apprentissages capitalisés.

## Backlog d'expériences (futures)

| ID | Idée | Priorité | Wave |
|---|---|---|---|
| ABx1 | Avatar assistant vs sans avatar | M | V5 |
| ABx2 | Composer placeholder personnalisé selon intent détecté | M | V6 |
| ABx3 | "Soyez rappelée" vs "Demande de rappel" | L | V5 |
| ABx4 | Sources popover vs sources inline links | M | V6 |
| ABx5 | Pills 2 vs 3 vs 4 max | M | V5 |
| ABx6 | Thumbs après chaque message vs en fin de session | L | V6 |
| ABx7 | Notification push après lead "rappel programmé" | XL | V7 |
| ABx8 | Service degraded toast visible vs masqué | M | V6 |

## Gouvernance

- Max **2 expériences simultanées** pour éviter interactions.
- Toute expérience > 7 jours doit avoir un dashboard de monitoring temps-réel.
- Pas d'expérience sur les flux RGPD ou paiement.
- Documentation Notion `/experiments/{key}/result.md` publiée au plus tard J+7 après fin.
