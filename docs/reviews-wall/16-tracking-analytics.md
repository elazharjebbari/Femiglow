# 16 — Tracking et analytics

Catalogue exhaustif des événements émis par le composant « Rituels partagés », mapping vers le dataLayer GTM, agrégation insights et tableaux de bord admin.

## 1. Architecture tracking

Le composant émet via le pipeline existant `lib/tracking/`. Les événements sont déclarés dans `lib/tracking/event-catalog.ts` (cf. document `01-codebase-shop.md`) puis dispatché vers les providers configurés (GA4, Meta, GTM custom).

```
RitualsWall component
        │
        ▼
emit('ritual_wall_open', payload)
        │
        ▼
lib/tracking/client → POST /api/track
        │
        ▼
lib/tracking/server/enricher (ajoute session, device, locale, consent)
        │
        ▼
INSERT INTO tracking_events_log
        │
        ▼
Dispatch async vers providers actifs
```

## 2. Catalogue d'événements

Chaque ligne ci-dessous correspond à une entrée dans `tracking_event_definitions` (table existante).

### 2.1 Surface d'entrée et exposition

| Événement | Catégorie | Funnel stage | Conversion ? | Description |
| --- | --- | --- | --- | --- |
| `ritual_module_view` | engagement | tof | Non | Module compact `/kit` entre dans le viewport ≥ 50 % |
| `ritual_module_card_impression` | engagement | tof | Non | Une des 3 cards du module est vue ≥ 50 % |
| `ritual_module_card_click` | engagement | mof | Non | Click sur une card → ouvre le drawer scrollé sur la card |
| `ritual_module_link_click` | engagement | mof | Non | Click sur `Lire les 26 rituels →` |

### 2.2 Drawer — lecture

| Événement | Catégorie | Funnel stage | Conversion ? | Description |
| --- | --- | --- | --- | --- |
| `ritual_wall_open` | engagement | mof | Non | Drawer ouvert |
| `ritual_wall_close` | engagement | mof | Non | Drawer fermé |
| `ritual_wall_filter_change` | engagement | mof | Non | Chip filtre cliqué |
| `ritual_wall_sort_change` | engagement | mof | Non | Tri changé (futur) |
| `ritual_wall_card_impression` | engagement | mof | Non | Carte du drawer vue ≥ 50 % |
| `ritual_wall_photo_open` | engagement | mof | Non | Lightbox ouverte sur une photo |
| `ritual_wall_load_more` | engagement | mof | Non | Bouton `Afficher plus` cliqué |
| `ritual_wall_policy_view` | engagement | mof | Non | Lien `Comment vérifiés` cliqué |
| `ritual_wall_error` | engagement | mof | Non | Erreur API affichée à l'initiée |

### 2.3 Conversion (vers `/kit`)

| Événement | Catégorie | Funnel stage | Conversion ? | Description |
| --- | --- | --- | --- | --- |
| `ritual_wall_cta_buy_click` | ecommerce | bof | **Oui** | CTA `Recevoir le pack` cliqué depuis le drawer |
| `ritual_wall_share_link_click` | engagement | mof | Non | Lien `Partager mon rituel →` cliqué |

### 2.4 Wizard — soumission

