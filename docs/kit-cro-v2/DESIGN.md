# Kit CRO v2 — conception

Branche `feat/kit-cro-v2`, partie de `feat/kit-coherence` (9634f247, build en prod).
Périmètre validé le 30/10/2026 :

| Chantier | Décision utilisateur |
|---|---|
| Vitesse de chargement (récupérer une partie des 30 % de clics perdus avant la page vue) | Oui |
| Formulaire qui s'ouvre au clic au lieu de défiler | Oui |
| Titre du hero qui varie selon `utm_content` | Oui |
| Ton plus direct (boutons, « pâte / poudre ») | Oui |
| Hero AR en darija | Non |
| Formulaire allégé | Non (déjà en 2 étapes, adresse en étape 2) |
| Preuve sociale | Non |
| Publicités Meta | Ne pas toucher |

Contrainte transverse : tout ce qui est contenu ou réglage commercial doit rester pilotable depuis l'admin (`/admin/components`), en FR/AR/EN, avec brouillon, publication et historique.

---

## 1. Vitesse de chargement

### Constat (audit du code)

1. **Vidéos des stories** : chaque bulle (`StoriesRail.tsx`) monte une `<video autoPlay>` de la story entière dès qu'elle est visible. Sur mobile, le rail est juste sous la galerie du hero, donc les 4 vidéos (6,4 Mo) partent au chargement et concurrencent l'image du hero, le JS, `gtm.js` et `fbevents.js`.
2. **Redirection** : `/kit` → `/fr/kit` en 307 (`middleware.ts`, `resolveLegacyLocaleRedirect`). Chaque clic publicitaire FR paie un aller-retour de plus avant le HTML, et les cookies d'attribution ne sont écrits qu'au second passage.
3. **Polices** : en AR, Inter et Cormorant (86 Ko) sont préchargées sans servir, et Cairo n'est pas préchargée. Les titres en italique sont en faux italique (Cairo n'a pas d'italique).
4. **Mesure** : aucun Web Vitals remonté, Lighthouse CI ne teste pas `/fr/kit` en mobile.
5. Hors périmètre de ce lot (documenté) : PageView Meta tardive via GTM (nécessite une modification du conteneur GTM), messages next-intl entiers sérialisés (73–87 Ko), hero entièrement client.

### Options étudiées

| Sujet | Option A | Option B | Option C | Choix |
|---|---|---|---|---|
| Vidéos des bulles | Poster seul, vidéo uniquement au tap | Lecture différée après `load` + idle, sauf `saveData`/2G | Courts teasers dédiés (3 s, < 200 Ko) | **A + B** : poster par défaut ; l'aperçu animé ne démarre qu'après `window.load` + idle, une seule bulle à la fois, et jamais si `navigator.connection.saveData` ou réseau lent. C demanderait de nouveaux médias. |
| Redirection `/kit` | Pubs pointées sur `/fr/kit` | Rewrite interne `/kit` → `/fr/kit` (URL inchangée) | Garder la redirection | **B pour `/kit` uniquement**, derrière l'env `KIT_ROOT_REWRITE` (défaut `on`). A est exclu (pubs gelées). Le canonical reste `/fr/kit`. |
| Polices AR | Préchargement conditionnel par locale | Préchargement global de Cairo 400/700 | Statu quo | **Correctif CSS du faux italique** + Cairo réduite à 400/700. Le préchargement conditionnel n'est pas possible avec `next/font` sans dupliquer le layout ; gain jugé faible. |
| Mesure | `useReportWebVitals` → `/api/track` | Outil tiers (SpeedCurve…) | Lighthouse CI seul | **A + Lighthouse CI mobile sur `/fr/kit` et `/ar/kit`**. Les vitals partent dans `tracking_events_log` (événement `web_vitals`, sans Meta). |

---

## 2. Formulaire au clic

### Constat

Tous les boutons « Commander » font défiler jusqu'à `#commander-femiglow` (environ 8 700 px sur mobile en V2) via `arriveAtCommander` ou des `scrollIntoView` bruts (PostCtaLink, VideoPostCta, StepsPostCtaLink, StoryViewer). Le formulaire (`WizardShell`) est une instance unique dont tout l'état vit dans le store persistant `femiglow.wizard.v1`. Le démonter et le remonter ne perd donc rien.

### Options étudiées

| Option | UX | Tech | Risques |
|---|---|---|---|
| A. Panneau en bas d'écran (sheet) qui contient le formulaire | Contexte conservé, 1 geste, standard mobile | Radix Dialog (déjà installé) : focus trap, Échap, aria. Le shell est rendu soit en ligne, soit dans le panneau (une seule instance montée à la fois). | Clavier virtuel iOS, bouton retour, liste des villes dans un conteneur qui défile |
| B. Page dédiée `/commander` | Simple | Nouvelle route, perte du contexte et du scroll | Une navigation de plus, tracking de page à doubler |
| C. Remonter le formulaire juste sous le hero | Aucun clic | Changement de layout | Pousse tout le contenu sous le formulaire ; déjà testé en V1 |

**Choix : A**, avec un **test A/B piloté depuis l'admin** :
- nouveau composant CMS `kit-checkout`, champ `ctaMode` = `scroll` | `sheet` | `ab`, et champ `sheetSharePct` (0–100) ;
- en mode `ab`, l'attribution se fait côté client, de façon stable par visiteur (hash FNV-1a de l'identifiant anonyme `fg_aid`, via `assignVariant` déjà présent dans `lib/chat/services/ab-engine.ts`) ;
- `?cta=sheet|scroll` force la variante, pour la recette et les tests e2e ;
- la variante est portée par `formContext.variantKey` (`A` = scroll, `B` = sheet). Elle arrive donc déjà jusqu'à `orders.variant_key` et à tous les événements de checkout. On l'ajoute aussi sur `add_to_cart` et sur les clics boutons (`kit_cta_mode`).

