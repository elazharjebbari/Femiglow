# Backend, geolocalisation et API

## Route cible

`GET /api/promo/location`

Reponse active:

```json
{
  "enabled": true,
  "dateLabel": "18 mai 2026",
  "cityLabel": "Casablanca",
  "regionLabel": "Casablanca-Settat",
  "countryCode": "MA",
  "message": "Offre du 18 mai - Casablanca",
  "tags": [
    { "key": "free_shipping", "label": "Livraison gratuite", "icon": "Truck" },
    { "key": "cod", "label": "Paiement a la livraison", "icon": "HandCoins" },
    { "key": "inspect_before_pay", "label": "Verifiez avant de payer", "icon": "ShieldCheck" },
    { "key": "morocco_delivery", "label": "Partout au Maroc", "icon": "MapPinned" },
    { "key": "discount", "label": "-25%", "icon": "BadgePercent" }
  ],
  "discountPct": 25,
  "ctaLabel": "Commander",
  "ctaHref": "/kit#commander-femiglow",
  "theme": "ink",
  "dismissMode": "session"
}
```

Reponse fallback:

```json
{
  "enabled": true,
  "dateLabel": "18 mai 2026",
  "cityLabel": null,
  "regionLabel": null,
  "countryCode": "MA",
  "message": "Offre du 18 mai - Maroc",
  "tags": [
    { "key": "free_shipping", "label": "Livraison gratuite", "icon": "Truck" },
    { "key": "cod", "label": "Paiement a la livraison", "icon": "HandCoins" },
    { "key": "inspect_before_pay", "label": "Verifiez avant de payer", "icon": "ShieldCheck" },
    { "key": "morocco_delivery", "label": "Partout au Maroc", "icon": "MapPinned" }
  ],
  "discountPct": null,
  "ctaLabel": "Commander",
  "ctaHref": "/kit#commander-femiglow",
  "theme": "ink",
  "dismissMode": "session"
}
```

Reponse desactivee:

```json
{
  "enabled": false
}
```

## Headers Cloudflare a lire

Selon la configuration Cloudflare `Add visitor location headers`, prevoir la lecture defensive de:

- `cf-ipcountry`
- `cf-ipcity`
- `cf-region`
- `cf-region-code`
- `cf-timezone`
- `cf-iplatitude`
- `cf-iplongitude`

La phase 1 n'a besoin que de ville, region et pays. Latitude/longitude ne doivent pas etre utilisees pour personnaliser finement le message. Le message final doit rester court: jamais une phrase longue type argumentaire.

## Normalisation

Le resolver doit:

- trim toutes les valeurs;
- rejeter les chaines trop longues;
- retirer caracteres de controle et HTML;
- conserver accents et tirets utiles;
- limiter la ville a une longueur raisonnable, par exemple 64 caracteres;
- refuser les valeurs inconnues (`XX`, `T1`, `unknown`, `null`);
- considerer les donnees comme approximatives.

## Priorite de resolution

1. Cloudflare city si pays Maroc ou pays autorise.
2. Cloudflare region si ville absente.
3. Pays `MA` si disponible.
4. Fallback admin `Maroc`.

## Gestion de la date

La date doit etre generee cote serveur pour rester coherente:

- timezone recommandee: `Africa/Casablanca`;
- format FR: `18 mai 2026`;
- format court pour le sticky: `18 mai`;
- pas de date relative type `aujourd'hui` seule;
- le template peut inclure `{date}` et `{dateShort}`.

## Reduction dynamique

Le tag reduction ne doit pas etre saisi a la main dans l'admin. Il doit etre calcule depuis la source de verite du kit:

- produit kit DB via `getKitProductCached()`;
- variante primaire;
- `priceCents` et `promoPriceCents`;
- helper existant `computePromo()` dans `apps/web/src/lib/utils/promo.ts`.

Regle:

- si `computePromo(...).active === true`, afficher `-{savingsPct}%`;
- si la promotion est inactive ou incoherente, ne pas afficher de tag reduction;
- ne jamais afficher un pourcentage arbitraire configure manuellement.

## Templates autorises

Variables:

- `{dateShort}`
- `{date}`
- `{city}`
- `{region}`
- `{country}`

Regles:

- Si `{city}` est absent, utiliser le template fallback.
- Si le template contient une variable inconnue, ne pas planter: logger et utiliser le template par defaut.
- Ne jamais injecter de HTML depuis le template.

## Cache

Headers de la route:

```http
Cache-Control: private, no-store
Vary: CF-IPCity, CF-IPCountry, CF-Region
```

Le `Vary` est defensif mais ne remplace pas `private, no-store`.

## Securite et privacy

La fonctionnalite ne doit pas:

- demander la geolocalisation navigateur;
- stocker l'adresse IP;
- stocker latitude/longitude en analytics;
- exposer les headers bruts au frontend;
- afficher une ville si elle semble invalide.

## Contrat d'erreur

En cas d'erreur backend:

- HTTP 200 avec `{ "enabled": false }` si l'erreur est une config invalide non critique.
- HTTP 500 uniquement pour erreur inattendue.
- Le frontend doit ne rien afficher sur erreur reseau ou 500.