| Événement | Catégorie | Funnel stage | Conversion ? | Description |
| --- | --- | --- | --- | --- |
| `ritual_submit_start` | lead | conversion | Non | Wizard ouvert |
| `ritual_submit_step_view` | lead | conversion | Non | Étape affichée |
| `ritual_submit_step_complete` | lead | conversion | Non | Étape complétée (validation OK) |
| `ritual_submit_step_skip` | lead | conversion | Non | Étape sautée |
| `ritual_submit_word_count_milestone` | lead | conversion | Non | Body atteint 50 mots |
| `ritual_submit_emoji_stripped` | lead | conversion | Non | Emoji retiré à la frappe |
| `ritual_submit_photo_upload_start` | lead | conversion | Non | Drop / click upload |
| `ritual_submit_photo_upload_success` | lead | conversion | Non | Upload OK |
| `ritual_submit_photo_upload_error` | lead | conversion | Non | Upload échoué |
| `ritual_submit_photo_face_detected` | lead | conversion | Non | Vision ML détecte un visage |
| `ritual_submit_photo_face_kept` | lead | conversion | Non | Initiée choisit `Conserver pour relecture` |
| `ritual_submit_photo_face_replaced` | lead | conversion | Non | Initiée remplace la photo |
| `ritual_submit_success` | lead | conversion | **Oui** | Soumission acceptée (202) |
| `ritual_submit_error` | lead | conversion | Non | Soumission échouée (4xx/5xx) |
| `ritual_submit_abandoned` | lead | conversion | Non | Wizard fermé sans soumettre |
| `ritual_submit_draft_resumed` | lead | conversion | Non | Reprise de brouillon localStorage |

### 2.5 Admin (audit interne)

Émis depuis le back-office, écrits dans `audit_events` (pas le tracking public).

| Événement | Description |
| --- | --- |
| `ritual_admin_approved` | Témoignage approuvé |
| `ritual_admin_rejected` | Témoignage rejeté |
| `ritual_admin_hidden` | Témoignage masqué |
| `ritual_admin_featured_on` | Featured activé |
| `ritual_admin_featured_off` | Featured retiré |
| `ritual_admin_corrected` | Coquille corrigée |
| `ritual_admin_restored` | Restauré depuis HIDDEN/REJECTED |
| `ritual_admin_photo_face_overridden` | Photo face approuvée par modératrice |
| `ritual_admin_photo_rejected` | Photo seule rejetée |
| `ritual_admin_policy_updated` | Texte politique édité |

## 3. Payload commun

Tous les événements héritent du payload commun défini dans `lib/tracking/server/enricher.ts` :

```ts
{
  // Hérité
  event_id: string,           // UUID unique de l'event
  event_name: string,
  received_at: ISO 8601,
  session_id: string,
  anonymous_id: string,
  device: 'mobile' | 'tablet' | 'desktop',
  locale: 'fr' | 'ar',
  consent: { analytics: bool, marketing: bool },
  page_url: string,
  page_referrer: string,
  traffic_source: string,
  traffic_medium: string,
  experiment_variant: string | null,
}
```

## 4. Payloads spécifiques

### 4.1 `ritual_module_view`

```json
{
  "featured_ids": ["k7m3qp2x", "pq3m9k2x", "m2k9pq3x"],
  "fallback_used": false
}
```

### 4.2 `ritual_wall_open`

```json
{
  "entry_point": "kit_module_link" | "kit_card_click" | "kit_standalone_link" | "email_j45" | "url_direct",
  "preselect_filter": null | "with_photos" | "halal" | "recent",
  "preselect_card": null | "k7m3qp2x"
}
```

### 4.3 `ritual_wall_close`

```json
{
  "duration_ms": 23400,
  "cards_seen": 8,
  "filters_used": ["halal"],
  "load_more_count": 1,
  "share_clicked": false,
  "cta_buy_clicked": false
}
```

### 4.4 `ritual_wall_filter_change`

```json
{
  "filter_key": "with_photos" | "halal" | "recent" | "all",
  "filter_value_before": "all",
  "filter_value_after": "with_photos",
  "result_count": 18
}
```

### 4.5 `ritual_wall_card_impression`

```json
{
  "testimonial_id": "k7m3qp2x",
  "card_position": 3,
  "has_photo": true,
  "would_recommend": "oui",
  "tags": ["ongles-plus-lisses", "plus-de-casse"]
}
```

### 4.6 `ritual_wall_cta_buy_click`

```json
{
  "cards_seen_before_click": 4,
  "time_in_drawer_ms": 18300,
  "filters_active": ["halal"],
  "from_card_id": "k7m3qp2x" | null
}
```

