# Workflow translateur — Guide pour traducteur externe

> Ce document est **lu par le translateur externe**, pas par le dev. Il explique comment recevoir, traduire et renvoyer le contenu FemiGlow.
>
> **Audience** : translateur freelance ou agence missionnée pour traduire FR → AR / EN / autre langue.
>
> **Temps de lecture** : 25 min (à lire **en entier** avant de commencer la première mission).

---

## Sommaire

- [Bienvenue](#bienvenue)
- [Qu'est-ce que FemiGlow](#quest-ce-que-femiglow)
- [Comment vous recevez les fichiers](#comment-vous-recevez-les-fichiers)
- [Format CSV expliqué en détail](#format-csv-expliqué-en-détail)
- [Glossaire à respecter](#glossaire-à-respecter)
- [Ton et style FemiGlow](#ton-et-style-femiglow)
- [Outils recommandés](#outils-recommandés)
- [Comment poser des questions](#comment-poser-des-questions)
- [SLA et délais](#sla-et-délais)
- [Self-QA avant retour](#self-qa-avant-retour)
- [Format de retour attendu](#format-de-retour-attendu)
- [FAQ translateur](#faq-translateur)

---

## Bienvenue

Bonjour et merci d'avoir accepté cette mission de traduction pour **FemiGlow**.

Ce guide vous accompagne pas à pas. Il est dense (450 lignes) mais **lisez-le en entier avant de commencer** — il vous évitera 90% des erreurs courantes et vous fera gagner du temps.

**Avant de démarrer**, vous devez avoir reçu par email :

- [ ] Ce fichier (`workflow-translateur.md`)
- [ ] Un CSV à traduire : `femiglow-i18n-fr-to-{xx}-{date}.csv`
- [ ] Un glossaire : `glossaire-fr-{xx}.csv`
- [ ] Le guide de ton : `tone-style-guide.md`
- [ ] Un email de brief avec délai et contact

Si l'un de ces éléments manque : **ne commencez pas** et demandez à votre contact FemiGlow.

---

## Qu'est-ce que FemiGlow

### En 3 phrases

FemiGlow est une **marque marocaine de soins ongles premium**. Notre proposition : un rituel sobre, posé, méditerranéen, qui prend soin des ongles fragilisés (suite à pose, traitement, ou simplement le quotidien). Notre cible : femmes 30-55 ans, urbaines, francophones (Maroc), arabophones (Maroc), anglophones (export tier-1).

### Ce qui compte pour la voix

- **Sobre** : pas de superlatifs, pas de "révolutionnaire", "incroyable", "magique"
- **Posé** : pas d'urgence factice, pas de "vite, profitez de l'offre limitée"
- **Méditerranéen** : références plantes, soleil, mer, terre — pas d'imagerie hospitalière ou laboratoire
- **Premium accessible** : qualité haut de gamme mais pas snob
- **Honnête** : on dit "fragilisation" pas "destruction", "amélioration progressive" pas "transformation miracle"

### Anti-références (ce qu'on ne veut PAS)

- Pas de marketing "challenger" agressif (style Glossier early-days)
- Pas de pseudo-science (style brands InfluencerLand)
- Pas de body-positivity performative
- Pas de blagues / jeux de mots fragile (registre adulte)

### Références (ce qui inspire le ton)

- L'Occitane (sobriété, méditerranée)
- Aesop (intelligence, restraint)
- Susanne Kaufmann (rigueur, calme)

---

## Comment vous recevez les fichiers

### Canaux de transmission

Selon préférence FemiGlow et translateur :

| Canal | Pour | Avantage |
|---|---|---|
| **Email pièce jointe** | Volumes < 5MB | Simple, traçable |
| **Google Drive partagé** | Volumes plus gros, collaboration | Versionning auto |
| **GitHub (PR review)** | Translateur très technique | Diff visible |

Méthode par défaut : **Google Drive partagé** (lien envoyé par email).

### Fichiers reçus

Vous recevez systématiquement 4 fichiers minimum :

1. **`femiglow-i18n-fr-to-{xx}-{date}.csv`** — le fichier à traduire (~700 lignes en V1)
2. **`glossaire-fr-{xx}.csv`** — termes à respecter (50-100 lignes)
3. **`tone-style-guide.md`** — guide de ton détaillé (lecture obligatoire avant traduction)
4. **`workflow-translateur.md`** — ce fichier (lecture obligatoire)

Parfois fournis en complément :

5. Screenshots du site existant (FR) pour contexte visuel
6. Glossaire des langues déjà traduites (pour cohérence cross-locale)
7. Liste des termes-marque interdits de traduire

### Modes de paiement et facturation

À convenir avec FemiGlow. Mode standard :

- Paiement à la livraison + acceptation (J+5 à J+10 après remise CSV complété)
- Tarif : à négocier (généralement au mot ou au string, taux confidentiel)
- Facture en MAD ou EUR selon préférence

---

## Format CSV expliqué en détail

### Structure du CSV reçu

Le CSV envoyé contient ces colonnes (les noms exacts peuvent varier selon le scope) :

| Colonne | Type | Modifier ? | Description |
|---|---|---|---|
| `key` | string | **NON** | Identifiant technique unique. **NE JAMAIS MODIFIER**. |
| `namespace` | string | **NON** | Groupement (`marketing`, `contact`, `wizard`, etc.) |
| `source_value_fr` | string | **NON** | Le texte FR à traduire. Lecture seule. |
| `current_value_{xx}` | string | **OUI** | **C'est ici que vous traduisez** (où `{xx}` = `ar`, `en`, `es`, etc.) |
| `priority` | string | **NON** | `P0` = critique (CTAs, titres), `P1` = important, `P2` = secondaire |
| `context` | string | **NON** | Où apparaît la string (page, composant) — info pour vous |
| `notes_for_translator` | string | **NON** | Conseils spécifiques pour cette string |
| `extraction_status` | string | À ignorer | Statut technique côté FemiGlow |

### Exemple de ligne

```csv
key,namespace,source_value_fr,current_value_ar,priority,context,notes_for_translator
marketing.hero.title,marketing,"Le rituel ongles, en cinq minutes.",,P0,app/page.tsx (page d'accueil H1),"Titre principal. Ton: posé, ancré. Garder le rythme ternaire si possible."
```

Vous remplissez :

```csv
key,namespace,source_value_fr,current_value_ar,priority,context,notes_for_translator
marketing.hero.title,marketing,"Le rituel ongles, en cinq minutes.","طقس العناية بالأظافر، في خمس دقائق.",P0,app/page.tsx (page d'accueil H1),"Titre principal..."
```

### Règles d'or pour le CSV

1. **Ne jamais modifier les colonnes `key`, `namespace`, `source_value_fr`** — ce sont des identifiants techniques. Toute modification cassera l'import côté FemiGlow.

2. **Conserver les guillemets `"..."`** autour des cellules contenant virgules, sauts de ligne ou caractères spéciaux. Si votre traduction contient une virgule, encadrez-la de guillemets :

   ```csv
   ...,Continuer,..,"Continuar, por favor",...
   ```

3. **Échapper les guillemets internes** avec doubles guillemets :

   FR : `Il a dit "bonjour".`  
   AR : `قال "مرحبا".` (le `"` reste tel quel dans CSV, l'export final encode correctement)

   Dans Excel/Sheets : ça marche tout seul. Si problème : `Il a dit ""bonjour"".`

4. **Préserver les placeholders ICU** :

   Source : `Bienvenue, {firstName} !`  
   Traduction AR : `أهلاً، {firstName} !` (garder `{firstName}` exactement)

   Source : `{count, plural, =0 {Aucun produit} one {1 produit} other {# produits}}`  
   Traduction AR : `{count, plural, =0 {لا منتجات} one {منتج واحد} two {منتجان} few {# منتجات} many {# منتج} other {# منتج}}` (AR a 6 formes plurielles, à compléter)

5. **Préserver les balises HTML** présentes :

   Source : `Lire <b>la suite</b>`  
   Traduction EN : `Read <b>more</b>`

6. **Sauts de ligne dans une cellule** : utiliser le saut de ligne natif Excel (`Alt+Entrée` Win, `Cmd+Entrée` Mac). En CSV brut : `\n` peut être interprété diversement, préférer Google Sheets.

### Si vous trouvez une coquille dans le FR source

Vous ne pouvez **pas** corriger directement (modifier `source_value_fr` casserait l'import). À la place :

1. Marquez `[FR-TODO]` au début de votre traduction
2. Ajoutez un commentaire Google Sheets sur la cellule
3. Mentionnez la coquille dans votre email retour

Exemple :

```csv
...,"Nous contactez",,..,
```

(FR source erroné : devrait être "Nous contacter")

Vous mettez :

```csv
...,"Nous contactez","[FR-TODO] Contáctanos",..,
```

+ commentaire Sheets : "FR semble erroné, devrait être 'Nous contacter' ?"

---

## Glossaire à respecter

Le fichier `glossaire-fr-{xx}.csv` contient les termes obligatoires.

### Format du glossaire

```csv
fr,target,context,do_not_translate
FemiGlow,FemiGlow,Marque,oui
rituel,طقس,Concept produit,non
Maison,Maison,Page d'accueil (garder),oui
Kit,Kit,Nom international produit,oui
peau,بشرة,Corpus médical,non
hyperpigmentation,فرط التصبغ,Terme médical,non
ongle,ظفر,Corpus produit,non
ongle fragilisé,ظفر هش,Concept clé FemiGlow,non
soin,عناية,Génératif,non
huile,زيت,Ingrédient,non
sobre,هادئ,Tonalité marque,non
posé,مطمئن,Tonalité marque,non
méditerranéen,متوسطي,Univers marque,non
```

### Règles d'usage du glossaire

1. **Si `do_not_translate=oui`** : garder le terme français tel quel dans la traduction.

2. **Si le terme apparaît dans le glossaire** : utiliser **exactement** la traduction fournie. Pas de synonyme, pas d'adaptation.

3. **Si vous proposez une amélioration** sur un terme glossaire, mentionnez-le en commentaire et utilisez quand même la version actuelle pour cette livraison. FemiGlow décidera pour les prochaines vagues.

4. **Si un terme manque** dans le glossaire et apparaît plusieurs fois : tenir une **liste de cohérence** personnelle pour ne pas varier d'une cellule à l'autre.

### Construire votre glossaire perso

Tenez à part un fichier de notes :

```
mes-decisions-trad.txt
-------
"hydratation" → "ترطيب" (consistent)
"botanique" → "نباتي"
"ongle abîmé" → "ظفر تالف" (pas "ضعيف" qui est plus "faible" que "abîmé")
```

C'est ce qui distingue un excellent translateur d'un bon : la **cohérence** à travers 700 strings.

---

## Ton et style FemiGlow

Voir le fichier complet `tone-style-guide.md` reçu. Voici les **5 principes** à garder en tête en permanence :

### Principe 1 — Sobriété

❌ "Découvrez notre INCROYABLE rituel ongles QUI VA TRANSFORMER vos mains pour TOUJOURS !!!"

✓ "Un rituel ongles, en cinq minutes."

### Principe 2 — Posé, pas urgent

❌ "Offre limitée ! Plus que 24h ! Ne ratez pas cette opportunité unique !"

✓ "Disponible cette saison." (sans urgence)

### Principe 3 — Honnêteté

❌ "Résultats visibles dès la première application !" (faux)

✓ "Amélioration progressive sur plusieurs semaines." (vrai)

### Principe 4 — Métaphores méditerranéennes

❌ "Le sérum révolutionnaire à la technologie brevetée"

✓ "Une huile sobre, ancrée dans la tradition méditerranéenne"

### Principe 5 — Respect du client

❌ "Toi aussi tu mérites de te sentir BELLE !"

✓ "Pour celles qui prennent soin de leurs mains." (factuel, sans condescendance)

---

## Outils recommandés

### Outils de traduction professionnels (recommandés)

| Outil | Type | Usage | Coût |
|---|---|---|---|
| **SDL Trados** | CAT tool | Référence pro, mémoire de traduction | Licence ~700€ |
| **MemoQ** | CAT tool | Alternative à Trados, plus moderne | Licence ~600€ |
| **Memsource / Phrase** | TMS cloud | SaaS collaboration | À partir de 20€/mois |
| **OmegaT** | CAT tool open-source | Gratuit, complet | Gratuit |

### Outils gratuits (acceptables pour cette mission)

| Outil | Usage |
|---|---|
| **Google Sheets** | Pour éditer le CSV directement |
| **LibreOffice Calc** | Alternative locale à Sheets |
| **VS Code + extension Excel Viewer** | Si vous êtes plus à l'aise avec un éditeur de texte |

### Outils d'aide (brouillon initial seulement, JAMAIS livraison)

| Outil | Usage | Précautions |
|---|---|---|
| **DeepL** | Brouillon rapide, première passe | À reviewer + adapter au ton **systématiquement**. JAMAIS livrer tel quel. |
| **ChatGPT / Claude** | Brainstorm reformulations | Idem : reviewer + adapter. |
| **Reverso Context** | Vérifier usage en contexte réel | Outil de consultation, pas de livraison |
| **Linguee** | Idem | Idem |

### Notre engagement qualité

FemiGlow paie pour de la **traduction humaine professionnelle**. Si l'on détecte (par tests automatiques + review native speaker) que la livraison est essentiellement DeepL brut, la mission est rejetée.

C'est **OK d'utiliser DeepL/ChatGPT comme aide** pour gagner du temps sur les passages techniques. Ce n'est **pas OK** de livrer leur output direct.

---

## Comment poser des questions

### Pendant la traduction, vous aurez forcément des questions

C'est **normal et bienvenu**. La voix FemiGlow n'est pas évidente, et certains contextes sont spécifiques.

### Comment poser une question

#### Option 1 — Commentaire Google Sheets (recommandé)

Sur la cellule concernée, clic droit → "Commenter". Tag `@founder` (ou l'email de votre contact).

Exemple commentaire :

```
@founder — Pour "rituel ongles, en cinq minutes" :
- Trad littérale : "طقس العناية بالأظافر، في خمس دقائق"
- Plus poétique : "خمس دقائق من العناية بأظافرك"
Quelle préférence ?
```

#### Option 2 — Email récap fin de journée

Si vous accumulez des questions, envoyer un email récap :

```
À: founder@femiglow.ma
Objet: [Trad AR] Questions du jour — {date}

Bonjour,

Voici les questions accumulées aujourd'hui (lignes du CSV référencées) :

1. Ligne 23 (kit.title) : ...
2. Ligne 145 (rituel.step1) : ...
3. Ligne 230 (faq.delivery) : ...

J'avance sur les autres en attendant vos retours.

Bonne soirée
{Votre nom}
```

#### Option 3 — Slack canal partagé (si configuré)

Pour translateur récurrent : on peut vous ajouter à `#trad-femiglow`.

### Engagement temps de réponse FemiGlow

- Questions urgentes (bloquantes) : sous **24h**
- Questions standards : sous **48h**
- Réponse "à valider plus tard" possible : tag le commentaire `[FOUNDER-PENDING]` dans la cellule

### Si pas de réponse

Si une question n'est pas répondue dans le délai et bloque votre travail :

1. Marquez la cellule `[PENDING-Q]` avec votre meilleur essai
2. Continuez sur les autres strings
3. Mentionnez clairement dans l'email retour final les `[PENDING-Q]` à valider

---

## SLA et délais

### Délais typiques

| Volume | Délai de traduction |
|---|---|
| < 100 strings | 1-2 jours |
| 100-300 strings | 3-4 jours |
| 300-600 strings | 5-7 jours |
| 600-1000 strings (V1 FemiGlow typique) | **7-10 jours** |
| > 1000 strings | À négocier (souvent vagues séparées) |

### Décompte des jours

- **Jours ouvrés** (lundi-vendredi)
- Pas de samedi/dimanche dans le calcul
- Jours fériés Maroc / pays translateur : exclus

### Convention de communication

| Jour | Action attendue |
|---|---|
| J0 | Réception fichiers, accusé de réception sous 24h |
| J1-J{N-2} | Traduction en cours, ping mid-mission si questions |
| J{N-1} | Self-QA (cf. section suivante) |
| J{N} | Livraison du CSV complété |

### Si retard prévu

Si vous voyez que le délai ne sera pas tenu, **prévenez le plus tôt possible** :

```
Bonjour {founder},

Je rencontre {raison technique / personnelle} qui retarde ma livraison.

Nouvelle estimation : {date}, soit {N} jours de retard.

Je peux livrer une partie partielle si urgent (par exemple les P0 d'abord) :
- Option A : tout sous {nouvelle date}
- Option B : P0 sous {date-1}, P1+P2 sous {date-2}

Quelle option ?

Merci de votre compréhension.
{Votre nom}
```

### Si délai tenable mais qualité difficile

Si vous sentez que vous ne pouvez pas livrer une qualité acceptable dans le délai, **mieux vaut négocier un délai qu'une mauvaise livraison**. FemiGlow préfère 2 jours de plus à une trad médiocre.

---

## Self-QA avant retour

**Avant de renvoyer le CSV, faites ce check de 30 min.**

C'est ce qui distingue un translateur professionnel d'un amateur.

### Checklist QA technique

- [ ] **Toutes les lignes ont une valeur** dans `current_value_{xx}` (aucune vide)
- [ ] **Pas de mojibake** : ouvrir le CSV dans UTF-8 et vérifier les caractères spéciaux (é, à, ç, ا, ب, …)
- [ ] **Placeholders ICU préservés** : `{firstName}`, `{count}`, `{date}` doivent apparaître **exactement** comme dans le FR
- [ ] **Balises HTML préservées** : `<b>`, `<a href="...">`, `<br>` …
- [ ] **Sauts de ligne préservés** : si FR a un `\n` ou un saut visible, la trad aussi
- [ ] **Format CSV intact** : ouvrir dans Google Sheets, vérifier qu'aucune colonne n'a shifté

### Checklist QA linguistique

- [ ] **Glossaire respecté** : les ~50-100 termes du glossaire sont utilisés correctement
- [ ] **Cohérence terminologique** : "ongle" traduit toujours pareil dans les 700 strings
- [ ] **Ton respecté** : sobre, posé, méditerranéen (relire 20 strings random)
- [ ] **Pas de DeepL brut** : la trad ne ressemble pas à du DeepL non révisé
- [ ] **Pas de coquilles** : passer un correcteur orthographique de la langue cible

### Checklist QA contextuelle

- [ ] **CTAs courts et clairs** : un bouton "Acheter" → un mot court dans la trad aussi, pas une phrase
- [ ] **Titres frappants** : préserver le rythme et l'impact du FR
- [ ] **FAQ informatives** : registres adapté (factuel, pas marketing)
- [ ] **Légal précis** : pas d'approximation sur les termes RGPD / conditions

### Checklist QA spécifique RTL (pour AR, HE, FA)

- [ ] **Ponctuation RTL** : virgule arabe `،` et point d'interrogation arabe `؟` utilisés
- [ ] **Chiffres** : décidé avec FemiGlow si chiffres arabes `٠-٩` ou occidentaux `0-9` (par défaut pour MA : occidentaux)
- [ ] **Pluriels** : si FR utilise `{count, plural, ...}`, la trad AR doit avoir les **6 formes** : `=0, one, two, few, many, other`

### Checklist QA spécifique CJK (pour JA, ZH, KO)

- [ ] **Pas d'espaces entre caractères** sauf entre mots latins et CJK
- [ ] **Ponctuation locale** : `。` au lieu de `.`, `、` au lieu de `,` (selon langue)
- [ ] **Registre** : keigo en JA si formel, registre adapté en ZH et KO

### Spot-check final

Prendre **10 strings random** et les imaginer dans le contexte :

- Cette string est sur la page d'accueil — est-ce qu'elle frappe ?
- Cette string est un bouton — est-ce que c'est cliquable mentalement ?
- Cette string est une FAQ — est-ce que je comprends la réponse ?
- Cette string est dans un email transactionnel — est-ce que c'est rassurant ?

Si une string vous fait douter : marquez-la `[REVIEW]` dans une colonne supplémentaire (à créer) et signalez-la dans l'email retour.

---

## Format de retour attendu

### Fichier à renvoyer

1. **Le CSV traduit** : `femiglow-i18n-fr-to-{xx}-{date}-COMPLETED.csv`

   Naming exact :
   - Garder le nom original
   - Ajouter `-COMPLETED` à la fin (avant `.csv`)
   - Pas de `-final-v2-real-final` (un seul fichier final)

2. **Email récapitulatif** (template ci-dessous)

3. **Si applicable** : fichier `notes-trad-{xx}-{date}.md` avec les `[FR-TODO]` ou questions en suspens

### Email retour template

```
À: {founder-email}
Objet: [Trad {Langue}] Livraison complète — {date}

Bonjour,

Je vous remets la traduction FR → {Langue} pour FemiGlow.

== Fichier livré
- femiglow-i18n-fr-to-{xx}-{date}-COMPLETED.csv ({N} lignes traduites)
- {N=700} strings traduites
- {0|3|5} strings marquées [REVIEW] (cf. section notes ci-dessous)
- {0|2} strings marquées [FR-TODO] (coquilles FR à vérifier de votre côté)

== Self-QA effectué
- [✓] Glossaire respecté
- [✓] Placeholders ICU préservés
- [✓] Cohérence terminologique
- [✓] Correcteur orthographique passé
- [✓] Spot-check sur 30 strings random

== Notes ou questions
{Si questions en suspens, lister ici}

== Modalités
- Délai contractuel : {date initiale}
- Livraison effective : {date livraison}
- Facture à venir : {oui/déjà envoyée}

À votre disposition pour révisions ou questions.

Cordialement
{Votre nom}
```

### Pas de zip, pas d'archive

Envoyez le **CSV directement** en pièce jointe email (max 25MB) ou via Drive partagé.

### Versionning

Si plusieurs allers-retours :

- Version 1 : `femiglow-i18n-fr-to-{xx}-{date}-COMPLETED.csv`
- Version 2 (révision) : `femiglow-i18n-fr-to-{xx}-{date}-COMPLETED-v2.csv`
- Version finale après acceptation : ajouter `-ACCEPTED` quand FemiGlow valide

### Suite à la livraison

Côté FemiGlow :

1. **Validation technique** (sous 48h) : check intégrité CSV, parse OK, placeholders OK
2. **Validation linguistique** (sous 5j) : review par founder + native speaker
3. **Intégration et tests** (sous 7j) : import dans le code, test en staging
4. **Retour révisions** (si nécessaire) : email avec lignes à revoir
5. **Acceptation finale** + paiement
6. **Mise en ligne** (canary 10% → 50% → 100% sur 1 semaine)

Total cycle : **environ 2 semaines** entre votre livraison et la mise en prod.

---

## FAQ translateur

### Q1 — Combien de strings je vais traduire en moyenne ?

R : V1 FemiGlow = ~700 strings (FR → AR). Les vagues suivantes (mises à jour, nouvelles pages) seront plus petites : 50-200 strings par vague.

### Q2 — Je trouve que la voix FemiGlow n'est pas évidente, je peux proposer une refonte ?

R : **Non**, vous suivez la voix telle que définie. Si vous avez des idées, partagez-les en commentaires ou par email — FemiGlow décide. Mais la livraison doit respecter la voix actuelle.

### Q3 — Je peux faire une partie en DeepL pour gagner du temps ?

R : **Brouillon initial OK**, livraison brute NON. Vous devez **systématiquement** réviser et adapter au ton. La trad finale doit être votre travail humain, DeepL est un outil parmi d'autres.

### Q4 — Le CSV est trop technique, je ne sais pas l'ouvrir

R : Demandez à FemiGlow un **fichier Google Sheets** plutôt que CSV brut. Format identique mais plus facile à éditer.

### Q5 — J'ai trouvé une erreur dans le FR source

R : **Ne corrigez pas vous-même** (`source_value_fr` est lecture seule). Marquez `[FR-TODO]` au début de votre trad et signalez en commentaire + email retour.

### Q6 — Une string contient `{name}` ou `{count}`, je traduis quoi ?

R : Vous **gardez** le `{name}` ou `{count}` **exactement** dans votre trad. Exemple :

FR : `Bonjour, {firstName} !`  
AR : `أهلاً، {firstName} !` (gardez `{firstName}`, c'est une variable technique)

### Q7 — Que faire avec les `{count, plural, ...}` complexes ?

R : Format ICU MessageFormat. Vous adaptez les **textes** entre `{}` mais gardez la structure. Pour AR, vous devez compléter les 6 formes plurielles.

Source : `{count, plural, =0 {Aucun} one {1 article} other {# articles}}`

Trad AR : `{count, plural, =0 {لا شيء} one {مقال واحد} two {مقالان} few {# مقالات} many {# مقالاً} other {# مقال}}`

Si vous ne maîtrisez pas ICU : signalez à FemiGlow, on peut traiter ces strings séparément.

### Q8 — Combien je serai payé ?

R : À convenir avec FemiGlow lors du brief initial. Tarification standard : au mot ou au string, taux confidentiel selon votre profil et le volume.

### Q9 — Mes traductions sont propriété de FemiGlow après paiement ?

R : Oui, transfert de droits patrimoniaux complet une fois paiement reçu. C'est standard pour ce type de mission. Détails dans le contrat freelance.

### Q10 — Je peux mettre ce travail dans mon portfolio ?

R : Oui après acceptation finale et accord FemiGlow par écrit. Pas de NDA strict sauf mention contraire.

### Q11 — Si FemiGlow demande des révisions, c'est facturé ?

R : Selon contrat. Standard : 1 round de révisions inclus dans le tarif initial (révisions limitées à des points objectifs : terminologie, cohérence, contexte). Au-delà, à facturer au temps passé.

### Q12 — Je suis traducteur AR, je dois écrire en MSA ou en Darija ?

R : Pour FemiGlow Maroc, c'est un **mix** :
- Corps de texte / FAQ / pages légales : MSA (arabe standard moderne)
- CTAs / marketing accrocheur / mots-clés émotionnels : Darija acceptable si pertinent

À chaque cas : viser ce qui parle le plus naturellement à une marocaine urbaine 30-55. Si doute, MSA par défaut.

### Q13 — Je suis traducteur EN, US ou UK english ?

R : **English-US** par défaut pour FemiGlow (marché tier-1 USA principalement). Pour des termes ambigus (color/colour, organize/organise) : US.

### Q14 — Et si je trouve une chose plus drôle / impactante en m'éloignant du FR ?

R : **Transcréation** acceptée pour titres marketing et CTAs si justifié, mais :
- Mentionnez en commentaire votre démarche
- Proposez une version "fidèle" en alternative dans une colonne notes
- FemiGlow tranche

### Q15 — Combien de temps de relecture j'ai après livraison ?

R : FemiGlow vous remontera les retours sous **5 jours ouvrés**. Si silence radio > 7 jours, c'est qu'on a accepté tacitement (mais ping si vous voulez confirmation).

---

## Liens utiles

- [`../05-ui-ux-design/tone-style-guide.md`](../05-ui-ux-design/tone-style-guide.md) — Guide ton détaillé
- [`../05-ui-ux-design/content-style-guide.csv`](../05-ui-ux-design/content-style-guide.csv) — Style guide contenu
- [`../06-data-strategy/glossaire-fr-ar.csv`](../06-data-strategy/) — Glossaire AR (référence)
- [`../06-data-strategy/glossaire-en.csv`](../06-data-strategy/) — Glossaire EN
- [`../06-data-strategy/workflow-translation.md`](../06-data-strategy/workflow-translation.md) — Workflow technique côté FemiGlow

---

## Récapitulatif en 1 page

Si vous oubliez tout, retenez ça :

1. **Lire ce doc en entier avant de commencer** (25 min)
2. **Lire le tone-style-guide.md** (15 min)
3. **Garder le glossaire ouvert** pendant toute la mission
4. **Ne JAMAIS modifier** `key`, `namespace`, `source_value_fr`
5. **Préserver les placeholders** `{firstName}`, `{count}`, `<b>...</b>`
6. **Cohérence terminologique** dans les 700 strings
7. **DeepL/ChatGPT en brouillon OK**, jamais en livraison
8. **Self-QA 30 min** avant de renvoyer
9. **Email retour structuré** (template fourni)
10. **Demander si doute** — c'est mieux qu'un mauvais choix solitaire

Merci de votre travail. FemiGlow compte sur la qualité de votre traduction pour bien démarrer sur votre marché.

---

**Auteur** : Claude — 27 mai 2026
**Version** : 1.0
**Mises à jour** : après chaque mission, intégrer retours translateur.
