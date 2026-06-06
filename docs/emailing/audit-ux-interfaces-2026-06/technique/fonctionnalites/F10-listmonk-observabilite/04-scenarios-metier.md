# F10 — Scénarios métier (E2E transverses)

> L'observabilité Listmonk se prouve **en situation d'incident** : un opérateur
> qui découvre une panne Listmonk doit la *voir*, *comprendre*, *agir en
> connaissance de cause* — pas envoyer une campagne à l'aveugle ni courir après
> des métriques gelées. Chaque scénario a un spec Playwright contre l'instance
> dédiée `femiglow_emailqa` + Listmonk volontairement MORT (port 9999, suite
> `emails-degraded.spec.ts`). Oracles strictement binaires, vue opérateur.
> **JAMAIS contre la prod.**

---

## SM-F10-01 — « La panne Listmonk un matin de campagne » (lignes E2E : F10-E-061)

**Persona** : Khadija, ops, doit lancer la campagne « Été 2026 » ce matin.
Listmonk est tombé pendant la nuit (verrou DB / vhost down).

**Préconditions**
- Instance e2e avec Listmonk pointé sur un **port mort** (9999) → tous les
  appels client lèvent `ListmonkTimeoutError`.
- 1 campagne `sending` « Printemps » avec un `last_sync_ok_at` d'hier soir et
  un `last_sync_error` fraîchement écrit (timeout) ; `last_sync_attempt_at`
  postérieur à `ok`.
- Une audience FemiGlow « Clientes actives » existe (repli natif).

**Déroulé**
1. Khadija ouvre `/admin/emails` (dashboard).
   → **Lit** : HealthBadge **jaune/rouge** ; en déroulant, « Listmonk : ✗
     injoignable » et « Sync campagnes : ✗ … ». Elle *comprend* l'incident.
2. Elle ouvre la liste campagnes.
   → **Voit** : la ligne « Printemps » porte « ⚠ sync en échec » à côté de
     son statut « En cours d'envoi ».
3. Elle démarre la création d'« Été 2026 », arrive à l'étape 2 (audience).
   → **Lit** : un message « Listmonk est indisponible (timeout) — les listes ne
     peuvent pas être chargées. [Réessayer] Vous pouvez utiliser une audience
     FemiGlow. » Le hint « Crée-en une » **n'apparaît pas**.
4. Elle sélectionne l'audience FemiGlow « Clientes actives » et **continue le
   wizard normalement** (le wizard reste pleinement utilisable).
5. Décision métier : voyant l'incident, elle **reporte** l'envoi de masse plutôt
   que de tirer à l'aveugle, et alerte l'infra.

**Oracles** : (a) le HealthBadge n'est PAS vert (degraded ou incident) ;
(b) la ligne « Printemps » affiche « sync en échec » ; (c) à l'étape 2, le
message d'indispo + bouton Réessayer sont visibles ET le texte « Crée-en une »
est absent du DOM ; (d) le wizard avance jusqu'à l'étape suivante avec une
audience FemiGlow (pas de blocage). **Reprise** : Listmonk remis en route,
le bouton « Réessayer » du wizard recharge les listes (cases apparaissent).

---

## SM-F10-02 — « Les métriques gelées depuis hier » (lignes E2E : F10-E-062)

**Persona** : Younes, ops, regarde les chiffres d'une campagne lancée hier et
les trouve figés (ouvertures bloquées à un nombre rond).

**Préconditions**
- 1 campagne `sending` « Newsletter mai » dont `last_sync_ok_at` date d'il y a
  3 h (> seuil 1 h) et `last_sync_error` est renseigné (Listmonk a renvoyé un
  503 lors du dernier poll). Listmonk port mort à ce stade.