Particulièrement précieux : on attribue la conversion au témoignage **lu juste avant le click**, et aux filtres actifs au moment du click.

### 4.7 `ritual_submit_success`

```json
{
  "public_slug": "n9q4kp3x",
  "has_photos": true,
  "photo_count": 2,
  "tag_count": 2,
  "would_recommend": "oui",
  "is_anonymous": false,
  "language": "fr",
  "from_email": true,
  "duration_total_ms": 187000,
  "step_skipped_count": 0,
  "draft_resumed": false
}
```

### 4.8 `ritual_submit_error`

```json
{
  "error_code": "RATE_LIMIT" | "VALIDATION_ERROR" | "PHOTO_TOO_LARGE" | "INVALID_EMAIL_TOKEN" | "INTERNAL",
  "step": 1 | 2 | 3,
  "field": "body" | "would_recommend" | "photo" | null
}
```

## 5. dataLayer GTM

Pour les événements destinés à GA4 / Meta / TikTok via GTM :

```js
window.dataLayer.push({
  event: 'ritual_wall_cta_buy_click',
  ritual: {
    cards_seen_before_click: 4,
    time_in_drawer_ms: 18300,
    filters_active: ['halal'],
    from_card_id: 'k7m3qp2x'
  },
  ecommerce: {
    currency: 'MAD',
    value: 199,
    items: [{
      item_id: 'pack-femiglow',
      item_name: 'Pack FemiGlow',
      price: 199,
      quantity: 1
    }]
  }
});
```

L'enrichissement `ecommerce` permet à GA4 d'attribuer un `begin_checkout` ou un `select_item` selon mapping configuré dans `tracking_event_definitions`.

## 6. KPI primaires

### 6.1 KPI conversion

| KPI | Définition | Cible |
| --- | --- | --- |
| **Taux d'ouverture du drawer** | `ritual_wall_open` / sessions `/kit` | > 25 % |
| **Taux de conversion drawer → add-to-cart** | `ritual_wall_cta_buy_click` / `ritual_wall_open` | > 8 % |
| **Lift conversion vs non-exposé** | Conversion add-to-cart parmi cohort exposée vs non | ≥ + 30 % |
| **Temps moyen dans le drawer** | `duration_ms` médian de `ritual_wall_close` | > 30 sec |
| **Cartes médianes lues** | `cards_seen` médian de `ritual_wall_close` | > 5 |

### 6.2 KPI contribution

| KPI | Définition | Cible |
| --- | --- | --- |
| **Taux d'ouverture e-mail J+45** | Délivrés / opens | > 30 % |
| **CTR e-mail J+45** | Clicks / opens | > 15 % |
| **Taux de complétion wizard** | `ritual_submit_success` / `ritual_submit_start` | > 40 % |
| **Témoignages soumis par mois** | Count `ritual_submit_success` mensuel | ≥ 10 à 6 mois |
| **Taux d'approbation post-modération** | `APPROVED` / `PENDING` (cumul) | > 90 % |
| **Délai médian de modération** | Médian `published_at - created_at` | < 24 h |

### 6.3 KPI qualité

| KPI | Définition | Cible |
| --- | --- | --- |
| **Témoignages avec photos** | Count avec photos / Count total | > 50 % |
| **Témoignages > 100 mots** | Count > 100 mots / Total | > 60 % |
| **Top tags concentration** | Part des 3 top tags vs total tags | 40-60 % (équilibre) |
| **Signal `oui` ratio** | Count oui / Total | > 85 % |
| **Témoignages vérifiés** | `verified_purchase = true` / Total | > 70 % |

## 7. Dashboard admin Insights

Onglet `/admin/rituals/insights` (cf. `10-interface-admin.md` § 8) consomme :

- Vue matérialisée `ritual_aggregate` (compte, oui_count, with_photos_count, top_tags).
- Agrégation tracking_events_log côté serveur via la couche `lib/analytics/insights/`.
- Tableaux insights pré-agrégés (cohérents avec le modèle existant `insights_*`).

