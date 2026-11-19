# 05 — Textes

Clés dans `apps/web/src/lib/checkout/i18n/locales/{fr,ar,en}.ts`, bloc `addressV2`.

| Clé | Français | Arabe | Anglais |
|---|---|---|---|
| `ackTitle(prénom)` | C’est noté, Salma. | وصلتنا معلوماتكِ، سلمى. | Got it, Salma. |
| `ackTitleNoName` | C’est noté. | وصلتنا معلوماتكِ. | Got it. |
| `ackBody(numéro)` | Nous vous appelons au 06 26 62 88 30 pour confirmer votre commande. | سنتصل بكِ على الرقم 06 26 62 88 30 لتأكيد طلبكِ. | We will call you on 06 26 62 88 30 to confirm your order. |
| `ackCompact(numéro)` | Noté · on vous appelle au 06 26 62 88 30 | وصلتنا معلوماتكِ · سنتصل بكِ على 06 26 62 88 30 | Noted · we will call you on 06 26 62 88 30 |
| `subtitleAck` | Avec votre ville, l’appel de confirmation est plus rapide. Vous payez à la réception. | بمدينتكِ يصبح اتصال التأكيد أسرع. تدفعين عند الاستلام. | With your city, the confirmation call is quicker. You pay on delivery. |

## Choix de mots

| Choix | Raison |
|---|---|
| « C'est noté », pas « commande confirmée » | La commande n'existe qu'après le bouton grenat |
| « pour confirmer votre commande » | Dit que l'appel a un but, et qu'il reste une étape |
| « Nous vous appelons », au présent | Plus direct qu'un futur ; aucun délai promis |
| Arabe : « وصلتنا معلوماتكِ » (« vos informations nous sont parvenues ») | Même prudence qu'en français : ne dit pas que la commande est enregistrée |
| Féminin en arabe | Cohérent avec le reste du formulaire |

## À faire relire

L'arabe n'a pas été relu par une personne native. Les trois phrases à valider sont `ackTitle`, `ackBody` et `subtitleAck`. Si la page arabe sert surtout des publicités en darija, envisager une version darija de `ackBody`.

## Textes voisins, inchangés

| Endroit | Texte |
|---|---|
| Étape 1, sous-titre | Deux informations seulement — nous vous rappelons pour confirmer. |
| Étape 1, case | Je veux être rappelée pour confirmer ma commande. |
| Remerciement | Commande reçue, on vous rappelle. |
