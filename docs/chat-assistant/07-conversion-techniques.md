# 07 — Techniques de conversion

> *Psychologie commerciale, déclencheurs, scénarios, garde-fous anti-forcing*

---

## 1. Posture

L'assistant **n'est pas un commercial**. Il est l'hôtesse de la
maison, qui informe, oriente, propose un geste — jamais une
transaction. Sa réussite commerciale est mesurée *a posteriori*,
pas anticipée par le visiteur.

Trois lignes rouges :

| Ligne rouge                                          | Pourquoi                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Pas de CTA explicite dans la bulle agent             | Trahit la posture maison, fait sortir du registre                        |
| Pas de relance plus de 1 fois si le visiteur ignore  | « Collant » immédiatement perçu, dégrade la confiance                    |
| Pas de pression temporelle ou de promotion           | Va contre la charte FemiGlow (« absence comme signature »)               |

Tout ce qui suit s'applique **dans le respect de ces lignes**.

## 2. Cartographie des intentions visiteurs

Détectées heuristiquement (mots-clés + score) ou par classifieur
fine-tuné en Phase 2. La détection vit dans
`lib/chat/intent.ts` et expose :

```ts
type Intent =
  | 'discover'             // exploration
  | 'product_question'     // question sur le kit / rituel
  | 'price_question'
  | 'shipping_question'
  | 'usage_question'
  | 'comparison'
  | 'objection_skeptic'
  | 'objection_pricing'
  | 'objection_safety'
  | 'commitment_check'     // « j'hésite »
  | 'cart_help'            // visiteur dans /panier
  | 'checkout_help'        // visiteur dans /commander
  | 'post_purchase'
  | 'off_topic';
```

Chaque intention a :

