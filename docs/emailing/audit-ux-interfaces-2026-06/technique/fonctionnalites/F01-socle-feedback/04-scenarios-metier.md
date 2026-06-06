# F01 — Scénarios métier (E2E transverses)

> Le socle ne se teste pas seulement composant par composant : il se prouve **en
> situation**, quand un opérateur enchaîne des gestes réels sur plusieurs écrans.
> Chaque scénario a un spec Playwright (`SM-F01-nn.spec.ts`) contre l'instance
> dédiée `femiglow_emailqa` + Mailpit — JAMAIS la prod.
> Oracles strictement binaires et observables à l'écran.

---

## SM-F01-01 — « L'opérateur pressé » (lignes E2E : F01-E-073)

**Persona** : Khadija, ops, traite la file un lundi matin, veut aller vite.
**Préconditions** : 1 campagne `paused`, 5 entrées DLQ relançables, 2 entrées
suppression-list. Aucun `window.confirm` natif ne doit jamais paraître.

**Déroulé**
1. Cockpit transactionnel : filtre `DLQ`, coche 3 lignes, clique « Relancer (3) ».
   → **Lit** : un ConfirmDialog (pas une popup navigateur) ; le focus est sur Annuler.
2. Clique « Relancer ».
   → **Lit** : toast vert « 3 emails relancés ». La sélection est vidée.
3. Attend ~4 s sans rien faire.
   → **Voit** : le toast a disparu seul.
4. Va sur la page Campagnes › la campagne `paused`, clique « Reprendre ».
   → **Lit** : ConfirmDialog ; confirme ; toast vert « Campagne reprise ».
5. Va sur Suppression, retire 1 adresse.
   → **Lit** : toast vert « adresse retirée ».

**Oracles** : (a) 0 dialog natif observé sur tout le parcours ; (b) 3 toasts succès
lisibles formulés résultat ; (c) chaque toast succès disparu à 4 s ; (d) aucune
sélection résiduelle après chaque mutation.

---

## SM-F01-02 — « La fausse manip » (lignes E2E : F01-E-074)

**Persona** : Younes, junior, clique vite et se ravise tout le temps.
**Préconditions** : 1 audience supprimable, 1 campagne annulable, 1 entrée DLQ.
On capture les compteurs DB avant le scénario.

**Déroulé**
1. Audiences › « Supprimer » → ConfirmDialog → **appuie Échap**.
2. Campagnes › « Annuler la campagne » → ConfirmDialog → **clique sur le fond
   assombri** (backdrop).
3. Cockpit › sélectionne 60 lignes DLQ → « Supprimer » → ConfirmDialog avec champ
   de saisie → tape « SUPPRIM » (incomplet) → le bouton reste désactivé → **clique
   Annuler**.
4. Re-tente la suppression d'audience → ConfirmDialog → **Tab plusieurs fois** puis
   Échap (vérifie que le focus n'a jamais quitté le dialog).

**Oracles** : (a) chaque dialog se ferme sans action ; (b) **les compteurs DB sont
identiques à l'état initial** (audiences, campagnes, outbox) ; (c) à l'étape 3 le
bouton Supprimer reste désactivé tant que la saisie ≠ « SUPPRIMER » ; (d) après
chaque fermeture le focus est revenu sur le bouton déclencheur.

---

## SM-F01-03 — « L'onglet oublié » (lignes E2E : F01-E-075)

**Persona** : Sara laisse le dashboard emailing ouvert et part en réunion 2 h.
**Préconditions** : dashboard avec Freshness auto-refresh (intervalle 60 s),
horloge contrôlée côté test.

**Déroulé**
1. Ouvre `/admin/emails`. → **Lit** « Données à jour … il y a 0 s · Africa/Casablanca ».
2. Le test masque l'onglet (`visibilitychange` hidden) et avance l'horloge de 2 h.
   → Pendant ce temps **aucune requête de refresh ne part** (réseau silencieux).
3. Le test ré-affiche l'onglet (visible).
   → **Lit** : l'âge affiché est « il y a 2 h » (honnête, pas « il y a 0 s »).
4. Immédiatement après le retour : un refresh part, l'âge repasse à « il y a 0 s ».

**Oracles** : (a) 0 requête réseau pendant l'onglet caché ; (b) l'âge lu au retour
correspond à la durée réelle d'absence ; (c) un seul refresh déclenché au retour ;
(d) la TZ reste affichée littéralement à tout instant.

---

## SM-F01-04 — « Le wizard interrompu » (lignes E2E : F01-E-076)

**Persona** : Karim crée une campagne, arrive à l'étape 3 (contenu), et le
navigateur recharge (F5 accidentel / crash onglet).
**Préconditions** : flux de création de campagne adoptant `Wizard`/`useWizard` avec
`persistKey` + autosave.

**Déroulé**
1. Démarre une création, remplit l'étape 1 (nom), avance via Ctrl+→.
2. Étape 2 (audience), sélectionne, avance. Étape 3 (contenu), saisit du HTML.
3. **Recharge la page (F5).**
4. → **Voit** : le wizard rouvre directement sur l'étape 3, le HTML saisi est
   présent, les étapes 1-2 sont marquées validées et cliquables.
5. Clique l'étape 1 → revoit le nom saisi ; revient à l'étape 3 par Ctrl+→ ×2.

**Oracles** : (a) après F5 l'étape affichée est l'étape 3 (`aria-current="step"`) ;
(b) le contenu saisi est restitué ; (c) les étapes validées sont cliquables, les
futures inertes ; (d) si on tente d'avancer depuis une étape rendue invalide,
l'avancée est bloquée et un message apparaît près du bouton Suivant.

---

## SM-F01-05 — « Le réseau qui lâche » (lignes E2E : F01-E-077)

**Persona** : Inès relance la DLQ pendant un incident Listmonk intermittent.
**Préconditions** : suite `emails-degraded` ; 4 lignes DLQ sélectionnées ; le
premier POST bulk-retry renvoie 500, le second réussit.

**Déroulé**
1. Sélectionne 4 lignes, « Relancer (4) », confirme.
2. → **Lit** : toast erreur ROUGE persistant « Échec du relancement. Réessayez. »
   La sélection des 4 lignes est toujours là.
3. Attend 6 s. → Le toast erreur est **toujours** affiché.
4. Clique « Réessayer » sur le toast.
5. → **Lit** : toast vert « 4 emails relancés » ; la sélection est vidée.

**Oracles** : (a) aucun toast succès n'apparaît tant que la réponse n'est pas `ok` ;
(b) le toast erreur ne disparaît pas seul ; (c) « Réessayer » rejoue avec **les 4
mêmes ids** ; (d) la sélection est préservée entre l'échec et le retry, vidée après
succès.
