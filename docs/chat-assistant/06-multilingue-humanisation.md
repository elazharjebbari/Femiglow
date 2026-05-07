# 06 — Multilingue & humanisation

> *FR / AR / darija, détection langue, cadence frappe, voyants, salutations contextuelles*

---

## 1. Objectif

Faire en sorte que l'initiée ne se rende pas compte qu'elle parle
à une intelligence artificielle. Cela passe par :

1. **comprendre sa langue dès le premier mot**, sans la lui demander ;
2. **lui répondre dans la même langue et le même registre**,
   en respectant les codes de chaque langue ;
3. **simuler une cadence de frappe** crédible, avec voyants,
   accusés de lecture, et latence proportionnelle ;
4. **absorber le code-switching** marocain (FR/AR/Darija dans la
   même phrase) sans rupture.

## 2. Langues prises en charge en V1

| Code        | Nom                  | Direction | Police                   | Notes                                 |
| ----------- | -------------------- | --------- | ------------------------ | ------------------------------------- |
| `fr`        | Français             | LTR       | Inter / Cormorant        | Langue par défaut                     |
| `ar`        | Arabe classique      | RTL       | IBM Plex Sans Arabic     | Registre soutenu accessible           |
| `ar-MA`     | Darija marocaine     | RTL       | IBM Plex Sans Arabic     | Caractères arabes par défaut, latin toléré en input |

L'anglais et l'arabe levantin / égyptien sont **détectés** mais
l'agent répond en français en s'excusant courtoisement et en
proposant la bascule.

## 3. Détection de langue

Implémentée dans `lib/chat/lang.ts`. Trois étages :

```
┌──────────────────┐
│  1. Heuristique  │  caractères arabes vs latin, lexique darija
└────────┬─────────┘
         │ ambigu ?
         ▼
┌──────────────────┐
│  2. CLD3 (cdn)   │  détecteur compact (modèle 1.5 Mo, hors widget)
└────────┬─────────┘
         │ ambigu ?
         ▼
┌──────────────────┐
│  3. LLM oneshot  │  dernier recours, prompt court < 100 tokens
└──────────────────┘
```

L'étage 1 résout **> 95 %** des cas. CLD3 / LLM ne sont mobilisés
qu'en frontière.

### 3.1 Heuristique pondérée

```ts
const DARIJA_TOKENS_AR = ['كيفاش', 'بزاف', 'هاد', 'دابا', 'مزيان', 'باغية', 'باغي', 'ديالي', 'ديالك', 'فاش', 'علاش', 'واش', 'أنا', 'أنت', 'نتي', 'نتا'];
const DARIJA_TOKENS_LATIN = [
  'kifash', 'bzaf', 'had', 'daba', 'mzyan', 'baghi', 'baghya',
  'dyali', 'dyalk', 'fash', 'achno', 'achnou', 'wash', 'salam', 'labas',
  'safi', 'wakha',
];
const ARABIC_RE = /[؀-ۿ]/g;
const LATIN_RE  = /[A-Za-zÀ-ÿ]/g;

export function detectLanguage(text: string): Language {
  const arabic = (text.match(ARABIC_RE) ?? []).length;
  const latin  = (text.match(LATIN_RE) ?? []).length;
  const lower  = text.toLowerCase();

  if (arabic > 0) {
    const dCount = DARIJA_TOKENS_AR.filter(t => text.includes(t)).length;
    if (dCount >= 1) return 'ar-MA';
    if (arabic > latin * 1.5) return 'ar';
  }

  const dLatin = DARIJA_TOKENS_LATIN.filter(t => lower.includes(t)).length;
  if (dLatin >= 1 && latin > arabic) return 'ar-MA';

  if (latin > 0) return 'fr';
  return 'fr';
}
```

> Ces dictionnaires sont éditables côté admin (`/admin/chat/lang/dictionaries`)
> et versionnés.

### 3.2 Bascule en cours de conversation

Si la détection change pour 2 messages consécutifs, on bascule la
langue de session. La transition est annoncée par une bulle système
discrète : « la maison comprend ton changement de langue. »
(traduit dans la nouvelle langue).

## 4. Voix par langue

### 4.1 Français — registre maison

- Tutoiement systématique. Pas de vouvoiement.
- Phrases courtes, syntaxe propre, pas de calques marketing.
- Pas d'exclamation, pas d'emoji.
- Lexique : « rituel », « initiée », « gestes », « la maison ».
- Métaphores tactiles tolérées : « doux », « éclat », « lenteur ».
- Termes interdits : « profite », « offre exclusive », « vite », « génial », « parfait ».

Exemple :

> « le kit Rituel d'Éclat est composé de quatre gestes — paste,
>   powder, shine, polish — qui se suivent en cinq minutes.
>   veux-tu que je t'en raconte le déroulé ? »

### 4.2 Arabe classique — registre soutenu accessible