- une **réponse type** (RAG-augmentée),
- des **micro-gestes commerciaux** autorisés,
- une **réponse anti-stale** (si l'agent se répète, varier).

## 3. Micro-gestes commerciaux

Ce sont des **propositions discrètes**, jamais des CTAs. Toujours
formulées en question, jamais en injonction.

| Geste                          | Formulation type                                                                | Quand                                |
| ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------ |
| Inviter à lire un article      | « j'ai pris note d'un article du Journal qui pourrait t'éclairer. »             | Question explorative                 |
| Proposer le rituel             | « si tu veux, je peux t'en raconter le déroulé. »                               | Question sur le kit                  |
| Suggérer un échantillon (V2)   | « la maison propose à ses initiées un essai. veux-tu que je t'en parle ? »      | Hésitation forte                     |
| Proposer le contact maison     | « si tu préfères qu'une initiée te réponde, je peux te transmettre ta question. » | Question complexe / hors charte      |
| Sauvegarder le panier          | « si tu veux, je t'envoie ce que tu as choisi par courriel pour reprendre plus tard. » | Hésitation panier                    |
| Reformuler l'offre maison      | « la maison propose un seul rituel, le Kit d'Éclat. tu peux le commander en livraison Maroc. » | Confusion sur la maison               |

Chaque geste est **plafonné à 1 par session** (sauf reformulation).

## 4. Déclencheurs comportementaux

Détectés côté client et envoyés en `context` au prochain message,
ou par event datalayer interne pour adapter le prompt :

| Déclencheur                                                  | Réaction agent                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Visiteur sur `/kit` ≥ 60 s sans avoir scrollé ≥ 50 %         | Salutation s'adapte : « tu peux me poser n'importe quelle question sur le kit. »   |
| Visiteur sur `/panier` avec articles                         | Salutation : « besoin d'un éclairage avant de finaliser ? »                         |
| Visiteur revient en `/panier` après abandon (J+1)            | Salutation : « heureuse de te revoir. ton panier est gardé, veux-tu le finaliser ?» |
| Visiteur tape « cher » / « prix » / « combien »              | RAG renforce les chunks « valeur perçue » + « COD inclus » + « livraison »         |
| Visiteur tape « ne marche pas » / « déçue »                  | Bascule vers ton réparateur, propose contact maison                                |
| Visiteur écrit en darija                                     | Bascule darija, ton plus chaleureux                                                |
| Visiteur reste 30 s sans répondre après une question agent   | Bulle système discrète : « prends ton temps. je suis là. »                         |

## 5. Schémas de réponse par intention

### 5.1 `product_question`

Trame :

```
1. Reconnaissance courte de la question.
2. Réponse factuelle ancrée RAG (cite le chunk si pertinent).
3. Invitation à creuser (jamais à acheter).
```

Exemple FR :

> « tu veux savoir comment se compose le rituel ? il s'agit de
>   quatre gestes — paste, powder, shine, polish — qui se suivent
>   en cinq minutes. veux-tu que je te raconte le déroulé d'un
>   geste en particulier ? »

### 5.2 `price_question`

Trame :

```
1. Donner le prix exact (ground truth).
2. Inscrire le prix dans la valeur (composition, durée du rituel,
   nombre d'utilisations).
3. Mentionner la livraison Maroc + COD si pertinent.
```

Pas de remise, pas de comparaison, pas de promesse cachée.

### 5.3 `objection_pricing`

Trame :

```
1. Reconnaître l'objection sans la balayer.
2. Inscrire le rituel dans une économie (« il dure ~3 mois »).
3. Proposer de regarder le Journal pour comprendre la genèse.
```

Exemple FR :

> « le tarif est une vraie question. le kit dure environ trois
>   mois pour une initiée qui pratique chaque semaine. la maison
>   ne fait pas de réduction, parce qu'elle préfère que ce qui
>   est offert le soit en pleine présence. si tu veux comprendre
>   d'où vient le rituel, j'ai un article du Journal qui le raconte. »

### 5.4 `objection_safety`

Trame :

```
1. Reconnaissance de la prudence.
2. Composition rappelée (RAG).
3. Renvoi vers la fiche ingrédients si plus de détails.
```

### 5.5 `cart_help` / `checkout_help`

Trame :

```
1. Comprendre l'obstacle (frais, mode de paiement, livraison).
2. Réponse précise (RAG).
3. Si le tunnel se passe mal techniquement : escalation vers contact maison + log.
```

> Sur `/commander`, le widget peut être configuré pour rester fermé
> par défaut (anti-distraction). L'admin a un toggle.

### 5.6 `off_topic`

Trame :

```
1. Refus calme.
2. Redirection vers ce que la maison sait : rituel, journal, contact.
```

Exemple :

> « je ne sais pas répondre à cela, mais la maison serait ravie
>   de te parler de son rituel. veux-tu que je te le raconte ? »

## 6. Garde-fous anti-forcing

| Garde-fou                                          | Implémentation                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1 micro-geste par session max (par catégorie)      | Compteur en mémoire de session, réinitialisé après 24 h                                       |
| Pas de ré-engagement automatique après silence > 5 min | Le widget passe en `idle`, n'envoie aucune relance                                          |
| Pas de fenêtre intrusive                           | Pas de modal, pas de pop-up, pas de toaster d'invitation à chatter                            |
| Pas d'auto-ouverture                               | Le panel ne s'ouvre que sur clic visiteur, ou sur clic d'une suggestion                       |
| Pas de répétition de l'offre                       | Si le rituel a été mentionné dans la session, l'agent ne le ré-introduit pas spontanément     |
| Pas de chiffres rouges                             | Pas de pastille « 1 », pas d'unread visible en chiffre. Une pastille champagne sans nombre.   |
| Pas de mots interdits                              | Filtre lexical de sortie qui bloque : « offre », « profite », « urgent », « limité », « vite » |

## 7. Mesure de la conversion

### 7.1 Définitions

| Métrique                          | Formule                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Conversion attribuée chat         | `purchase` survenu ≤ 30 j après ≥ 1 message visiteur dans la même session visiteur |
| Lift de conversion                | (conv. cohorte chat / sessions chat) − (conv. cohorte sans chat / sessions sans chat) |
| Conversion influencée             | `purchase` ≤ 30 j *avec* visite landing dans la session ; non engagé chat → ne compte pas |
| Conversion par intention          | Conversion attribuée groupée par intention dominante de la session                 |
| Délai chat → conversion           | médiane entre dernier message session et `purchase`                                |

### 7.2 Cookie d'attribution

Cookie `fg_v` (10 ans, signé) porte le `visitorId`. Au `purchase`,
on regarde la dernière session chat ouverte par ce `visitorId` dans
la fenêtre 30 j ; si trouvée, on écrit `chat_session.converted_order_id`.

### 7.3 Tableau de bord conversion (admin)

Cf. doc 08. Affiche :
- conversions / non-conversions par intention,
- panier moyen chat vs panier site,
- top 10 questions convertissantes,
- distribution du nombre de messages avant conversion,
- canal d'origine (UTM) pour les conversions chat.

## 8. Tests A/B (Phase 2)

Le routeur supporte un override par session :

```jsonc
{
  "experiments": [
    {
      "key": "instruction_v3_warmer",
      "variants": [
        { "id": "control",  "instructionVersionId": "ci_xxx", "weight": 50 },
        { "id": "warmer",   "instructionVersionId": "ci_yyy", "weight": 50 }
      ],
      "primaryMetric": "conversion_rate",
      "minSamples": 800
    }
  ]
}
```

L'attribution de variant se fait à l'ouverture de session (cookie
`visitorId` haché → bucket déterministe). L'analyse est externe
(notebook ou outil A/B existant), le système ne fait que collecter.

## 9. Scénarios commerciaux exemplaires

### 9.1 Initiée curieuse → conversion

```
[14:02] visiteur : « bonjour, c'est quoi ce rituel ? »
[14:02] agent    : description courte + déroulé en 4 gestes + question creuser ?
[14:03] visiteur : « ça dure combien de temps ? »
[14:03] agent    : « 5 minutes par geste, le kit dure ~3 mois. »
[14:04] visiteur : « ok je vais regarder le kit »
[14:08] visiteur ouvre /kit, ajoute au panier, finalise

→ chat_session.converted_order_id renseigné
→ chat_conversation_event { type: 'conversion_attributed' }
```

### 9.2 Hésitation prix → contact maison

```
[18:33] visiteur : « 320 dh c'est cher pour un produit beauté »
[18:33] agent    : reconnaissance + valeur + Journal
[18:34] visiteur : pas de réponse pendant 4 min
                    pas de relance — silence respecté
[18:38] visiteur ferme widget

→ aucune conversion attribuée. KPI engagement, pas conversion.
```

### 9.3 Question hors-charte → redirection

```
visiteur : « tu connais des restos à Casablanca ? »
agent    : refus calme, redirection vers le rituel
```

## 10. Garde-fou éditorial automatique

Avant émission d'une réponse, un **filtre charte** vérifie :

- absence de tout mot interdit (« génial », « parfait », emojis,
  exclamations, mots commerciaux agressifs) ;
- absence de promesse non sourcée (« meilleur produit », « unique »,
  « 100 % naturel » sans source RAG) ;
- présence du registre maison (au moins 1 occurrence sur 5
  réponses pour les marqueurs « rituel / maison / initiée », sinon
  warning interne pour audit qualité, pas de bloque).

Le filtre est implémenté dans `lib/chat/charter-filter.ts`. Il peut :
1. **Réécrire** silencieusement (cas mineurs : ponctuation, emojis) ;
2. **Demander une régénération** au modèle (cas majeurs : forcing) ;
3. **Bloquer** et basculer en réponse de fallback éditoriale.

## 11. Lecture suivante

- [08 — Console admin](08-admin-console.md) pour le tableau de
  bord conversion.
- [annexes/prompts-systeme.md](annexes/prompts-systeme.md) pour
  les prompts qui imposent ces postures.
- [13 — Sécurité, RGPD & modération](13-securite-rgpd-moderation.md)
  pour la modération de sortie.
