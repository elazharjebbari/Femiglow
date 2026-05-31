# 12 — Évolutivité et maintenabilité

Points d'extension prévus, dette technique anticipée, paths d'évolution Phase 2 et au-delà. Ce document est la carte des chemins futurs — il sert de garde-fou pour ne pas fermer prématurément des portes pendant l'implémentation initiale.

## 1. Vue d'ensemble

Le composant « Rituels partagés » est conçu pour évoluer dans **trois directions** :

1. **Élargir le périmètre éditorial** (multi-produits, multilangue, formats nouveaux).
2. **Approfondir l'expérience** (cartographie typo, page dédiée SEO, réponses publiques de la maison).
3. **Élargir les sources de témoignages** (vidéos, ambassadrices, intégrations CRM).

Pour chaque direction, on identifie ce que **l'architecture actuelle permet déjà**, ce qui **demande une extension légère**, et ce qui **demande un chantier dédié**.

## 2. Extensions immédiates (acquises par design)

### 2.1 Ajouter un nouveau tag rituel

**Effort** : 5 min.

1. Ajouter le slug dans `app_config.ritual_tags_catalog` (table existante).
2. Ajouter le libellé dans `12-microcopy-voix.md § 13`.
3. Régénérer les types Zod si une nouvelle valeur est en `enum` strict.

L'UI le rend automatiquement (la liste est itérée depuis la config).

### 2.2 Ajouter un nouveau filtre chip dans le drawer

**Effort** : 1 h.

Le composant `RitualsWallFilters` accepte un tableau de configurations. Ajouter un objet :

```ts
{ key: 'recent', label: 'Récents', query: { sort: 'recent' } }
```

Le hook `useRitualsList` reçoit `query` et passe en query param.

### 2.3 Mettre en avant un autre produit

**Effort** : 0 — c'est l'architecture.

`product_key` est partout (BDD, API, composants). Pour activer le wall sur un nouveau produit :

1. Insérer témoignages avec `product_key = 'nouveau-produit'`.
2. Insérer le composant `RitualsModuleSuspense` dans la page du nouveau produit.

Aucune modification de schéma.

### 2.4 Changer le SLA modération

**Effort** : 5 min.

Modifier les constantes dans `lib/rituals/sla.ts` :

```ts
export const MODERATION_SLA_WARNING_HOURS = 36;
export const MODERATION_SLA_BREACH_HOURS = 48;
```

Et mettre à jour le microcopy dans `12-microcopy-voix.md`.

## 3. Extensions légères (Phase 2)

### 3.1 Multilangue (ar)