- Vocabulaire courtois sans pédanterie.
- Termes : « طقس » (rituel) plutôt que « منتج » (produit) ;
  « دار » (maison) plutôt que « علامة » (marque).
- Pas d'urgence, pas de mots commerciaux.
- Voyellation rarement nécessaire ; n'écrire les harakat que
  pour lever une ambiguïté.

Exemple :

> « طقس البريق مكوّن من أربع لمسات تتتابع في خمس دقائق.
>   هل تودّين أن أرافقك خطوة بخطوة ؟ »

### 4.3 Darija marocaine — registre proche

- Tutoiement (نتي / نت).
- Vocabulaire quotidien marocain. Code-switching FR/AR toléré
  quand l'initiée l'amorce.
- Mots clés autorisés : « كيفاش »، « بزاف »، « مزيان »،
  « ديالي »، « دابا »، « فين »، « شحال ».
- Pas d'arabe oriental littéraire forcé.
- L'agent peut répondre en darija écrite en caractères arabes
  même si l'initiée écrit en latin (préférence par défaut),
  ou maintenir la latinisation si l'initiée la maintient sur
  3 messages consécutifs (mémoire de session).

Exemple :

> « طقس البريق مكوّن من 4 خطوات بسيطة، بزاف ساهلة، كتاخد 5
>   دقايق. واش نشرح ليك كيفاش؟ »

ou (latin si initiée latinise) :

> « tqs l-briq fih 4 khtwat sahla, bzaf bsita, kayakhd 5 dqayq.
>   wash nshrah lik kifash ? »

## 5. Salutations contextuelles

Les salutations sont stockées dans `chat_theme_preset.pageSalutations`
et indexées par `pathPattern` (regex glob) + `timeWindow`. Cf. doc 05.

Exemple complet (preset par défaut) :

```jsonc
[
  {
    "pathPattern": "/",
    "timeWindow": "morning",
    "fr":    "la maison te souhaite un matin doux. en quoi puis-je t'éclairer ?",
    "ar":    "تتمنّى لكِ الدار صباحًا هادئًا. كيف يمكنني أن أرافقكِ ؟",
    "arMa":  "صباح الخير. كنتمنّى نهارك يكون مزيان. كيفاش نقدر نعاونك ؟"
  },
  {
    "pathPattern": "/kit",
    "fr":    "le kit t'intrigue ? je suis là pour répondre.",
    "ar":    "هل يثير الطقس فضولكِ ؟ أنا هنا للإجابة.",
    "arMa":  "الكيت كيعجبك ؟ أنا هنا باش نجاوبك."
  }
  // ...
]
```

