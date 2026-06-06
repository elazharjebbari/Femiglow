# Templates HTML `/admin/emails/templates` — fiche d'audit

**Fichiers** : `app/admin/emails/templates/**`, `components/admin/emails/templates/
{TemplateEditor,NewTemplateForm}.tsx`, `lib/mail/templates/custom/{render,
context-resolver,sanitize,schemas}.ts`
**Moteur** : Handlebars (échappement par défaut, pas de helpers custom) +
sanitization DOMPurify stricte (formulaires/scripts/iframes interdits, CSS
filtrée, data: limité aux images). Preview serveur avec contexte lead réel
(email saisi) ou mock ; cache de compilation LRU-50.
**Versionnage** : `email_template_custom_version` (n° incrémental, commit
message, restauration), miroir sur le parent.

## 1. État actuel — wireframes

**Liste** : table Slug(mono, lien) / Nom / Sujet / Modifié / Éditer — sans
recherche, tri ni pagination. Bouton `+ Nouveau template`.

**Création** : radio « Point de départ » (Vide | Default FemiGlow) + NOM +
SLUG (immuable, kebab-case auto) + SUJET (Handlebars) → `Créer le template`
→ redirect édition.

**Éditeur (3 colonnes)**
```
┌─ ← Templates · Bienvenue — onboarding J0 · welcome-j0 ──────────────────────┐
│ SOURCES (1fr)           │ PREVIEW (1fr)            │ PANNEAU (240px)         │
│ SUJET (Handlebars)      │ Preview avec contexte    │ VARIABLES DISPONIBLES   │
│ [Bienvenue {{firstName}}│ [lead@example.com] [↻]   │ {{firstName}}           │
│ PREHEADER (optionnel)   │ Sujet rendu :            │ {{lastName}} {{email}}  │
│ [_____________________] │  Bienvenue Fatima ✨     │ {{orderTotal}}          │
│ HTML SOURCE (8 432 car.)│ ┌──────────────────────┐ │ {{unsubscribeUrl}}      │
│ ┌─────────────────────┐ │ │                      │ │ ← 5 boutons sur 20+     │
│ │ <html>              │ │ │   iframe sandbox     │ │   variables réelles     │
│ │  <body>             │ │ │   h-520px            │ │   (append fin de source)│
│ │   …textarea nu      │ │ │   (desktop only)     │ │ ENREGISTRER             │
│ │   h-480px,          │ │ │                      │ │ [msg de commit________] │
│ │   pas de coloration │ │ └──────────────────────┘ │ [Créer une version]     │
│ └─────────────────────┘ │  debounce 600 ms         │ VERSIONS (7)            │
│ ▸ Variables custom JSON │                          │  v7 (actuelle)  05/06   │
│                         │                          │  v6 → confirm() restore │
└─────────────────────────┴──────────────────────────┴─────────────────────────┘
```

## 2. Variables : exposé vs réel

UI (5) : `firstName lastName email orderTotal unsubscribeUrl`
Moteur (20+) : + `fullName phone country language lastOrderId lastOrderDate
lastOrderTotal orderCount totalSpent today tomorrow dayOfWeek currentMonth
currentYear shopUrl accountUrl siteUrl trigger.eventName trigger.properties
customVars.*` — et `city`/`address` **toujours vides** (pas de colonne leads).
Aucune autocomplétion, aucune validation de variable inconnue (rend `''`).

## 3. Problèmes (cf. matrice)

`TPL-01` **pas d'autosave ni beforeunload (critique : perte de travail)** ·
`TPL-02` découverte des variables quasi nulle · `TPL-03` textarea nu ·
`TPL-04` pas de preview mobile · `TPL-05` pas de diff versions · `TPL-06`
pas de test send · `TPL-14` aucun avertissement « template utilisé par une
automation active » · `TPL-07..13` (curseur, delete, duplication, toast,
city/address, liste nue, aria) — cf. CSV.

## 4. Améliorations proposées (chantier C6) — wireframe cible

```
┌─ ← Templates · Bienvenue — onboarding J0 · welcome-j0 🔒                  ──┐
│ ⚠ Utilisé par 2 automations actives (welcome-flow, vip-flow) — vos          │ ← TPL-14
│   modifications s'appliqueront aux prochains envois. [voir]                  │
│ ✓ Brouillon auto-enregistré il y a 8 s        [Créer une version] [Tester ▾]│ ← TPL-01/06
├──────────────────────────┬───────────────────────────┬───────────────────────┤
│ ÉDITEUR (CodeMirror)     │ PREVIEW  [💻 Desktop][📱 Mobile 375px]            │ ← TPL-03/04
│  1 <html>                │ contexte : [lead@ex.com ▼] [↻]                    │
│  2  <body>               │ ┌───────────┐  ┌──────┐                           │
│  3   Bonjour {{firstNam█ │ │  desktop  │  │mobile│                           │
│      ┌──────────────────┐│ │           │  │      │                           │
│      │ firstName  Fatima ││ └───────────┘  └──────┘                           │
│      │ fullName   Fatima…││                                                   │
│      │ firstNa… ↵ insère ││ VARIABLES RÉSOLUES (contexte courant)             │ ← TPL-02
│      └──────────────────┘│  firstName=Fatima · orderCount=3 ·                │
│  ⚠ l.14 {{notClosed —    │  totalSpent=1 240 MAD · trigger=cart_abandoned…   │
│    expression non fermée │  (20+ entrées, cliquer = insérer au curseur)      │ ← TPL-07
├──────────────────────────┴───────────────────────────┴───────────────────────┤
│ VERSIONS   v7 (actuelle) · v6 [voir le diff] [restaurer]                      │
│ ┌─ Diff v6 → v7 ──────────────────────────────────────────┐                  │ ← TPL-05
│ │ - <h1>Bienvenue</h1>            + <h1>Bienvenue {{firstName}}</h1>        │
│ └──────────────────────────────────────────────────────────┘                  │
│ [Tester ▾] → M'envoyer un test (pipeline transactionnel) · choisir le lead   │
│ Liste : [Rechercher slug/nom___]  tri par colonnes  [Dupliquer] [Supprimer]  │ ← TPL-09/08/12
│   Supprimer → ConfirmDialog listant les automations bloquantes (l'API le     │
│   vérifie déjà — il ne manque que le bouton)                                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Ordre d'implémentation conseillé**
1. `TPL-01` autosave (localStorage par template id + restauration proposée) +
   beforeunload — protège immédiatement le travail, zéro risque.
2. `TPL-02` panneau variables complet : le preview retourne déjà
   `variablesResolved` — il suffit de l'afficher ; autocomplete `{{` ensuite.
3. `TPL-04` toggle mobile : largeur d'iframe, trivial.
4. `TPL-06` test send : réutiliser le pipeline outbox (idempotency key dédiée).
5. `TPL-03` CodeMirror, `TPL-05` diff (lib `diff` simple sur sources).
6. Nettoyage : retirer `city`/`address` du contexte (TPL-11), boutons
   Dupliquer/Supprimer, recherche liste.
