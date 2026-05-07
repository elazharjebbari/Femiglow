# 03 · Events, Funnel & Audit robustesse

> Catalogue d'events catégorisé en TOF/MOF/BOF, modèle d'attribution de conversion, et **audit complet de robustesse** des events existants — avec un focus sur la plainte utilisateur : *« les events vidéo se déclenchent seuls »*.

## 1. Catalogue d'events — état actuel & extensions

### 1.1 Catalogue existant (40 events)

Source : `apps/web/src/lib/tracking/event-catalog.ts`. Classification résumée :

| Catégorie | Events | Note |
|---|---|---|
| **Page & Engagement** | `page_view`, `scroll_depth`, `click`, `select_content`, `share`, `search`, `video_start`, `video_progress`, `video_complete`, `file_download` | Universel |
| **Forms** | `form_start`, `form_submit` | À enrichir (cf. §5) |
| **E-commerce GA4** | `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `refund`, `view_promotion`, `select_promotion` | Aligné GA4 |
| **Lead** | `generate_lead`, `sign_up`, `login`, `contact_submit`, `newsletter_submit` | Conversions secondaires |
| **Custom FG** | `fg_journal_read_75`, `fg_journal_read_100`, `fg_section_view`, `fg_faq_view`, `fg_composition_open`, `video_transcript_open` | Engagement marque |
| **Admin** | `fg_pixel_test`, `fg_admin_action`, `fg_consent_change` | Audit interne |

### 1.2 Events à ajouter en phase 1

> Pour combler les trous identifiés par les onglets demandés.

| Event | Catégorie | Pourquoi (lien onglet) |
|---|---|---|
| `video_user_play` | engagement | Distinction autoplay (passif) vs play utilisateur (actif) — fix audit (§4) |
| `video_autoplay_view` | engagement | Lecture autoplay-on-visible *non comptabilisée comme engagement* (§4) |
| `form_field_focus` | forms | Onglet Checkout (e) : où l'utilisateur s'arrête |
| `form_field_blur` | forms | Calcul du temps par champ |
| `form_validation_error` | forms | Mesure des frictions |
| `form_abandon` | forms | Émis sur `pagehide` si form_start sans form_submit |
| `cta_impression` | engagement | Pour calculer un CTR par CTA (clics / impressions) sur l'onglet CTA (d) |
| `mini_cart_open` | ecommerce | Discrimine la consultation panier (icône) du `view_cart` (page) |
| `mini_cart_close` | ecommerce | Symétrique, calcule un dwell time |

### 1.3 Convention de nommage

| Règle | Exemple |
|---|---|
| Snake_case + verbe au présent | `add_to_cart`, `form_submit`, `video_user_play` |
| Préfixe `fg_` réservé aux events spécifiques marque | `fg_section_view`, `fg_journal_read_75` |
| Préfixe `cta_` réservé aux events de CTA tracking transverse | `cta_impression`, `cta_click` (futur) |
| Pas d'event > 40 caractères, pas d'accents, pas d'espaces | — |
| Tout event doit avoir un schema Zod dans `event-catalog.ts` | — |

## 2. Mapping TOF / MOF / BOF / Conversion

### 2.1 Définitions (alignées sur la voix marque)

> La marque FemiGlow est **contemplative** : on n'utilise **pas** le vocabulaire vente directe ("attirer", "convertir") en interne mais on garde les concepts pour l'analyse.

| Stage | Définition opérationnelle | Question à laquelle il répond |
|---|---|---|
| **TOF** *(Top of Funnel)* | Découverte. L'utilisateur arrive et explore. | « Combien de personnes découvrent FemiGlow aujourd'hui ? » |
| **MOF** *(Middle of Funnel)* | Considération. L'utilisateur lit, compare, comprend. | « Combien comprennent vraiment le produit (composition, FAQ) ? » |
| **BOF** *(Bottom of Funnel)* | Décision. L'utilisateur agit (panier, checkout). | « Combien sont sur le point d'acheter ? » |
| **Conversion** | Le but est atteint. | « Combien achètent ? Combien deviennent leads ? » |

### 2.2 Mapping détaillé (justification événement par événement)

| Event | Stage | Justification |
|---|---|---|
| `page_view` | TOF | Arrivée. Première trace. |
| `fg_section_view` | TOF | Vu une section, n'a pas encore "engagé" cognitivement. |
| `scroll_depth` | TOF | Continuation passive de la lecture. |
| `video_user_play` | TOF | Geste actif → légèrement engagé, mais reste TOF (pas encore d'intent achat). |
| `view_item` | MOF | Page produit = comparaison, considération. |
| `fg_composition_open` | MOF | Approfondissement actif (qui est dans la composition ?) — fort signal MOF. |
| `fg_journal_read_75` | MOF | Lecture longue → considération du brand storytelling. |
| `select_item` | MOF | Choix dans une liste produits. |
| `fg_faq_view` | MOF | Levée de friction, signal d'objection en cours de levée. |
| `add_to_cart` | BOF | Geste d'intention d'achat. |
| `view_cart` | BOF | Re-vérification du panier avant checkout. |
| `begin_checkout` | BOF | Entre en formulaire. |
| `add_shipping_info` | BOF | Étape 2 du formulaire. |
| `add_payment_info` | BOF | Étape 3 du formulaire. |
| `purchase` | **Conversion** | But primaire. |
| `generate_lead` | **Conversion** | But secondaire (lead/newsletter). |

> **Pourquoi `video_user_play` reste TOF et pas MOF** : la vidéo `4 gestes` est de la pédagogie de marque, vue par tous types d'arrivants. La distinction MOF se fait par l'intent de **comparer/comprendre le produit lui-même** (composition, FAQ, page produit).

### 2.3 Édition admin

L'admin pourra ajuster le mapping depuis `/admin/tracking/events` (extension du CRUD existant) — un dropdown `funnel_stage: tof|mof|bof|conversion|null`. Le préset ci-dessus est seedé en migration `0051`.

### 2.4 Détection automatique d'orphelins

Script `scripts/check-funnel-mapping.ts` (à créer) — exécuté en CI :

```ts
// Liste tous les emit() du code et vérifie qu'ils sont catalogués + funnel_stage non null
// (sauf pour events admin/internal). Échoue si un event "user-facing" n'a pas de stage.
```

## 3. Modèle d'attribution

### 3.1 Choix V1 : Last non-direct click

> **Pourquoi ce choix** : c'est le standard GA4 par défaut, le plus interprétable, et le plus facile à expliquer à un non-tech.

> **Comment** : pour chaque session ayant abouti à une conversion, on remonte la chaîne d'events de la **session courante** ; si la première traffic_source n'est pas `direct`, on l'attribue ; sinon on regarde les sessions précédentes du même `anonymous_id` dans une fenêtre de 30 jours, on trouve la dernière non-direct.

```sql
-- Simplifié (la query réelle utilise window functions)
WITH conv AS (
  SELECT session_id, anonymous_id, received_at
  FROM tracking_events_log
  WHERE event_name = 'purchase'
)
SELECT
  c.session_id,
  COALESCE(
    -- 1. première source non-direct de la session courante
    (SELECT traffic_source FROM tracking_events_log
       WHERE session_id = c.session_id AND traffic_source IS NOT NULL AND traffic_source <> 'direct'
       ORDER BY received_at ASC LIMIT 1),
    -- 2. fallback : dernière source non-direct dans les 30 j
    (SELECT traffic_source FROM tracking_events_log
       WHERE anonymous_id = c.anonymous_id AND traffic_source IS NOT NULL AND traffic_source <> 'direct'
         AND received_at < c.received_at AND received_at >= c.received_at - interval '30 days'
       ORDER BY received_at DESC LIMIT 1),
    'direct'
  ) AS attributed_source