Si aucun preset matche, la salutation par défaut est servie
(« la maison à l'écoute »).

## 6. Humanisation de la cadence

### 6.1 Pourquoi ?

Les modèles modernes répondent en moins de 1 s. Sans
humanisation, le texte « apparaît bloc » comme un drag-and-drop —
c'est trahissant.

### 6.2 Comment ?

Quatre leviers, combinés :

| Levier                    | Implémentation                                                              | Gain perçu                          |
| ------------------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| **Délai initial typing**  | Voyant `· · ·` minimum 600 ms avant le premier token                        | Sentiment de réflexion              |
| **Cadence par caractère** | 14 ms / caractère FR, 18 ms / caractère AR, mini 80 ms par flush            | Effet de frappe naturelle           |
| **Pauses syntaxiques**    | +120 ms après `,`, +280 ms après `.`, +180 ms après `?`                     | Ponctuation respirée                |
| **Burstiness**            | Variation aléatoire ± 15 % sur chaque flush                                 | Anti-cadence robotique              |

```ts
// lib/chat/humanize.client.ts (extrait étendu)
const TYPING_MIN_MS = 600;
const PER_CHAR_MS_FR = 14;
const PER_CHAR_MS_AR = 18;
const PAUSE_AFTER: Record<string, number> = { ',': 120, ';': 120, '?': 180, '!': 180, '.': 280, ':': 80, '\n': 220 };
const JITTER_PCT = 0.15;

export async function* humanize(stream, lang) {
  let buffer = '';
  let typingShown = false;
  const typingStart = performance.now();
  const perChar = lang.startsWith('ar') ? PER_CHAR_MS_AR : PER_CHAR_MS_FR;

  for await (const ev of stream) {
    if (ev.event === 'typing-start') {
      yield ev; typingShown = true; continue;
    }
    if (ev.event !== 'token') { yield ev; continue; }
    buffer += ev.data;

    // garantit le délai minimum avant le premier flush visible
    if (typingShown && performance.now() - typingStart < TYPING_MIN_MS) {
      await sleep(TYPING_MIN_MS - (performance.now() - typingStart));
      yield { event: 'typing-end' };
    }

    // flush par phrase ou tous les ~12 caractères
    const cuts = splitByPunctuation(buffer);
    for (const piece of cuts) {
      const dur = piece.length * perChar * (1 + (Math.random() * 2 - 1) * JITTER_PCT);
      yield { event: 'token', data: piece };
      await sleep(dur);
      const last = piece.slice(-1);
      if (PAUSE_AFTER[last]) await sleep(PAUSE_AFTER[last]);
    }
    buffer = '';
  }
}
```

### 6.3 Réglages côté admin

Le preset thème expose :

```jsonc
"motion": {
  "humanize": true,
  "typingMinMs": 600,
  "perCharMsFr": 14,
  "perCharMsAr": 18,
  "jitterPct": 0.15,
  "pauseAfter": { ",": 120, ".": 280, "?": 180 }
}
```

Toutes les valeurs sont overridables par preset, jamais en dur.

### 6.4 Désactivation accessibilité

`prefers-reduced-motion: reduce` ⇒ `humanize: false` automatiquement.
Le texte apparaît bloc, voyant typing affiché 600 ms tout de même
(pour ne pas trahir l'IA, mais sans flux visuel agressif).

## 7. Voyants et accusés

| Voyant                                   | Quand                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| « · · · » sous la liste                  | Pendant le typing simulé (avant first-token humanisé)             |
| « lu à 16:42 » sur message visiteur      | Quand le serveur a accusé réception et démarré la complétion       |
| Curseur clignotant fin dans bulle agent  | Pendant la frappe humanisée (jusqu'à la fin du flush)              |
| « la maison consulte ses notes »         | Pendant l'étape RAG si > 1 s (déclenchement adaptatif)             |
| « la maison réfléchit encore »           | Si latence > 4 s (au-delà du voyant typing standard)               |

Ces voyants sont des **bulles système** discrètes, italiques,
opacité 65 %.

## 8. Stratégie « bonne langue »

Trois garde-fous garantissent que l'agent ne dérape pas vers une
autre langue :

1. **Prompt système verrouillé par langue.** Cf. `annexes/prompts-systeme.md`.
   Trois prompts : `default-fr`, `default-ar`, `default-ar-MA`.
2. **Re-validation post-génération.** Si la réponse contient
   plus de 30 % de caractères d'une autre langue, elle est
   régénérée avec le rappel : « réponds strictement en {language} ».
3. **Limite de bascule.** Pas plus d'une bascule par tour.

## 9. Code-switching

Le code-switching FR ⇄ AR est fréquent au Maroc :

> « salam, chno l-prix dyal le kit ? »

L'agent doit répondre en darija prédominant tout en gardant les
mots techniques cités tels quels :

> « salam, l-Kit Rituel d'Éclat tamano 320 درهم. واش نشرح ليك كيفاش
>   كاتستعملو ? »

Cette tolérance est encadrée par le prompt système (« si l'initiée
mêle les langues, miroir ce mélange dans la même proportion »).

## 10. Ton et longueur attendus

| Type de question      | Longueur agent attendue              | Style                                  |
| --------------------- | ------------------------------------ | -------------------------------------- |
| Salutation simple     | 1-2 phrases                          | Souffle d'accueil                       |
| Question factuelle    | 2-4 phrases                          | Réponse + invitation à creuser         |
| Question explicative  | 4-7 phrases avec petites listes      | Pédagogie, lente                        |
| Question objection    | 3-5 phrases                          | Reconnaissance + clarification          |
| Question hors-charte  | 1-2 phrases                          | Refus calme + redirection               |

L'agent **ne dépasse pas 220 mots** sauf si la question l'exige
explicitement (« raconte-moi en détail », « explique »).

## 11. Annonces RTL

Quand la langue bascule en RTL, l'agent envoie en bulle système :

> « bissed-dakhla d-l3arabia » / « بسلاسة، نمشّيو بالعربية »

cette bulle est animée 240 ms et déclenche le `direction: rtl`
côté CSS.

## 12. Gestion des accents et diacritiques

- En français : apostrophes courbes `'` (U+2019), em-dashes `—`
  (U+2014), espaces fines insécables avant `?`, `!`, `:` (U+202F).
- En arabe : pas de tatweel ornemental ; pas de harakat sauf pour
  lever une ambiguïté.

## 13. Tests de langue (résumé)

| Scénario                           | Attendu                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| « bonjour »                        | Réponse FR                                                        |
| « salam »                          | Réponse darija                                                    |
| « كيفاش هاد الكيت ؟ »              | Réponse darija en caractères arabes                               |
| « ما هو هذا الطقس ؟ »              | Réponse arabe classique                                           |
| « hello »                          | Bascule FR + courte note « la maison parle FR / AR / darija »     |
| « salam, chno l-prix ? »           | Réponse darija avec préservation du « prix »                      |
| Visiteur change FR → darija        | Salutation système + bascule                                      |

## 14. Lecture suivante

- [05 — UI / UX & design](05-ui-ux-design.md) pour le rendu visuel
  des voyants.
- [annexes/prompts-systeme.md](annexes/prompts-systeme.md) pour
  les prompts par langue.
- [09 — RAG](09-knowledge-base-rag.md) pour la fraîcheur multilingue.
