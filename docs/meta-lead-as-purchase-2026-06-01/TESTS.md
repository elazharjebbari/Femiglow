# Batterie de tests — Lead → Meta Purchase sans doublon

Objectif : prouver (1) que les leads chat + panier comptent comme Purchase Meta,
(2) qu'un vrai purchase qui suit ne crée JAMAIS de doublon, (3) que GA4 reste propre,
(4) que tout est paramétrable et réversible (flag).

## Unitaires — mapping (event-mapping.test.ts)
- `getEventMapping('lead_purchase_proxy').meta.name === 'Purchase'`.
- `getEventMapping('lead_purchase_proxy').google_ga4.name === 'generate_lead'` (GA4 propre).
- `generate_lead.meta` reste `'Lead'` (Contact/Newsletter non impactés).
- Flag OFF → `lead_purchase_proxy` non mappé Meta (ou non émis) → comportement legacy.

## Unitaires — event_id de parcours (event-id.test.ts)
- `deriveMetaPurchaseProxyId({visitorId:'v1'})` identique pour 2 appels dans la fenêtre.
- `lead_purchase_proxy` et `purchase` du MÊME visiteur (même fenêtre) → **même event_id**.
- Visiteurs différents → event_id différents.
- Hors fenêtre → event_id différent (laisse le ledger gérer la suppression).
- `eventName` n'entre PAS dans la clé (sinon pas de dédup croisée).

## Unitaires — ledger de suppression (dedup.test.ts)
- 1er `lead_purchase_proxy` visiteur v1 → marque le ledger, autorisé.
- `purchase` suivant v1 dans la fenêtre → **suppressed** (reason `purchase_suppressed_dedup`).
- `purchase` v2 (aucun lead préalable) → **counted** (fire normal).
- Après expiration TTL → `purchase` v1 → counted (nouvelle fenêtre).
- Idempotent : rejouer le même proxy ne double pas.

## Intégration — dispatcher serveur (dispatcher.attribution / dispatcher.test)
- Lead chat v1 → Meta dispatched en `Purchase` (mappedName), event_id parcours, note `lead_as_purchase`.
- Puis purchase v1 (même visiteur) → Meta **skipped** note `purchase_suppressed_dedup`; GA4/Ads **dispatched**.
- Purchase v3 sans lead → Meta dispatched `Purchase` normal.
- Flag OFF → lead → Meta `Lead` (legacy), purchase → Meta `Purchase` (legacy), aucun skip.

## Intégration — émission client (LeadFormBubble.test / CheckoutFlow.test)
- Soumission lead chat → un push dataLayer `lead_purchase_proxy` avec value/currency + event_id parcours.
- Wizard étape 1 (panier abandonné) → idem.
- Contact/Newsletter → `generate_lead` SANS `lead_purchase_proxy` (pas de pont Meta Purchase).

## Export GTM (exporter.test.ts)
- `lead_purchase_proxy` → tag Meta `Purchase` câblé, event_id = `{{DLV - event_id}}` de parcours.
- Le tag Meta `purchase` porte une condition/blocking qui l'empêche de fire si un
  proxy a déjà compté (ou s'appuie sur l'event_id partagé pour la dédup native Meta).
- GA4 `purchase` inchangé (revenu réel).

## E2E / runtime (Playwright + GTM Preview) — scénarios anti-doublon
1. **Lead chat seul** : soumettre le form chat → GTM Preview montre 1 Meta `Purchase`
   (value=prix kit), GA4 `generate_lead`. Aucune commande réelle.
2. **Lead chat puis achat** (même visiteur, < fenêtre) : Meta = **1 seul** `Purchase`
   (dédupé par event_id parcours + ledger), GA4 = `generate_lead` + `purchase` (2 events distincts).
3. **Panier abandonné → relance → achat** : Meta = 1 Purchase, pas 2.
4. **Achat direct sans lead** : Meta = 1 `Purchase` normal.
5. **Flag OFF** : retour au comportement actuel (lead=Lead, purchase=Purchase), zéro régression.

## Vérification chiffrée (recette métier)
Sur 1 journée de trafic de staging, comparer dans Meta Events Manager :
- `Purchase` count == (#leads chat éligibles + #leads panier) + (#achats SANS lead préalable).
- 0 doublon : aucun visiteur n'a 2 `Purchase` dans la fenêtre.
Requête d'audit DB (`tracking_events_log`) : `GROUP BY visitor, day` → max 1 Purchase Meta compté.

## Non-régression
- Suite tracking complète verte (`pnpm test -- src/lib/tracking`).
- `getAttributionMode` : `lead_purchase_proxy` côté Meta = broadcast (doit fire tous canaux,
  cohérent avec C3 purchase broadcast) — à confirmer selon la stratégie.