FROM conv c;
```

### 3.2 Modèles ajoutés en V2 (pour info)

- **First-click** : pour analyser ce qui amène initialement.
- **Linear** : poids égal sur tous les touchpoints.
- **Position-based** (40-20-40) : reconnaît premier + dernier.
- **Markov chain** : optimal mais complexe.

L'API `/api/admin/analytics/overview?attribution=last_non_direct` est paramétrée dès V1 → V2 = ajouter des cases.

## 4. AUDIT robustesse — fix « events qui se déclenchent seuls »

> Ce que rapporte l'utilisateur : *« je remarque souvent que des événements se déclenchent seuls (par exemple ceux liés aux vidéos…) »*. C'est une plainte sérieuse parce qu'**un dashboard analytics n'a aucune valeur s'il s'appuie sur des events qui mentent**.

### 4.1 Diagnostic — composants vidéo

L'audit (cf. report Explore) confirme que `VideoPlayer4Gestes.tsx` a déjà des guards `startFired.current` / `completeFired.current`. **Mais la cause racine est ailleurs** :

```tsx
useEffect(() => {
  const obs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) el.play();   // ← AUTOPLAY au scroll
    else el.pause();
  }, { threshold: 0.5 });
  obs.observe(el);
}, [reduced]);
```

**Le problème logique** : quand la vidéo entre dans le viewport, **`el.play()` est appelé par le code**, ce qui déclenche `onPlay` → `emit('video_start')`. Du point de vue de l'utilisateur, *il n'a rien fait* — la vidéo "se déclenche seule". Il a raison : ce n'est pas un bug de code, c'est un **bug de sémantique d'event**.

### 4.2 Fix — distinguer autoplay passif vs lecture utilisateur

#### Règle nouvelle

| Trigger | Event émis | Funnel |
|---|---|---|
| Autoplay-on-scroll, vidéo muted | `video_autoplay_view` (nouveau) | **non comptabilisé** comme engagement |
| Click utilisateur sur play | `video_user_play` (nouveau) | TOF (engagement réel) |
| `onEnded` après autoplay | `video_complete` *(autoplay)* | non comptabilisé |
| `onEnded` après play utilisateur | `video_complete` *(user)* | TOF |
| Click sur transcript | `video_transcript_open` | MOF (recherche d'info accessible) |

Implementation côté composant :

```tsx
// Nouveau pattern — VideoPlayer4Gestes.tsx (extrait pseudo-code)
const userInitiatedRef = useRef(false);