### Points de conception

- Un seul point d'entrée, `openCommander({ source })` : tous les boutons l'appellent. En mode `scroll`, il délègue à `arriveAtCommander` (comportement actuel). En mode `sheet`, il ouvre le panneau. Le hash `#commander-femiglow` à l'arrivée ouvre aussi le panneau.
- Le panneau : hauteur `100dvh` moins une marge haute, défilement interne, `visualViewport` pour le clavier (même logique que `ChatPanel`), `history.pushState` à l'ouverture et `popstate` pour fermer au bouton retour, `prefers-reduced-motion` respecté, barre sticky masquée pendant l'ouverture.
- Le changement d'étape remonte le défilement du panneau en haut et place le focus sur le titre de l'étape.
- La section en ligne reste dans la page (SEO, desktop). Quand le panneau est ouvert, elle affiche un emplacement réservé.

---

## 3. Titre selon `utm_content`

### Options étudiées

| Sujet | Option A | Option B | Option C | Choix |
|---|---|---|---|---|
| Lecture de l'angle | Middleware : en-tête `x-fg-angle` + cookie | Lecture de `searchParams.utm_content` dans la page + cookie posé côté client pour les retours | Côté client après hydratation | **B** : la page est déjà dynamique (`headers()`, `cookies()`), donc zéro coût de cache et pas de nouvelle logique dans le middleware. C provoquerait un saut de titre visible. |
| Stockage des textes | Champ `list<record>` `angleVariants` | Composant CMS `kit-hero-angles` avec des champs texte fixes par angle | Fichiers i18n | **B** : les champs texte simples sont le chemin le plus éprouvé de l'admin (l'encodage des listes a un bug latent, voir §6). FR/AR/EN, brouillon, publication, historique et planification sont fournis par l'existant. |
| Normalisation | Table de correspondance en base | Règle en code : `A-darija` → `a`, `temoin-*` → `temoin`, sinon aucun angle | — | **Règle en code**, testée, plus `?angle=` pour la recette. |

Angles : `a`, `b`, `c`, `d`, `e`, `temoin`. Champs par angle : `<angle>_kicker`, `<angle>_titleCategory`, `<angle>_titlePromise`. Un champ vide retombe sur le titre par défaut, champ par champ.

La mise en cache des champs n'est pas fragmentée par angle : tous les angles sont lus en un seul appel caché (`resolveComponentFields('kit-hero-angles', locale)`), puis l'angle est choisi en mémoire.

L'angle résolu est ajouté à `view_item` (paramètre `kit_angle`) et à `add_to_cart`, pour lire la conversion par angle.

---

## 4. Ton plus direct

| Sujet | Option A | Option B | Choix |
|---|---|---|---|
| Libellés des boutons | Modifier les fichiers i18n | Champs CMS `kit-cta` (`ctaPrimary`, `ctaSticky`, `ctaMicrocopy`) avec gabarit `{price}`, i18n en repli | **B**, pour garder la main depuis l'admin. Le prix est injecté côté client (il dépend du code promo appliqué). |
| « paste / powder » | Remplacement global | Remplacement dans le texte visible FR seulement, relu phrase par phrase (accords : « la poudre ») | **B**. Les clés techniques et les noms de produits en base ne changent pas. Garde-fou : `kit-facts.guard.test.ts`. |

Libellés FR proposés : bouton principal « Je commande — {price} », micro-texte « Je paie à la livraison », barre sticky « Je commande ». AR : « اطلبي الآن — {price} », « الدفع عند الاستلام ». EN : « Order now — {price} », « Pay on delivery ».

---

## 5. Plan de test

| Niveau | Contenu |
|---|---|
| Unitaire (Vitest) | Normalisation des angles ; résolution titre/kicker avec repli champ par champ ; gabarit `{price}` ; attribution A/B stable et répartition ; `openCommander` (scroll et sheet) ; panneau (ouverture, Échap, bouton retour, focus, état conservé) ; StoriesRail sans vidéo au montage ; rewrite `/kit`. |
| Intégration | Registre : `kit-checkout`, `kit-hero-angles`, `kit-cta` validés par `validateFieldValue` ; parité des messages i18n ; garde-fou `kit-facts`. |
| E2E (Playwright, 375 px) | `?cta=sheet` : ouverture depuis le hero, la barre sticky et le lien d'ancre, commande complète dans le panneau, retour arrière qui ferme ; `?cta=scroll` : parcours actuel inchangé ; `?utm_content=E-darija` : titre de l'angle E ; aucune requête `.webm` avant interaction. |
| Qualité | `pnpm typecheck`, `pnpm lint`, `pnpm test`, build de production, Lighthouse mobile avant/après. |

## 6. Dettes relevées, hors périmètre

- Encodage des champs `list` dans l'admin (`{v}` contre chaînes brutes) : à corriger avant de s'appuyer sur des listes éditables.
- Store du pack `/admin/kit/pack` en mémoire du processus.
- PageView Meta via GTM : tag « Meta Init » à adapter si l'on charge le pixel plus tôt.
- Double ViewContent et double Lead (rapport funnel du 30/10).
- `GeoPromoSlideHeader` ne s'affiche que sur `/kit` exact.
- RBAC non appliqué aux routes de composants admin.
