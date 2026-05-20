# Data model et admin settings

## Strategie data recommandee

Phase 1: reutiliser le systeme existant de composants administrables.

Cle proposee:

```text
global-promo-slide-header
```

Cette approche evite une nouvelle table prematuree et garde la gestion dans l'ecosysteme admin deja connu.

Principe non negociable:

- l'interface admin est la source de verite pour l'activation, le scope `/kit`, le message, les tags, le CTA, le theme, la densite, le mouvement et le comportement de fermeture;
- aucune variable d'environnement ne doit controler ces reglages produit;
- le deploiement ne doit pas etre necessaire pour changer une promotion;
- la reduction reste system-driven depuis les prix du kit, pas admin-editable manuellement.

## Champs admin

### Visibilite

- `enabled`: boolean, defaut `false` en staging au premier deploiement.
- `routesInclude`: liste de patterns, defaut strict `["/kit"]`.
- `routesExclude`: liste de patterns, defaut `["/checkout", "/admin", "/api"]`.
- `startsAt`: datetime optionnel.
- `endsAt`: datetime optionnel.
- `priority`: nombre, utile si plusieurs annonces existent plus tard.

### Contenu

- `messageTemplate`: texte court avec variables `{dateShort}`, `{date}`, `{city}`, `{region}`, `{country}`.
- `fallbackMessageTemplate`: texte sans ville obligatoire.
- `ctaLabel`: texte court.
- `ctaHref`: URL interne uniquement en phase 1.
- `ariaLabel`: libelle accessible optionnel.
- `tagsEnabled`: boolean.
- `tagOrder`: ordre des tags de reassurance.

### Tags system-driven

Catalogue de tags public:

- `discount`: label dynamique `-{savingsPct}%`, icone `BadgePercent`, affiche seulement si `computePromo()` detecte une promo kit active.
- `free_shipping`: `Livraison gratuite`, icone `Truck`.
- `cod`: `Paiement a la livraison`, icone `HandCoins`.
- `inspect_before_pay`: `Verifiez avant de payer`, icone `ShieldCheck`.
- `morocco_delivery`: `Partout au Maroc`, icone `MapPinned`.

L'admin peut choisir l'ordre et l'activation des tags de reassurance, mais ne peut pas saisir manuellement le pourcentage de reduction.

### Style

- `theme`: enum `ink`, `sage`, `cream`.
- `density`: enum `compact`, `comfortable`.
- `motion`: enum `slide`, `fade`, `none`.
- `accentMode`: enum `line`, `pill`, `none`.
- `position`: enum `top`.

### Comportement

- `dismissible`: boolean.
- `dismissMode`: enum `session`, `day`, `none`.
- `showOnMobile`: boolean.
- `showOnDesktop`: boolean.
- `respectReducedMotion`: boolean, toujours force a `true` cote composant.

### Analytics

- `trackingEnabled`: boolean.
- `campaignKey`: slug stable, par exemple `geo_promo_may_2026`.

## Valeurs par defaut

```json
{
  "enabled": false,
  "routesInclude": ["/kit"],
  "routesExclude": ["/checkout", "/admin", "/api"],
  "messageTemplate": "Offre du {dateShort} - {city}",
  "fallbackMessageTemplate": "Offre du {dateShort} - Maroc",
  "ctaLabel": "Commander",
  "ctaHref": "/kit#commander-femiglow",
  "tagsEnabled": true,
  "tagOrder": ["discount", "free_shipping", "cod", "inspect_before_pay", "morocco_delivery"],
  "theme": "ink",
  "density": "compact",
  "motion": "slide",
  "accentMode": "line",
  "dismissible": true,
  "dismissMode": "session",
  "showOnMobile": true,
  "showOnDesktop": true,
  "trackingEnabled": true,
  "campaignKey": "geo_promo_default"
}
```

## Validation admin

L'admin doit bloquer:

- CTA externe en phase 1.
- `ctaHref` hors `/kit` ou ancre de `/kit`.
- Message vide si `enabled=true`.
- `ctaLabel` trop long, limite recommandee 14 caracteres.
- `ctaHref` ne commencant pas par `/`.
- Template contenant une variable non supportee.
- Theme inconnu.
- Tag reduction manuel: interdit.

L'admin doit avertir, sans bloquer:

- Message superieur a 38 caracteres.
- Absence de fallback.
- Activation hors `/kit`.

## Preview admin

La preview doit proposer:

- desktop;
- mobile 375 px;
- mode sans ville;
- mode ville longue;
- tags actifs/inactifs;
- reduction active/inactive;
- reduced motion;
- theme `ink`, `sage`, `cream`.

## Migration eventuelle phase 2

Si les besoins depassent le composant simple, creer une table dediee:

```text
promo_banners
- id
- key
- enabled
- content_json
- style_json
- targeting_json
- schedule_start_at
- schedule_end_at
- created_at
- updated_at
```

Cette migration ne doit pas etre faite en phase 1 sauf si le Components CMS existant ne permet pas les validations ou la preview requises.