### 7.1 Nouveaux insights à ajouter

Création de tables d'agrégation dédiées (à ajouter dans migration ultérieure) :

```sql
CREATE TABLE insights_rituals_daily (
  date DATE NOT NULL,
  product_key TEXT NOT NULL,
  module_views INT NOT NULL DEFAULT 0,
  wall_opens INT NOT NULL DEFAULT 0,
  cta_buy_clicks INT NOT NULL DEFAULT 0,
  submit_starts INT NOT NULL DEFAULT 0,
  submit_success INT NOT NULL DEFAULT 0,
  unique_sessions_with_wall INT NOT NULL DEFAULT 0,
  PRIMARY KEY (date, product_key)
);
```

Alimentation via le CRON existant `insights-refresh` (table déjà présente) — ajouter une requête supplémentaire.

## 8. A/B test (Phase 2)

### 8.1 Test 1 — Module compact présent vs absent

- **Cible** : valider que le module compact augmente l'add-to-cart.
- **Split** : 50/50 sur les sessions `/kit`.
- **Durée** : 4 semaines minimum, MDE 5 points sur add-to-cart.
- **Métriques primaires** : add-to-cart rate, revenu / session.
- **Métriques de garde-fou** : LCP, bounce rate.

### 8.2 Test 2 — Position du module compact

- **A** : entre composition et comparatif.
- **B** : juste après le hero.
- **Cible** : trouver la position optimale.

### 8.3 Test 3 — Wording du CTA d'entrée

- **A** : `Lire les 26 rituels partagés →`
- **B** : `Les voix de 26 initiées →`
- **C** : `Découvrir nos rituels partagés →`

### 8.4 Implémentation

S'appuie sur `experiments` et `experiment_variants` (tables existantes Drizzle). Assignment via cookie + `experiment_assignments`.

## 9. Vie privée et consentement

- Tous les événements respectent `consent.analytics`. Si `false`, événement écrit en local uniquement (`tracking_events_log`) sans dispatch GA4/Meta.
- `consent.marketing` requis pour dispatch Meta CAPI / TikTok.
- IP anonymisée côté `lib/tracking/server/enricher.ts` (déjà existant).
- Pas de PII dans les payloads (pas d'e-mail, pas de téléphone, pas de nom complet).

## 10. Outils de visualisation

### 10.1 Vercel Analytics

Web Vitals par route, accessible à l'équipe.

### 10.2 Tableau de bord admin

Onglet `/admin/rituals/insights` (cf. `10-interface-admin.md`). Tous les KPI de § 6.

### 10.3 GA4

Suivi standard via dataLayer. Funnel ecommerce mappé (`ritual_wall_cta_buy_click` → `begin_checkout` GA4).

### 10.4 Meta Ads Manager

Conversions API : `ritual_wall_cta_buy_click` → événement custom `RitualWallEngagement`. Permet d'optimiser les campagnes Meta sur le proxy d'intention plutôt que l'achat final (moins de signal).

## 11. Synthèse — règles d'or tracking

1. **Tout événement est typé via Zod** dans `event-catalog.ts`. Pas de payload free-form.
2. **Aucun événement ne contient de PII.** Pas d'e-mail, pas de téléphone, pas de nom complet.
3. **Le consent est respecté avant dispatch.** Pas de fallback secret.
4. **Les conversions sont marquées `conversion = true`** dans `tracking_event_definitions` pour activer les rapports dédiés.
5. **Le `from_card_id` est capturé** lors d'un click CTA — précieux pour attribuer la conversion.
6. **Les `cards_seen` et `duration_ms` sont capturés à la fermeture** — donne la profondeur de lecture.
7. **L'A/B test repose sur l'infra existante** `experiments` + `experiment_assignments`.
8. **Les insights agrégés vivent dans `insights_rituals_daily`** (table à créer) — alimentée par le CRON existant.
