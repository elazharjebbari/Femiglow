# F01 — Socle de feedback & d'interaction — fonctionnement optimal

> Périmètre : SOC-F01..SOC-F08. Le socle est la **bibliothèque partagée**
> `src/components/admin/emails/ui/`. Tout écran emailing en hérite ; aucun écran
> ne réimplémente un dialog, un toast, une pastille ou une garde de sortie.
> Problèmes d'audit verrouillés : TRV-01, TRV-02, TRV-05, TRV-07, TRV-08, TRV-09,
> TRV-10, DASH-07, DASH-08.
>
> Deux lecteurs : **l'opérateur** (ce qu'il voit/perçoit/peut faire au clavier) et
> **le développeur consommateur** (l'API à appeler, les invariants garantis).

---

## SOC-F01 — `ConfirmDialog`

### Pour l'opérateur
- Tout geste destructif (supprimer, annuler une campagne, vider, retirer de la
  suppression-list) ouvre un panneau modal centré, sur fond assombri.
- Le **focus arrive sur « Annuler »** : un Entrée réflexe ne détruit RIEN.
- Le titre énonce le verbe (« Supprimer cette audience ? »), le corps énonce les
  **conséquences exactes** (« 3 destinataires distincts seront retirés. Les
  snapshots sont conservés. Action irréversible. »).
- Le bouton d'action porte le **verbe** (« Supprimer », « Annuler la campagne »),
  jamais « OK ». En variante `danger` il est rouge (token `danger`).
- `Esc` ferme sans agir. Un clic sur le fond assombri (backdrop) ferme sans agir.
- Le **focus est piégé** dans le dialog (Tab ne sort pas vers la page derrière).
- Pour un geste **massif irréversible (> 50 éléments)** : un champ de saisie de
  confirmation apparaît (« Tapez SUPPRIMER pour confirmer ») ; le bouton d'action
  reste désactivé tant que la saisie ne correspond pas (insensible à la casse et
  aux espaces de bord).
- Pendant la mutation : le bouton d'action affiche « Suppression… », est désactivé,
  `aria-busy` ; **un double-Entrée ou double-clic n'émet qu'UNE requête**.
- En cas d'échec réseau : le dialog **reste ouvert**, un message `role="alert"`
  s'affiche DANS le dialog, la saisie de confirmation est préservée.
- À la fermeture (succès, Esc, Annuler, backdrop) : le **focus retourne sur
  l'élément déclencheur** (le bouton qui a ouvert le dialog).

### Pour le développeur
- API : `confirm({ title, body, confirmLabel, variant?, requireText?, onConfirm })`
  via hook `useConfirm()` (ou composant contrôlé `<ConfirmDialog open onConfirm onCancel/>`).
- `variant: 'default' | 'danger'` (défaut `default`).
- `requireText?: string` → active la saisie de confirmation ; absent = pas de champ.
- `onConfirm` peut être async ; le dialog gère lui-même l'état busy et reste ouvert
  si la promesse rejette (le consommateur lève pour signaler l'échec).
- Rendu via portal ; `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (titre),
  `aria-describedby` (corps).

### Liste de contrôle (UI/UX/a11y/data)
focus initial Annuler · Esc ferme · backdrop ferme · focus piégé · focus rendu au
déclencheur · libellé = verbe · variante danger rouge · conséquences explicites ·
saisie de confirmation > 50 · bouton désactivé tant que saisie ≠ · busy + aria-busy ·
1 seule requête sur double-déclenchement · échec garde le dialog ouvert + alert ·
contraste ≥ 4.5:1 · `aria-modal` lu par le lecteur d'écran.

---

## SOC-F02 — `ToastProvider` / `useToast`

### Pour l'opérateur
- Après une mutation réussie : une carte **verte** apparaît en bas/coin, formulée
  RÉSULTAT (« 3 emails relancés », « Audience supprimée »), JAMAIS « opération
  effectuée ». Elle **disparaît seule après 4 s exactement**.
- Après un échec : une carte **rouge persistante** (ne disparaît pas seule),
  message actionnable (consigne : « Listmonk injoignable. Réessayez dans un
  instant. »), avec un bouton **« Réessayer »** qui **rejoue la MÊME action avec
  le MÊME état** (sélection/saisie préservées).
- Plusieurs toasts **s'empilent** (le plus récent en haut de la pile) ; au-delà de
  3, le plus ancien succès est évincé ; les erreurs ne sont jamais évincées
  automatiquement.
- Un bouton « Fermer » (croix, `aria-label="Fermer"`) sur chaque toast.
- **Aucun toast succès n'apparaît si la réponse n'est pas `ok`** (zéro faux succès).

### Pour le développeur
- API : `const { success, error } = useToast()`.
  - `success(message: string, opts?: { duration?: number })` — défaut 4000 ms.
  - `error(message: string, opts?: { onRetry?: () => void })` — persistant ; si
    `onRetry` fourni, rend le bouton Réessayer.
- `ToastProvider` placé UNE seule fois dans `layout.tsx` ; expose **une seule**
  région `aria-live="polite"` (succès) + `role="alert"` pour les erreurs.
- Le timer succès utilise un timer réel annulable (testé sous fake timers à 4 s).

### Liste de contrôle
toast succès vert · auto-dismiss 4 s exact · libellé résultat (pas générique) ·
toast erreur rouge persistant · bouton Réessayer rejoue la même action · empilement
ordonné · cap 3 (éviction succès le + ancien) · 1 seule live-region polite (pas de
spam SR) · erreurs en `role="alert"` · fermeture manuelle · **pas de succès sur
`res.ok === false`** · pas de collision avec les live-regions existantes du cockpit.

---

## SOC-F03 — `EmptyState`

### Pour l'opérateur
- Une liste vide n'affiche JAMAIS un tableau nu : une zone centrée avec icône
  (décorative, `aria-hidden`), **titre** (« Aucune campagne »), **explication du
  POURQUOI** (« Aucune campagne ne correspond au filtre `statut:sending`. »), et
  une **action suivante** (« Réinitialiser le filtre » / « Créer une campagne »).
- Distingue « vide parce que rien n'existe » de « vide parce que filtré » (deux
  textes différents).

### Pour le développeur
- API : `<EmptyState icon? title body cta?={{ label, onClick | href }} />`.
- `role="status"` sur le conteneur (annoncé une fois).

### Liste de contrôle
titre présent · explication du pourquoi · CTA actionnable · icône `aria-hidden` ·
variante filtré ≠ variante vide-absolu · pas de tableau fantôme.

---

## SOC-F04 — `Freshness` (âge + TZ + auto-refresh)

### Pour l'opérateur
- Affiche l'âge **relatif** de la donnée (« il y a 12 s », « il y a 3 min »,
  « il y a 2 h ») et l'heure absolue avec **fuseau explicite**
  (« 14:03 Africa/Casablanca »).
- En mode auto-refresh : la donnée se rafraîchit toute les N secondes ; l'âge se
  remet à « il y a 0 s ». Un bouton « ↻ Rafraîchir » force le refresh ; pendant le
  refresh, libellé « Rafraîchissement… » + désactivé.
- **Onglet caché** (l'opérateur part 2 h sur un autre onglet) : l'auto-refresh est
  **suspendu** (pas de polling en arrière-plan) ; au retour (`visibilitychange`
  visible) l'âge affiché est **honnête** (« il y a 2 h ») et un refresh immédiat
  est déclenché — jamais un « il y a 5 s » mensonger.

### Pour le développeur
- API : `<Freshness generatedAt={iso} timeZone="Africa/Casablanca"
  autoRefresh?={{ intervalMs, onRefresh }} />`.
- L'âge se réévalue au tick (timer interne) ; suspendu si `document.hidden`.
- TZ par défaut `Africa/Casablanca` ; l'heure affichée passe par un formateur TZ
  centralisé (pas de `toLocaleString` direct — règle lint §verrouillages).

### Liste de contrôle
âge relatif correct (12 s / 3 min / 2 h) · TZ affichée littéralement · `<time
datetime>` machine-lisible · auto-refresh au bon intervalle · **suspendu onglet
caché** · reprise + refresh immédiat au retour · âge honnête après veille · bouton
busy anti double-clic · `role="status"` `aria-live="polite"`.

---

## SOC-F05 — `Wizard` partagé / `useWizard`

### Pour l'opérateur
- Barre d'étapes en haut ; une étape **déjà validée est cliquable** (retour
  arrière instantané) ; une **étape future est refusée** (non cliquable / inerte)
  tant que les précédentes ne sont pas valides.
- `Ctrl+→` avance (si l'étape courante est valide), `Ctrl+←` recule.
- À chaque changement d'étape, le **focus se pose sur le titre de l'étape** (le
  lecteur d'écran annonce où l'on est).
- Si on tente d'avancer avec une étape invalide : l'avancée est **bloquée** et un
  message d'erreur apparaît **près du bouton Suivant** (pas en haut de page hors
  champ de vision).
- L'**étape courante est persistée** (autosave hook) : un F5 en étape 3 rouvre en
  étape 3 avec les données saisies.

### Pour le développeur
- API : `const wizard = useWizard({ steps, persistKey?, onAutosave? })`.
  Expose `current`, `goTo(i)` (refusé si i > maxValidated+1), `next()`, `prev()`,
  `isStepValid(i)`, `maxValidated`.
- `<Wizard>` rend la barre, gère focus + raccourcis + persistance (localStorage ou
  via `onAutosave` server action debouncée).

### Liste de contrôle
étape validée cliquable · étape future inerte · Ctrl+←/→ · focus au titre à chaque
étape · validation bloque + message PRÈS du bouton · persistance étape + données ·
reprise exacte après F5 · `aria-current="step"` sur l'étape active.

---

## SOC-F06 — `Pill` + `STATUS_META` unifié (TRV-07, DASH-07)

### Pour l'opérateur
- Tout statut affiché (outbox, campagne) est une **pastille FR unique et
  cohérente** : le dashboard et le cockpit affichent EXACTEMENT le même libellé et
  la même couleur pour `bounced_permanent` (« Bounce perm. »), fin de la
  double-vérité où le cockpit montrait le slug anglais brut.
- Un statut inconnu rend « Inconnu » (neutre), jamais la chaîne technique.

### Pour le développeur
- `<Pill tone="success|warning|danger|info|neutral" label />` + maps de domaine
  (`STATUS_META` outbox, `CAMPAIGN_STATUS_META`).
- **`STATUS_META` doit être exhaustif vs l'enum `email_outbox_status`** : un statut
  ajouté au schéma sans entrée casse un test de contrat statique (TRV-07).
- `KpiCards` cesse de dupliquer son propre mapping et réexporte / consomme le map
  unique (DASH-07).

### Liste de contrôle
1 libellé FR par statut, identique partout · couleurs par `tone` sémantique ·
inconnu → « Inconnu » · **exhaustivité enum ↔ STATUS_META** · plus de doublon
KpiCards · `role="status"` sur la pastille.

---

## SOC-F07 — `use-dirty-guard`

### Pour l'opérateur
- Un formulaire « sale » (modifié non enregistré) protège contre la perte : si
  l'opérateur **ferme l'onglet / recharge**, le navigateur affiche son invite
  native `beforeunload` (« Quitter le site ? »).
- Si l'opérateur **navigue dans l'app** (clic sur un autre onglet emailing), un
  `ConfirmDialog` intercepte (« Modifications non enregistrées — Quitter sans
  enregistrer ? »).
- Après un **enregistrement réussi**, la garde est **désarmée** : on peut quitter
  sans invite.

### Pour le développeur
- API : `useDirtyGuard(isDirty: boolean, { message? })`.
  Pose/retire le handler `beforeunload` et intercepte la navigation Next
  (App Router) tant que `isDirty`.

### Liste de contrôle
`beforeunload` armé quand sale · navigation in-app interceptée (ConfirmDialog) ·
désarmé après save · pas d'invite si propre.

---

## SOC-F08 — Tokens sémantiques + test de verrouillage

### Pour l'opérateur (indirect)
- Cohérence chromatique : `success`=emerald, `danger`=rose, `warning`=amber,
  `info`=sky — un seul vert, un seul rouge, un seul bleu partout. Fin des mélanges
  sage/emerald, rose/red, sky/blue qui faisaient lire « deux états » là où il n'y
  en a qu'un.

### Pour le développeur
- Les `tone` de `Pill`/dialog/toast tirent leurs classes d'un objet `tokens`
  central. **Aucune classe `sage-`, `red-`, `blue-`** ne doit apparaître dans
  `components/admin/emails/**` (hors liste blanche). Un test U (grep/AST) échoue
  sinon.

### Liste de contrôle
4 tokens sémantiques uniques · contrastes ≥ 4.5:1 · test anti `sage-/red-/blue-`
vert · liste blanche documentée et minimale.
