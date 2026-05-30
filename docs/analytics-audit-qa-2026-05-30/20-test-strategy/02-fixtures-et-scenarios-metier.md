# 20.02 — Fixtures déterministes & scénarios métier

## 1. Fixtures (jeux de données réalistes)

Toutes les fixtures sont **déterministes** (faker seedé) et **datées relativement à un ancrage**
(`ANCHOR = 2026-05-20T12:00:00Z`), pour rester stables quelle que soit la date d'exécution.

### 1.1 Helpers de base (`src/test/fixtures/analytics/`)

```ts
export const ANCHOR = new Date('2026-05-20T12:00:00.000Z');
export function ev(name: string, o: Partial<EventInput>): TrackingEventLogEntry { /* … */ }
export function session(id: string, steps: StepSpec[]): TrackingEventLogEntry[] { /* … */ }
export function seedEvents(events: TrackingEventLogEntry[]): void { /* memoryStore */ }
export function seedComponents(c: Partial<TrackingComponent>[]): void { /* memoryStore */ }
export function resetMemoryStore(): void { /* vide trackingEventsLog + components */ }
// Builders de réponses API pour MSW :
export function funnelData(over?: DeepPartial<FunnelOverviewData>): FunnelOverviewData { /* … */ }
export function ctaData(over?: Partial<{clicks:number;revenueMad:number}>): CtaData { /* … */ }
export function checkoutData(over?: …): CheckoutData { /* … */ }
export function insightsOverview(over?: …): OverviewResponse { /* … */ }
```

> **Convention consentement** : chaque event de fixture porte `consent_snapshot.analytics_storage =
> 'granted'` par défaut ; un helper `withoutConsent()` permet de tester l'exclusion (consent gate).

### 1.2 Personae réalistes (sessions types)

| Persona | Parcours | Sert à tester |
|---|---|---|
| **Acheteuse mobile complète** | page_view /kit → scroll_50 → cta_click(purchase) → begin_checkout → add_shipping → add_payment → purchase(199 MAD) | Funnel complet, CTA revenu, Checkout TTS |
| **Abandonneuse** | view_cart → begin_checkout → add_shipping → (rien) | Checkout abandons, champs abandonnés |
| **Hésitante multi-session** | J-3 : cta_click ; J : purchase (autre session, même anonymous_id) | Attribution fallback 7 j (CTA) |
| **Bot** | begin_checkout → purchase en 0,4 s | Filtre bot TTS (<1 s exclu) |
| **Sans consentement** | parcours complet mais `analytics_storage='denied'` | Consent gate (exclusion totale) |
| **Desktop tablette** | parcours sur device ≠ mobile | Filtre device (anti-AF-05) |
| **Trafic Meta** | `traffic_source='meta'` | Filtre source |

## 2. Scénarios métier (end-to-end, point de vue opérateur)

Chaque scénario est un **récit** transformé en test Playwright, avec préconditions de données,
gestes, et assertions « métier ».

### SM-01 — « La fondatrice analyse sa semaine »
1. Connexion admin → `/admin/analytics/funnel`.
2. Sélectionne **7 jours** et **Tous les devices** (corrige le défaut mobile).
3. Lit le funnel : 5 étapes, drop-off le plus fort identifié.
4. Bascule sur **CTA** : le revenu attribué est en **MAD** et plausible (pas ÷100).
5. Bascule sur **Checkout** : time-to-submit médian lisible, top erreurs cohérent.
6. **Attendu** : à chaque changement de filtre/onglet, les **chiffres changent** et restent
   **cohérents entre onglets** (Purchase Funnel réconciliable avec Checkout — cf. AF-03).

### SM-02 — « Comparer mobile vs desktop »
1. Sur CTA, period=30d, device=**mobile** → note le taux de conversion.
2. Bascule device=**desktop** → le taux **change** (données différentes).
3. **Attendu** : AF-01 corrigé (les KPI bougent) ; un indicateur « Mobile uniquement » était
   visible à l'étape 1 (AF-05).

### SM-03 — « Diagnostiquer un CTA qui sous-performe »
1. CTA, repère une ligne avec beaucoup d'impressions et peu de clics (CTR faible).
2. Une ligne **clics=0 / achats>0** est présente : un **tooltip explique** le fallback 7 j (F-CTA-03).
3. Un composant **supprimé** apparaît avec le badge **isDeleted** (historique préservé).

### SM-04 — « Pourquoi les gens abandonnent le checkout »
1. Checkout, period=7d : stepper montre le décrochage à `add_payment`.
2. Top champs abandonnés = `phone` en tête ; top erreurs = `phone/invalid_format`.
3. Histogramme TTS : la majorité soumet en 100–200 s ; P95 raisonnable ; bots exclus.

### SM-05 — « Insights : rafraîchir et exporter »
1. Insights, clique **Rafraîchir** → statut `running` → `success`, `refreshedAt` mis à jour.
2. Un **2e clic concurrent** est **ignoré proprement** (lock, pas d'erreur — F-INS-06).
3. Drill-down sur une page → **drawer** avec events/components ; **Échap** ferme.
4. **Export CSV** d'une vue → fichier téléchargé, colonnes correctes ; **Export PNG** non vide.
5. État **firstRun** (matview vide) : message « lancez un premier refresh », pas EmptyState (F-INS-03).

### SM-06 — « Période personnalisée et persistance »
1. Sélectionne **Personnalisé** du 01 au 15 mai → données filtrées.
2. Recharge la page → filtres **persistés** (URL + localStorage).
3. Saisit une plage invalide (from>to) → **message d'erreur**, pas un fallback silencieux (F-FLT-01).

### SM-07 — « Robustesse : API en panne »
1. L'API renvoie **500** → l'onglet affiche **ErrorState** + bouton **Réessayer** (pas un écran blanc).
2. Aucune donnée sur la période → **EmptyState** clair (≠ erreur).

### SM-08 — « Fuseau horaire Maroc »
1. Un achat à **00 h 30 heure Maroc** (23 h 30 UTC la veille).
2. Avec period=**Aujourd'hui**, l'achat est compté **aujourd'hui** (après correctif AF-04), pas hier.

> Ces scénarios sont la **spécification vivante** du comportement attendu. Ils sont déclinés en cas
> de test précis dans chaque `20-test-strategy/<système>/cas-de-tests.csv`.