**Déroulé**
1. Liste campagnes → la ligne « Newsletter mai » porte « ⚠ métriques périmées
   (>1h) » (ou « sync en échec » si l'erreur prime).
2. Younes ouvre le détail.
   → **Lit** : bandeau role=alert « Dernier essai {date} : {message d'erreur} —
     métriques potentiellement périmées. [Réessayer maintenant] ».
3. Il clique « Réessayer maintenant ».
   → **Lit** : le bouton passe « Synchronisation… » (disabled), puis — Listmonk
     toujours mort — un **toast erreur rouge persistant** s'affiche ; le bandeau
     d'échec **reste** ; **aucun** chiffre ne change (pas de faux succès).
4. Le message d'erreur est lisible (timeout / 503), pas un spinner figé ni un
   « réussi » mensonger. Il **escalade à l'infra** avec la cause exacte.
5. (Reprise) Listmonk revient → nouveau « Réessayer maintenant » → toast vert,
   le bandeau disparaît, les métriques se rafraîchissent.

**Oracles** : (a) le badge périmé/échec est visible en liste ET en détail ;
(b) « Réessayer » émet **un seul** POST (pas de double sur double-clic) ;
(c) en échec : toast role=alert persistant + bandeau conservé + zéro chiffre
modifié ; (d) le message affiché contient la cause (timeout/HTTP), jamais un
« opération réussie ».

---

## SM-F10-03 — « La campagne créée dans Listmonk natif, introuvable » (lignes E2E : F10-E-063)

**Persona** : Sara, marketing, a créé hier une campagne directement dans
l'admin Listmonk natif (via la page iframe) et la cherche aujourd'hui dans
`/admin/emails/campaigns` — sans la trouver (elle n'a pas de
`email_campaign_link`). C'est le piège classique.

**Préconditions**
- `LISTMONK_PUBLIC_URL` **défini** sur l'instance e2e (iframe rendue).
- Aucune campagne FemiGlow correspondant au nom Listmonk natif.

**Déroulé**
1. Sara ouvre `/admin/emails/listmonk`.
   → **Lit**, au-dessus de l'iframe, le bandeau « ⚠ Vous éditez dans Listmonk
     natif — les campagnes créées ici ne sont **PAS** visibles dans /campaigns. »
2. Elle comprend immédiatement pourquoi sa campagne d'hier n'apparaît pas dans
   le cockpit FemiGlow : elle a été créée hors du flux FemiGlow.
3. Le bouton « Ouvrir dans un nouvel onglet » est **actif** (env défini) et
   pointe vers `${LISTMONK_PUBLIC_URL}/admin/...` (issue de secours digne).

**Oracles** : (a) le bandeau piège est visible et lisible au-dessus de l'iframe ;
(b) avec env, le bouton nouvel onglet est actif avec un `href` non vide vers
l'origine publique ; (c) la page SSR rend (heading « Listmonk » présent) même
si le contenu de l'iframe ne charge pas (Listmonk down) — **jamais un 500**.

**Variante sans env** (couverte par F10-C-049/050) : bouton désactivé +
tooltip + message orienté ops « Voir le runbook listmonk-subdomain » au lieu de
l'instruction `.env` brute.

---

## Mapping E2E ↔ batterie

| Scénario | Spec | Lignes batterie | Suite |
|---|---|---|---|
| SM-F10-01 | `SM-F10-01.spec.ts` | F10-E-061 (+ couvre C-022/023/038/039) | emails-degraded |
| SM-F10-02 | `SM-F10-02.spec.ts` | F10-E-062 (+ couvre C-026/030/033) | emails-degraded |
| SM-F10-03 | `SM-F10-03.spec.ts` | F10-E-063 (+ couvre C-048/051) | emails-degraded |
| a11y | `SM-F10-axe.spec.ts` | F10-A-064 | emails-degraded |

**Note d'intégration suite** : `emails-degraded.spec.ts` étend déjà DEGRADED-01
(page Listmonk digne malgré Listmonk down). SM-F10-01/02/03 **complètent** cette
suite — on conserve DEGRADED-01 et on lui ajoute les oracles d'observabilité
(badge, sync, bandeau piège) plutôt que de la réécrire.