**Acquis** : champ `language` dans `ritual_testimonials`, `bodyAr`-compatible structure dans config admin (`app_config` accepte n'importe quel `locale`).

**À faire** :

- Wrapper `next-intl` ou équivalent dans les composants (changement structurel commun à tout le site).
- Étendre `app_config.ritual_tags_catalog` avec `labelAr` pour chaque tag.
- Étendre microcopy avec namespace `ar` (cf. `12-microcopy-voix.md`).
- Direction RTL côté drawer (`dir="rtl"` sur container quand `lang === 'ar'`).
- Test E2E mobile RTL Safari.

**Charge estimée** : 5 j (dont 2 j RTL CSS).

### 3.2 Page dédiée `/rituels-partages`

**Acquis** : API publique réutilisable, queries Drizzle déjà optimisées, design tokens stables.

**À faire** :

- Créer route `app/(marketing)/rituels-partages/page.tsx`.
- Layout 2 colonnes (sidebar filtres + grid cartes).
- Filtres étendus (sort recommended / recent / helpful, tags multi-select, signal, période).
- SEO : sitemap, JSON-LD `ItemList`, OG image dédiée.
- Module compact `/kit` reste, mais le lien `Lire les N` peut basculer vers cette page au lieu d'ouvrir le drawer.

**Charge estimée** : 5 j.

### 3.3 Cartographie typographique des tags (du prototype B)

**Acquis** : tags fréquence calculée dans `ritual_aggregate.top_tags`.

**À faire** :

- Composant `RitualsTagCloud.tsx` (CSS Grid + named areas modulés par fréquence).
- Variante de la page `/rituels-partages` qui remplace le hero par la cartographie.

**Charge estimée** : 3 j.

### 3.4 Réponse maison à un témoignage

**À ajouter** :

- Table `ritual_replies` avec FK `testimonial_id`, `actor_id`, `body`, `published_at`.
- Composant admin `RitualReplyComposer.tsx`.
- Composant public `RitualReplyBlock.tsx` (réponse rendue sous la carte témoignage).
- Microcopy : « Une réponse de Souheila » + « Avec soin, la maison ».

**Charge estimée** : 3 j.

### 3.5 Featured rotation automatique (algorithme)

Au lieu de cocher manuellement `featured`, un score combiné :

```
score = 0.4 * recency_decay + 0.2 * has_photo + 0.2 * signal_oui + 0.2 * tag_diversity
```

Job CRON quotidien qui calcule le top 3.

**Charge estimée** : 1 j.

## 4. Extensions chantier (Phase 3 ou au-delà)

### 4.1 Témoignages vidéo

**Demande** :

- Étendre `ritual_testimonial_photos` → renommer en `ritual_testimonial_media`, ajouter `kind ENUM('image', 'video')`.
- Pipeline FFmpeg pour transcodage WebM + MP4.
- Compression et bornage durée (max 30 sec).
- Vision ML faces detection sur vidéos (échantillonnage frames).
- Storage volumétrique (Vercel Blob ou S3 dédié).
- Lecteur vidéo `<video>` lazy load, muet par défaut.

**Charge estimée** : 8-12 j.

**Risques** : modération vidéo plus complexe, coût stockage, autorisations audio.

### 4.2 Programme d'ambassadrices

**Demande** :

- Ajouter `is_ambassador BOOL` sur `customers` (ou table dédiée).
- Champ `ambassador_since DATE`.
- Badge sur cartes témoignages.
- Page « ambassadrices » avec stats.
- Workflow admin de nomination.

**Charge estimée** : 5 j.

### 4.3 Intégration CRM externe

**Demande** : push automatique vers HubSpot, Brevo, ou autre.

- Webhook sortant à chaque `ritual_approved`.
- Mapping configurable des champs.
- Retry exponentiel sur échec.
- UI admin pour configurer destinations.

**Charge estimée** : 4 j.

### 4.4 Reviews via API publique externe

**Demande** : agréger des avis Trustpilot / Avis Vérifiés en plus des témoignages internes.

**Compatibilité** : difficile, voire incompatible avec la voix « maison » (Trustpilot affiche des étoiles, des dates, un branding tiers). À éviter sauf demande spécifique B2B.

### 4.5 Notation 1-5 étoiles (réintroduite)

Si la marque décide un jour d'introduire les étoiles (rupture éditoriale majeure) :

- Ajouter `rating INT CHECK (rating BETWEEN 1 AND 5)` sur `ritual_testimonials`.
- Étendre `RitualTestimonialSubmit` Zod.
- Composant `RatingStars` à créer (icônes SVG conformes charte — éviter étoiles génériques).
- Calcul `avg_rating` dans `ritual_aggregate`.

**Charge estimée** : 2 j.

**Risque éditorial** : à valider avant.

## 5. Dette technique anticipée

| Dette | Sévérité | Mitigation prévue |
| --- | --- | --- |
| `localStorage` non chiffré pour brouillon | Faible | Pas de PII dedans ; brouillon expire 7 j |
| Vision ML CPU sur Vercel Function (limite 5 sec) | Moyenne | Fallback `MANUAL_REVIEW` automatique ; passer à GPU si volume > 100/jour |
| Pagination cursor `{publishedAt, id}` casse si tri changé | Moyenne | Encoder le sort dans le cursor ou réinitialiser sur changement |
| Pas d'i18n côté `microcopy` actuellement | Moyenne | Refactor via clés `t('ritual.wall.title')` quand multilangue arrive |
| Featured manuel (limite 3) | Faible | Algorithme automatique en Phase 2 (cf. 3.5) |
| `RitualsWallDrawer` est monolithique (~500 lignes) | Faible | Splitter en sous-composants si dépasse 700 lignes |
| Tests Playwright dépendent d'une test DB live | Faible | Acceptable au lancement ; passer à containerisation si CI lente |
| Pas de modération multilangue (admin FR only) | Moyenne | Accepter ar/fr en lecture, modération admin reste en FR Phase 2 |
| Pas de retry visible côté wizard si réseau coupé en cours | Faible | Brouillon localStorage couvre ce cas |
| Pas de re-modération automatique après correction substantielle | Faible | Demandée manuellement par modératrice (action explicit) |

## 6. Stratégie de versioning du schéma

### 6.1 Migrations additives uniquement

Aucune migration ne **supprime** une colonne ou un type. Si une donnée doit être abandonnée :

1. Ajouter une colonne `deprecated_*` ou un commentaire.
2. Arrêter d'écrire dedans (mais continuer à lire si nécessaire).
3. Migration de nettoyage après 6 mois en prod stable.

### 6.2 Versionning des schémas Zod

Si le schéma `RitualTestimonialSubmit` évolue de manière incompatible :

```ts
export const RitualTestimonialSubmitV1 = z.object({ ... });
export const RitualTestimonialSubmitV2 = z.object({ ... });
export const RitualTestimonialSubmit = RitualTestimonialSubmitV2; // alias courant
```

L'API accepte les deux pendant 3 mois en parallèle. Au-delà, V1 retourne 410 Gone.

### 6.3 Schémas e-mail templates

Stockés dans `app_config` avec `version`. Restauration possible depuis `app_config_snapshots`.

## 7. Stratégie de migration UI

### 7.1 Drawer → Page dédiée (prototype A → C)

Si Phase 2 décide de migrer du drawer à la page dédiée :

1. Créer la page `/rituels-partages` avec mêmes endpoints API.
2. Le lien `Lire les N rituels →` bascule de `?wall=open` à `<Link href="/rituels-partages">`.
3. Garder le drawer en mode déprécié pendant 4 semaines pour A/B tester.
4. Retirer le drawer après comparaison.

**Charge** : 5 j.

### 7.2 Étendre le module compact au-delà de 3 cards

Le composant accepte un prop `limit`. Modification 1 ligne.

### 7.3 Carrousel mobile (au lieu de stack vertical)

Composant `RitualsModuleCarousel.tsx` à créer comme alternative. Variante choisie via prop `mobileVariant`.

**Charge** : 2 j.

## 8. Points de vigilance pour conserver la maintenabilité

### 8.1 Ne pas accumuler les variants

Limiter `RitualCard` à 2 variants (`compact`, `default`). Si un 3ᵉ contexte apparaît, créer un composant frère plutôt que d'étendre.

### 8.2 Ne pas mélanger fetch et présentation

Convention `*Bound` vs pur. Toujours respectée. Un composant qui fetch ne reçoit pas de props data, et inversement.

### 8.3 Garder les services testables sans BDD

`lib/rituals/sanitize-body.ts`, `auto-flags.ts`, etc. **doivent rester sans dépendance DB**. Seul `moderation.ts` orchestre les queries.

### 8.4 Pas de logique métier dans les routes API

Pattern « parse → délègue → renvoie ». Aucune exception.

### 8.5 Documenter les décisions non-évidentes

Tout choix qui n'est pas immédiatement compréhensible (ex. limite 3 featured, SLA 48 h, signal ternaire vs 5★) est consigné dans `02-contraintes-femiglow.md` ou ici.

## 9. Roadmap envisagée (12 mois)

```
M+1 ──── J1 J2 J3 (lancement v1)
                                              [Lancement modéré]
                                                    │
M+2 ─────────────── Mesure observationnelle ────────┤
                                                    │
M+3 ──────── Affinements microcopy + tags ──────────┤
                                                    │
M+4 ──── Featured automatique (3.5) ────────────────┤
                                                    │
M+6 ─── Page dédiée /rituels-partages (3.2) ────────┤
                                                    │
M+8 ──── Multilangue ar (3.1) ──────────────────────┤
                                                    │
M+10 ──── Réponse maison (3.4) ─────────────────────┤
                                                    │
M+12 ──── A/B test contrôlé page vs drawer ─────────┤
                                                    │
M+18 ──── Vidéo testimonials (4.1) ─────────────────┤  (si volume > 100/mois)
```

## 10. Mécanismes de bascule (feature flags)

Le projet dispose déjà de `experiments` (table Drizzle). Pour le wall, on peut configurer :

| Flag | Effet | Usage |
| --- | --- | --- |
| `rituals_module_visible` | Affiche le module compact sur `/kit` | A/B test |
| `rituals_drawer_or_page` | Bascule entre drawer et page dédiée | Migration Phase 2 |
| `rituals_featured_auto` | Active l'algorithme automatique | Phase 2 |
| `rituals_vision_ml_strict` | Active la détection visage côté wizard (block au lieu de modal) | Test ergonomie |
| `rituals_email_j45_enabled` | Active l'envoi de l'e-mail J+45 | Activer après seed test |

## 11. Synthèse — règles d'or évolutivité

1. **Migrations additives uniquement.**
2. **Schémas Zod versionnés** quand incompatible.
3. **Convention `*Bound` vs pur** non-négociable.
4. **Aucune logique métier dans `route.ts`.**
5. **Services testables sans BDD.**
6. **Pas de variants composants au-delà de 2** sans création d'un composant frère.
7. **Tout choix non-évident est documenté** dans le dossier.
8. **Feature flags pour les changements visibles** (A/B prévu).
9. **Roadmap glissante** réévaluée tous les 3 mois.
10. **Toute extension passe par un mini-runbook** (template à dupliquer depuis `00-runbook.md`).
