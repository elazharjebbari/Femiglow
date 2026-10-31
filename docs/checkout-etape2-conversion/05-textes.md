# 05 — Textes en français, arabe et anglais

**L'arabe doit être relu par une personne native avant la mise en ligne.** Le ton suit l'existant : arabe standard simple, adressé au féminin. Faire valider aussi le choix entre arabe standard et darija.

## 1. Principes

- Dire ce qui se passe, sans slogan ni exclamation.
- Parler de la cliente et de son kit, pas de « rituel » à cette étape.
- Utiliser des chiffres : « 24h », « 19 MAD ».
- Pas de « 100 % » ni de « garanti ».
- Parler de « réception » plutôt que de « paiement » quand c'est possible.

## 2. Écran

| Clé | Français | Arabe | Anglais |
|---|---|---|---|
| `progress` | `{name}, plus que la livraison` | `{name}، بقي التوصيل فقط` | `{name}, just delivery left` |
| `progressAlmost` | `{name}, c'est presque fini` | `{name}، أوشكتِ على الانتهاء` | `{name}, almost done` |
| `progressNoName` | Plus que la livraison | بقي التوصيل فقط | Just delivery left |
| `title` | Où livrer votre kit ? | أين نوصل طقمكِ؟ | Where should we deliver your kit? |
| `subtitle` | Vous payez à la réception. | تدفعين عند الاستلام. | You pay on delivery. |
| `cityLabel` | Votre ville | مدينتكِ | Your city |
| `cityPlaceholder` | Casablanca, Rabat, Agadir… | الدار البيضاء، الرباط، أكادير… | Casablanca, Rabat, Agadir… |
| `addressLabel` | Quartier, rue et numéro | الحي والشارع والرقم | Area, street and number |
| `addressPlaceholder` | Ex. : Hay Salam, rue 4, n° 12 | مثال: حي السلام، زنقة 4، رقم 12 | E.g. Hay Salam, street 4, no. 12 |
| `addNote` | Ajouter une note pour le livreur | إضافة ملاحظة لعامل التوصيل | Add a note for the courier |
| `notePlaceholder` | Point de repère, créneau préféré… | معلم قريب، الوقت المفضل… | Landmark, preferred time… |
| `addCode` | J'ai un code de fidélité | لدي رمز وفاء | I have a loyalty code |
| `back` | Modifier mes coordonnées | تعديل معلوماتي | Edit my details |

## 3. Livraison et total

| Clé | Français | Arabe | Anglais |
|---|---|---|---|
| `deliveryLine` | Livraison en `{eta}` | التوصيل خلال `{eta}` | Delivery in `{eta}` |
| `deliveryFree` | Offerte | مجاني | Free |
| `deliveryUnknown` | Délai confirmé par téléphone | نؤكد مدة التوصيل عبر الهاتف | Delivery time confirmed by phone |
| `totalLabel` | Total à la réception | المجموع عند الاستلام | Total on delivery |
| `currency` | MAD | درهم | MAD |
| `promoLine` | Code `{code}` : −`{amount}` | الرمز `{code}`: −`{amount}` | Code `{code}`: −`{amount}` |

`deliveryUnknown` concerne les villes hors catalogue. Le serveur leur applique le tarif le plus haut, 45 MAD (`DEFAULT_DELIVERY_PRICE_MAD`) : la ligne affiche donc ce montant à droite, et le total reste exact.

## 4. Bouton

| État | Français | Arabe | Anglais |
|---|---|---|---|
| Ville manquante | Choisir ma ville | اختيار مدينتي | Choose my city |
| Adresse manquante | Ajouter mon adresse | إضافة عنواني | Add my address |
| **Prêt** | **Confirmer ma commande** | **تأكيد طلبي** | **Confirm my order** |
| Envoi | Enregistrement… | جارٍ التسجيل… | Saving… |
| Sous le bouton | Rien à payer maintenant | لا شيء للدفع الآن | Nothing to pay now |

### Pourquoi « Confirmer ma commande »

| Option | Analyse | Verdict |
|---|---|---|
| Confirmer ma commande | Clair, à la première personne (`Copywriting.pdf` p. 23). La cliente sait qu'elle s'engage, ce qui protège contre les refus de colis | **Retenu** |
| Confirmer la commande (actuel) | Clair, mais impersonnel | Remplacé |
| Recevoir mon kit | Séduisant et concret, mais ne dit pas qu'on commande. L'étude Stripe souvent citée est introuvable dans Kolenda | Variante à tester plus tard |
| Je commande | Déjà utilisé pour un autre geste | Écarté |
| Commander maintenant ! | Ton de promotion, exclamation (`Luxury.pdf` p. 7) | Écarté |

## 5. Erreurs

| Clé | Français | Arabe | Anglais |
|---|---|---|---|
| `cityRequired` | Choisissez votre ville pour voir le délai. | اختاري مدينتكِ لمعرفة مدة التوصيل. | Choose your city to see the delivery time. |
| `cityTooLong` | Ce nom de ville est trop long. | اسم المدينة طويل جدًا. | This city name is too long. |
| `addressRequired` | Indiquez votre quartier ou votre rue. | أدخلي الحي أو الشارع. | Enter your area or street. |
| `addressTooLong` | Cette adresse est trop longue. | هذا العنوان طويل جدًا. | This address is too long. |
| `noteTooLong` | Cette note est trop longue. | هذه الملاحظة طويلة جدًا. | This note is too long. |
| `network` | Connexion interrompue. Votre commande est conservée, réessayez. | انقطع الاتصال. طلبكِ محفوظ، حاولي مجددًا. | Connection lost. Your order is saved, please try again. |

**À vérifier :** « votre commande est conservée » n'est exact que si le brouillon est bien repris après l'erreur. Le test E2E du plan doit le confirmer.

Les autres erreurs existent déjà dans `t.errors` : `stockInsufficient`, `priceMismatch`, `rateLimited`.

## 6. Textes à supprimer

| Clé | Raison |
|---|---|
| `shippingTitle`, `shippingFreeBody` | Bloc retiré |
| `cityHintBilingual` | Instruction inutile |
| `shell.timeEstimateAddress`, « 30 s » | Faux : 61 s en médiane |

Les conserver jusqu'à la fin du test A/B, car la version témoin les utilise.

## 7. Textes figés à traduire

| Texte | Fichier |
|---|---|
| Messages de `addressFormSchema` | `AddressStep.tsx` |
| « Un instant… » | `Button.tsx` |
| « Code … appliqué » | `AddressStep.tsx` |
| « J'ai un code de fidélité » | `AddressStep.tsx` |
| Libellés de crédit et d'économie | `WizardShell.tsx` |
| « Paiement », « Commander » éventuels dans `StickyCartCTA` | À contrôler |