const handlePlay = () => {
  if (userInitiatedRef.current) {
    if (!startFired.current) {
      emit('video_user_play', { video_title, video_duration });
      startFired.current = true;
    }
  } else {
    if (!autoplayViewFired.current) {
      emit('video_autoplay_view', { video_title, video_duration });
      autoplayViewFired.current = true;
    }
  }
};

const handleClick = () => {
  userInitiatedRef.current = true;
  // navigateur déclenche play()
};
```

Et la dépréciation : on garde `video_start` dans le catalogue comme alias **deprecated** (still emit pour ne rien casser sur GA4 historique) mais le **stage funnel n'est plus accordé qu'à `video_user_play`**.

### 4.3 Audit transverse — règles d'idempotence

> **Toutes** les sources d'events du codebase doivent respecter les 5 règles ci-dessous. Un script `scripts/check-event-emit-patterns.ts` est ajouté en CI pour vérifier (lint custom).

#### Règle 1 — Guard `*Fired` sur tout event "milestone"

Tout event qui ne doit se déclencher **qu'une fois par mount/session** doit avoir un `useRef(false)` qui le bloque après la première émission.

```tsx
// ❌ BAD
useEffect(() => { emit('view_item', ...); }, []);

// ✅ GOOD
const fired = useRef(false);
useEffect(() => {
  if (fired.current) return;
  fired.current = true;
  emit('view_item', ...);
}, []);
```

#### Règle 2 — IntersectionObserver : `unobserve` après premier hit pour les events "section_view"

```tsx
// ❌ BAD — re-fire au resize, à chaque scroll qui re-fait croiser le seuil
const obs = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) emit('fg_section_view', ...);
});

// ✅ GOOD — un seul hit, puis on désabonne
const obs = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    emit('fg_section_view', ...);
    obs.unobserve(entry.target);     // ← clé
  }
});
```

#### Règle 3 — Debounce sur les events "continus"

Scroll, mouseover, focus → debounce ≥ 300 ms avant émission.

```tsx
// ✅ GOOD — scroll_depth émis aux paliers 25/50/75/90 seulement
const lastDepth = useRef(0);
const onScroll = useThrottle(() => {
  const d = computeDepth();
  for (const milestone of [25, 50, 75, 90]) {
    if (d >= milestone && lastDepth.current < milestone) {
      emit('scroll_depth', { percent_scrolled: milestone });
      lastDepth.current = milestone;
    }
  }
}, 250);
```

#### Règle 4 — `useEffect` sans dépendances : interdit d'émettre directement

```tsx
// ❌ BAD — re-fire si re-mount StrictMode, par ex.
useEffect(() => { emit('purchase', ...); }, []);

