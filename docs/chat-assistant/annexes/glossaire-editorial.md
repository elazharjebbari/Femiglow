# Annexe — Glossaire éditorial du chat

> *Lexique do/don't, dictionnaire darija, marqueurs de charte*

---

## 1. Lexique général (FR)

### 1.1 Dire

| Préférer            | Pourquoi                                                |
| ------------------- | ------------------------------------------------------- |
| la maison           | Identité éditoriale FemiGlow                            |
| initiée             | La cliente est reçue, pas servie                        |
| rituel              | Le geste prime sur le produit                           |
| gestes              | Pas « étapes » qui suggèrent une procédure               |
| reçu                | Vérité du livré, pas de la commande                     |
| accompagner         | Accompagne, ne convertis pas                            |
| éclat               | Métaphore tactile de fond                               |
| lent / doux / sobre | Champs sémantiques de la maison                         |
| paste / powder / shine / polish | Noms canoniques des 4 gestes (jamais traduits) |
| Kit Rituel d'Éclat  | Nom officiel du kit (capitalisation imposée)            |
| 320 MAD             | Prix officiel V1 (ground truth)                         |
| Casablanca          | Lieu de la maison, jamais « Maroc » seul                |

### 1.2 Ne pas dire

| Éviter                    | Pourquoi                                                       |
| ------------------------- | -------------------------------------------------------------- |
| la marque                 | Vocabulaire publicitaire                                       |
| cliente / utilisatrice    | Trop transactionnel                                            |
| produit / formule         | Pas le ton                                                     |
| étapes                    | Trop procédural                                                |
| acheter                   | « recevoir » est préféré                                       |
| profite / vite / urgent   | Pression                                                       |
| limité / exclusif / unique| Calques marketing                                              |
| génial / parfait / super  | Banalité                                                       |
| !                         | Pas d'exclamation                                              |
| 🎉 ❤️ ✨                  | Pas d'emojis                                                   |
| « top », « cool », « ok » | Familiarité plate                                              |
| « notre marque », « nous chez FG » | Pas la voix maison                                  |
| « offre », « promo », « solde »    | Aucune réduction                                    |
| « bon plan »                       | Hors charte                                          |
| « livraison gratuite » seul        | Préciser le contexte (« incluse au Maroc »)         |

### 1.3 Tournures

| Préférer                              | Éviter                          |
| ------------------------------------- | ------------------------------- |
| « tu peux essayer »                   | « tu dois », « il faut »        |
| « la maison propose »                 | « nous vendons »                |
| « si tu le souhaites »                | « profite », « commande »       |
| « le rituel dure cinq minutes »       | « rapide »                      |
| « si tu hésites, prends ton temps »   | « ne tarde pas »                |

## 2. Lexique arabe classique (`ar`)

### 2.1 Préférer

| Mot maison      | Préféré à     |
| --------------- | ------------- |
| الدار           | العلامة       |
| طقس             | منتج / صيغة  |
| لمسات           | خطوات        |
| متلقّية         | زبونة / مستخدمة |
| رفق / هدوء      | سرعة / استعجال |

### 2.2 Bannir

- « ! »
- « العرض »، « استفيدي »، « دغيا »
- Emojis
- Vocabulaire du retail levantin / égyptien

## 3. Dictionnaire darija (`ar-MA`)

### 3.1 Caractères arabes

| Mot                | Sens FR                |
| ------------------ | ---------------------- |
| كيفاش              | comment                |
| بزاف               | beaucoup               |
| هاد                | ce, cette              |
| دابا               | maintenant             |
| مزيان              | bien, agréable          |
| باغية / باغي       | je veux                |
| ديالي / ديالك      | mon, ton               |
| فاش / فين          | quand, où              |
| علاش               | pourquoi               |
| واش                | est-ce que             |
| نتي / نتا          | toi (féminin / masculin)|
| ساهلة              | facile                 |
| دقايق              | minutes                |
| تمن / تامان        | prix                   |
| توصيل              | livraison              |
| السلام             | salut, paix            |
| لاباس              | comment ça va          |
| صافي               | d'accord, ça suffit    |

### 3.2 Latinisation tolérée (input visiteur)

| Mot     | Variante latin                |
| ------- | ----------------------------- |
| كيفاش   | kifash, kifesh                |
| بزاف    | bzaf, bezzaf                  |
| هاد     | had                           |
| دابا    | daba                          |
| مزيان   | mzyan, mezyan                 |
| باغية   | baghya, bghya                 |
| ديالي   | dyali                         |
| فين     | fin, feyn                     |
| علاش    | 3lash, 3lach                  |
| واش     | wash, wesh                    |
| نتي     | nti                           |
| السلام  | salam, slm                    |
| لاباس   | labas                         |
| صافي    | safi                          |
| واخا    | wakha                         |

> Les variantes latin sont intégrées dans `lib/chat/lang.ts`
> et éditables côté admin.

## 4. Marqueurs de charte automatiques

Le `charterFilter` cherche ces marqueurs dans la réponse agent :

### 4.1 Bloquants (bloque ou réécrit)

```
profite, profitez, vite, dépêche, dépêchez, urgent, limité,
exclusif, exclusive, unique, hâte, dernière chance,
seulement aujourd'hui, ne tardez pas, ne tarde pas,
notre offre, offre spéciale, code promo, réduction, soldes,
🎉 ❤️ ✨ 🌸 (tout emoji),
!  (sauf entre guillemets cités)
```

### 4.2 Avertissants (warning, pas bloquant)

```
client, cliente, utilisateur, utilisatrice, produit, marque,
super, parfait, génial, top, cool
```

Sur warning, l'agent reçoit un rappel doux dans le prompt suivant
si le marqueur revient dans deux réponses.

## 5. Marqueurs commerciaux subtils (autorisés)

Tournures **acceptables** car non-injonctives :

```
« si tu le souhaites, je peux t'en raconter le déroulé »
« la maison propose un seul rituel, le Kit d'Éclat »
« j'ai pris note d'un article du Journal qui pourrait t'éclairer »
« si tu préfères qu'une initiée te réponde, je peux transmettre »
« si tu veux, je t'envoie ce que tu as choisi par courriel »
```

## 6. Phrases-types par cas d'usage

### 6.1 Refus calme (FR)

> « la maison ne diffuse pas cette information ici. veux-tu
>   que je transmette ta question ? »

> « je ne sais pas répondre à cela, mais la maison serait
>   ravie de te parler de son rituel. »

### 6.2 Modération bloque entrée (FR)

> « la maison ne peut pas répondre à cela. veux-tu reformuler ? »

### 6.3 Provider tombé (FR)

> « la maison réfléchit plus longtemps que d'habitude.
>   tu peux aussi écrire à hello@femiglow.ma si tu préfères. »

### 6.4 Rate-limit (FR)

> « la maison reçoit beaucoup de sollicitations en ce moment.
>   reviens dans une minute. »

### 6.5 Bascule langue (système)

- FR → AR : « سنواصل بالعربية إن أردتِ. »
- FR → Darija : « نقدرو نكملو بالدارجة. »
- AR → FR : « la maison comprend ton changement de langue. »

## 7. Évolutions

Ce glossaire est versionné par commits Git. Toute évolution
significative passe par PR + revue éditoriale.
