# 07 — Backend et tracking

## 1. Bilan

La refonte ne demande **aucune migration** pour fonctionner. Le contrat `PATCH /api/checkout/lead/[leadId]/address` reste identique.

| Sujet | Changement |
|---|---|
| Routes de commande | Aucun |
| Calcul des frais | Aucun : le serveur reste seul à décider |
| Schéma de la base | Aucun pour la V2 |
| Tracking | Nouveaux événements déclarés |
| Récupération des leads | Nouvelle vue et, en option, sauvegarde de la ville |

## 2. Règles conservées

- Le serveur calcule les frais : `resolveShippingCents` et `shipping-fee.ts`.
- Une ville hors catalogue paie `DEFAULT_DELIVERY_PRICE_MAD`, soit 45 MAD.
- `addressLine1` reste facultatif côté serveur, car le mode panier en dépend.
- Idempotence via `Idempotency-Key`.
- Le prix affiché vient du même calcul que le serveur, avec `shippingCentsFromPrice`.

**Contrôle à ajouter :** un test doit vérifier que le total de la barre égale le total de la commande créée, pour chaque cas de frais.

## 3. Tracking

### Pourquoi il passe en premier

Sans ces événements, on ne saura ni pourquoi les gens partent, ni où la V2 gagne ou perd.

### Déclaration obligatoire

`/api/track` **rejette** tout événement sans validateur (`tracking.ingest.unknown_event`). Chaque événement doit donc être ajouté dans `lib/tracking/schemas.ts`, puis au plan de tracking actif.

Ce rejet touche déjà des événements du site : `chat_widget_mount`, `geo_promo_header_impression`, `pack_section_view`, `pack_social_proof_view`, `pack_economy_view`, entre autres. Ce n'est pas lié à cette étape, mais ces données sont perdues aujourd'hui.

### Événements

| Événement | Moment | Paramètres | Question posée |
|---|---|---|---|
| `address_step_view` | Affichage de l'étape 2 | `step2_variant`, `kit_angle`, `viewport_h` | Combien la voient ? |
| `address_city_focus` | Premier focus ville | `step2_variant` | Commencent-elles ? |
| `address_city_selected` | Ville connue | `city_slug`, `matched`, `delivery_price_mad`, `eta` | Quel prix voient-elles ? |
| `address_line_focus` | Premier focus adresse | `step2_variant` | Continuent-elles après les frais ? |
| `address_validation_error` | Erreur affichée | `field`, `code` | Qu'est-ce qui bloque ? |
| `address_cta_tap_incomplete` | Tap avant validité | `missing_field` | Le bouton trompe-t-il ? |
| `address_cta_visible` | CTA réellement à l'écran | `step2_variant`, `ms_since_view` | La cliente le voit-elle ? |
| `address_step_abandon` | `pagehide` à l'étape 2 | `phase`, `ms_on_step`, `has_city` | À quel moment part-elle ? |
| `address_note_opened` | Ouverture de la note | `step2_variant` | Le champ sert-il ? |

Ajouter `step2_variant` à `address_completed`, `add_payment_info` et `purchase`.

**Confidentialité :** ne jamais envoyer le texte de l'adresse, le prénom ni le téléphone dans ces événements.

### Limite

Ces événements dépendent de `fg_consent` côté client. Le total réel se vérifie toujours avec `chat_lead` et `orders`, qui ne dépendent pas du consentement au tracking.

## 4. Assignation A/B

| Élément | Choix |
|---|---|
| Identifiant | `fg_aid`, déjà utilisé pour l'A/B du panneau |
| Fonction | `assignVariant` |
| Clé | `kit-step2-v2` |
| Répartition | 50/50 |
| Lieu | Résolu côté serveur, passé par props, pour éviter tout clignotement |
| Coupe-circuit | Champ CMS ou variable `CHECKOUT_STEP2_V2=off` |
| Recette | `?step2=v2` et `?step2=control` |

`variantKey` sert déjà au test panneau ou scroll : ne pas le réutiliser.

## 5. Récupération des leads sans commande

### Constat

71 lignes `chat_lead` sans commande sur 30 jours, 69 sur 7 jours. Le prénom et le téléphone sont conservés, et la case cochée indique : « Je veux être rappelée pour confirmer ma commande. »

### Proposition

| Étape | Détail |
|---|---|
| 1 | **Vérification juridique** : le consentement couvre-t-il ce rappel, selon la loi marocaine 09-08 et les mentions affichées ? |
| 2 | Filtre « sans commande » dans `/admin/chat/leads`, ou vue dédiée |
| 3 | Appel ou WhatsApp sous 1 heure, une seule tentative |
| 4 | Mesure : taux de joignabilité, de commande, de plainte |

Cette action ne dépend pas de la refonte et peut démarrer après l'étape 1.

### Option : sauvegarder la ville

Aujourd'hui, rien n'est enregistré avant le clic final. Enregistrer la ville dès son choix aiderait le rappel. Le `PATCH` existant accepterait une ville seule, mais **il faut d'abord vérifier** qu'il ne change aucun statut ni n'empêche le clic final (idempotence avec la même clé, statut du lead). Recommandation : le traiter à part, après l'A/B.

## 6. Suivi de la qualité

Moins de champs peut produire plus de commandes, mais plus de colis non livrés. Or `orders` ne contient **aucun statut de livraison**.

| Indicateur | Aujourd'hui | Nécessaire |
|---|---|---|
| Commande créée | Disponible | — |
| Commande confirmée au téléphone | Non disponible en base | Saisie ou import |
| Colis livré, refusé, injoignable | Non disponible en base | Export du transporteur |

**Décision à prendre :** identifier où se trouve cette information, et la relier par numéro de commande, même par un fichier hebdomadaire. Sans cela, l'A/B ne juge que les commandes créées.

## 7. Requêtes de suivi

Taux de passage par variante :

```sql
with e as (
  select session_id, event_name, payload->>'step2_variant' as v
  from tracking_events_log
  where received_at between :debut and now()
    and event_name in ('address_step_view', 'address_completed')
)
select v,
  count(distinct session_id) filter (where event_name = 'address_step_view') as vus,
  count(distinct session_id) filter (where event_name = 'address_completed') as termines
from e group by 1;
```

Abandon selon les frais :

```sql
select (payload->>'delivery_price_mad')::int as frais,
  count(distinct s.session_id) as ville_choisie,
  count(distinct c.session_id) as termines
from tracking_events_log s
left join tracking_events_log c
  on c.session_id = s.session_id and c.event_name = 'address_completed'
where s.event_name = 'address_city_selected' and s.received_at >= :debut
group by 1 order by 1;
```

La fenêtre doit toujours avoir une borne haute : quelques lignes de `tracking_events_log` sont datées dans le futur.