// ✅ GOOD — clé d'idempotence côté event
useEffect(() => {
  emit('purchase', { ..., transaction_id }, { idempotencyKey: transaction_id });
}, [transaction_id]);
```

> Le `TrackingClient` accepte déjà un `options.idempotencyKey` ; le serveur dédupe sur `event_id` qui combine `event_name + idempotencyKey + sessionId` (cf. `client.ts`).

#### Règle 5 — Forms : émission différée au `pagehide`/`visibilitychange`

```tsx
// Pattern pour form_abandon
useEffect(() => {
  const onHide = () => {
    if (formStarted && !formSubmitted) {
      emit('form_abandon', { form_id, fields_filled, time_spent_ms });
    }
  };
  document.addEventListener('visibilitychange', onHide);
  return () => document.removeEventListener('visibilitychange', onHide);
}, [formStarted, formSubmitted]);
```

### 4.4 Audit ciblé — composants à revoir

> Liste des composants à auditer en phase 1, avec la règle qu'ils doivent respecter.

| Composant | Risque actuel | Règle à appliquer |
|---|---|---|
| `VideoPlayer4Gestes.tsx` | Autoplay = `video_start` faux positifs | §4.2 (distinction events) |
| Tout autre `<video>` natif | Idem | §4.2 |
| `ScrollDepthTracker` (si existe) | Re-fire au resize | §4.3 Règle 2 + 3 |
| `IntersectionObserver` dans `fg_section_view` | Re-fire | §4.3 Règle 2 |
| `MerciClient.tsx` (purchase) | Re-fire si user refresh la page de remerciement | §4.3 Règle 4 + idempotencyKey = transaction_id |
| `AddToCartButton.tsx` | OK (clic = action utilisateur, pas de re-fire issu) | — |
| `ViewItemTracker.tsx` | OK (déjà guard `fired.current`) | — |
| Tous les forms (Newsletter, Contact, Checkout) | Pas d'event `form_start` aujourd'hui | §4.3 Règle 5 + ajouter form_field_focus/blur (§1.2) |

### 4.5 Lint custom

Le script `scripts/check-event-emit-patterns.ts` :

```ts
// Pseudo-code — parse l'AST des fichiers .tsx, recherche les patterns suspects :
// 1. emit() dans un useEffect([]) sans guard ref
// 2. IntersectionObserver sans unobserve()
// 3. emit() sur scroll/mouseover sans throttle/debounce
// 4. emit('purchase' | 'generate_lead') sans idempotencyKey
//
// Output : warnings + erreurs catégorisés. CI-blocking si erreur critique.
```

Mode opératoire : warning par défaut en V1, erreur bloquante en V1.5 (le temps que le code soit nettoyé).

## 5. Forms — instrumentation détaillée

### 5.1 Events form

| Event | Trigger | Params |
|---|---|---|
| `form_start` | Premier `focus` sur n'importe quel champ du formulaire | `form_id`, `route` |
| `form_field_focus` | `focus` sur un champ | `form_id`, `field_id`, `field_label` |
| `form_field_blur` | `blur` sur un champ rempli | `form_id`, `field_id`, `dwell_ms`, `was_filled` |
| `form_validation_error` | Échec validation client/server | `form_id`, `field_id`, `error_code` |
| `form_submit` | Submit avec succès | `form_id`, `time_to_submit_ms` |
| `form_abandon` | `pagehide` si form_start && !form_submit | `form_id`, `last_field`, `fields_filled`, `time_spent_ms` |

### 5.2 Wrapper utilitaire

Source : `lib/tracking/form-instrumentation.ts` (nouveau).

```ts
// Hook React qui wrap n'importe quel formulaire et émet les events ci-dessus
export function useFormTracking(formId: string) {
  // ... code qui :
  // 1. attache un listener focus/blur global au DOM du form
  // 2. émet form_start au premier focus
  // 3. émet form_abandon au pagehide si non submit
  // 4. expose handleSubmit() et handleError() pour wrapping
}

// Usage :
function CheckoutInfoStep() {
  const { handleSubmit, handleError, formProps } = useFormTracking('checkout_info');
  return <form {...formProps} onSubmit={handleSubmit(...)}>...</form>;
}
```

> Cela centralise la logique → impossible d'oublier un event sur un nouveau form.

## 6. Sources d'events que l'admin verra

> Référence pour l'onglet (b) Live qui affiche un flux d'events bruts.

```ts
// lib/analytics/event-categories.ts — pour le filtre du flux Live
export const EVENT_CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  page:        { label: 'Page',        color: 'sauge'     },  // bg-sauge-soft text-sauge-dark
  engagement:  { label: 'Engagement',  color: 'ciel'      },
  ecommerce:   { label: 'E-commerce',  color: 'champagne' },
  forms:       { label: 'Formulaires', color: 'petale'    },
  lead:        { label: 'Lead',        color: 'champagne' },
  custom:      { label: 'Custom',      color: 'sauge'     },
  admin:       { label: 'Admin',       color: 'encre/30'  },
};
```

## 7. Pourquoi cette structure résiste à l'épreuve du temps

| Pression future | Réponse |
|---|---|
| « Ajouter un nouveau type d'event » | Ajouter dans `event-catalog.ts`, déclarer le `funnel_stage`. Pas de migration. |
| « Ajouter une étape au funnel » | Ajouter une valeur à l'enum `funnel_stage` (ex. `awareness`). Pas de breaking. |
| « Ajouter une plateforme tracking (Pinterest pixel) » | Existe déjà via `tracking_providers`. |
| « Restreindre les events si consent denied » | Déjà filtré dans les matviews. |
| « Comprendre pourquoi l'event X "ment" » | Le pipeline de checks (§4.5) catche le pattern suspect en CI. |

---

**Suivant** → [`04-ui-design.md`](04-ui-design.md) : tokens admin, primitives partagées (Tabs, KpiCard, FilterBar, ChartFrame), pattern de loading.
