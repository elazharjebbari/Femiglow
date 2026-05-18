# Plan de tests Vitest, MSW et Playwright

## Vitest backend

Fichier cible:

- `apps/web/src/lib/promo-slide-header/geo.test.ts`
- `apps/web/src/lib/promo-slide-header/template.test.ts`
- `apps/web/src/app/api/promo/location/route.test.ts` si les routes API sont deja testees ainsi dans le repo.

Cas a couvrir:

1. Lit `cf-ipcity=Casablanca` et `cf-ipcountry=MA`.
2. Rejette une ville vide.
3. Rejette une ville trop longue.
4. Nettoie caracteres de controle.
5. Utilise region si ville absente.
6. Utilise fallback Maroc si geo absente.
7. Formate la date en `Africa/Casablanca`.
8. Rend le template avec `{date}` et `{city}`.
9. Utilise fallback si `{city}` absent.
10. Refuse variable inconnue sans crash.
11. Renvoie disabled si `enabled=false` dans la config admin.
12. Calcule `discountPct` depuis `priceCents/promoPriceCents` via `computePromo()`.
13. N'affiche pas le tag reduction si la promo kit est inactive.

Commande cible:

```bash
pnpm vitest run apps/web/src/lib/promo-slide-header apps/web/src/app/api/promo/location
```

Adapter le chemin a la convention exacte du repo.

## Vitest frontend

Fichier cible:

- `apps/web/src/components/promo/GeoPromoSlideHeader.test.tsx`

Cas a couvrir:

1. Rend le message API.
2. N'affiche rien si `enabled=false`.
3. N'affiche rien sur erreur reseau.
4. CTA pointe vers `/kit#commander-femiglow`.
5. N'affiche rien hors `/kit`.
6. Rend les tags avec icones attendues.
7. Le tag reduction est present seulement si `discountPct` existe.
8. Le bouton fermer masque le bandeau.
9. Le dismissal session evite le re-render.
10. Reduced motion supprime la classe d'animation.
11. Texte long de ville reste dans le conteneur sans transformer le message en phrase longue.

## MSW

Utiliser le serveur MSW existant du repo, probablement:

```ts
import { http, HttpResponse, server } from '@/test/msw/server';
```

Handlers:

```ts
server.use(
  http.get('/api/promo/location', () =>
    HttpResponse.json({
      enabled: true,
      dateLabel: '18 mai 2026',
      cityLabel: 'Casablanca',
      message: 'Offre du 18 mai - Casablanca',
      tags: [
        { key: 'discount', label: '-25%', icon: 'BadgePercent' },
        { key: 'free_shipping', label: 'Livraison gratuite', icon: 'Truck' },
        { key: 'cod', label: 'Paiement a la livraison', icon: 'HandCoins' },
        { key: 'inspect_before_pay', label: 'Verifiez avant de payer', icon: 'ShieldCheck' },
        { key: 'morocco_delivery', label: 'Partout au Maroc', icon: 'MapPinned' }
      ],
      discountPct: 25,
      ctaLabel: 'Commander',
      ctaHref: '/kit#commander-femiglow',
      theme: 'ink',
      dismissMode: 'session'
    })
  )
);
```

Variantes MSW:

- success city;
- fallback Morocco;
- disabled;
- 500;
- response lente.

## Playwright

Fichier cible:

- `apps/web/e2e/geo-promo-slide-header.spec.ts` ou chemin e2e existant.

Scenarios:

1. Homepage hors `/kit`: le bandeau ne s'affiche pas.
2. `/kit` desktop: le bandeau apparait au-dessus du header.
3. Mobile 375 px sur `/kit`: pas d'overflow horizontal.
4. Le CTA `Commander` scrolle vers `#commander-femiglow`.
5. La fermeture persiste apres reload selon `sessionStorage`.
6. Le bandeau ne s'affiche pas sur checkout.
7. Les tags livraison gratuite, paiement a la livraison, verification avant paiement, Maroc et reduction sont visibles si actifs.
8. Le header principal reste utilisable.
9. Le cart button reste visible.
10. Le chat ne masque pas le bandeau de maniere incoherente.
11. Reduced motion via emulation.
12. Ville longue: aucun chevauchement.

Commande cible:

```bash
pnpm exec playwright test e2e/geo-promo-slide-header.spec.ts --project=chromium --workers=1
```

## Tests visuels

Captures recommandees:

- desktop 1440x900;
- tablet 768x1024;
- mobile 375x812;
- mobile avec ville longue;
- reduced motion.

Verifier manuellement:

- lisibilite;
- contraste;
- alignement;
- aucun texte coupe;
- aucune interaction masquee.

## Non-regression

Avant validation:

```bash
pnpm typecheck
pnpm build
```

Si le repo contient des suites ciblees pour Components CMS ou layout marketing, les ajouter au run final.
