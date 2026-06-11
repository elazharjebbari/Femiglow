# 03 — Frontend / UI / UX / Design

Modifications côté Next.js App Router (Server Components + Client Components).

## Fichiers

| Fichier | Contenu |
|---|---|
| [`pages-admin.md`](./pages-admin.md) | Diffs sur `/admin/chat/conversations`, `/admin/chat/leads`, `/admin/chat/audit` |
| [`components.md`](./components.md) | Nouveau `<SourceBadge />`, modification `<ChatAdminNav />` |
| [`design-tokens.md`](./design-tokens.md) | Tokens couleurs/typo/spacing pour badges et toggles |
| [`a11y-keyboard.md`](./a11y-keyboard.md) | Aria-labels, ordre tabulation, focus visible |

## Principes UX

1. **Sécurité par défaut** : la vue admin par défaut est "propre" (sans pollution). L'admin doit explicitement opt-in pour voir les ghosts (mode debug).
2. **Pédagogie** : afficher un message clair quand la liste est vide ("0 conversation chat — c'est normal après le fix").
3. **Traçabilité** : un badge "via wizard" sur tout lead `source=wizard_*` pour éviter la confusion future.
4. **Réversibilité** : le toggle "Inclure sessions sans messages" est dans l'URL (`?debug=ghosts`), facile à partager / bookmarker.

## Wireframe — `/admin/chat/conversations` (après fix)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Conversations                                                        │
│ ────────────────────────────────────────────────────────────────────│
│ ⓘ Affiche uniquement les conversations chat (≥1 message envoyé).   │
│   Pour voir les sessions wizard, cliquez "Inclure sessions sans     │
│   messages" ci-dessous.                                              │
│                                                                      │
│ ┌─[search]───┐ ┌─[lang]─┐ ┌─[status]─┐ ┌─[converted]─┐ [Filtrer]  │
│                                                                      │
│ ☐ Inclure sessions sans messages (debug)                            │
│                                                                      │
│ 12 conversations · converties : 3                                   │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ │  SESSION              PAGE   LANG  STATUT  OUVERTE   CONV   ││
│ │ ●│ cs_xxx (chat)          /kit   FR    open    11:51   Convertie││
│ │  │ cs_yyy (chat)          /     FR    open    14:20    —      ││
│ │  │ ...                                                           ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Wireframe — `/admin/chat/leads` (après fix)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Leads chat                                                           │
│ ────────────────────────────────────────────────────────────────────│
│ Capture in-chat (prénom + téléphone). Vue rapide ;                  │
│ pour leads ecommerce → /admin/leads.                                │
│ ⓘ Filtre actif : chat_widget + inline. Les leads wizard sont       │
│   exclus de cette vue (voir /admin/leads pour la vue fusionnée).   │
│                                                                      │
│ [Aperçu digest hebdo] [⬇ Exporter CSV]                              │
│                                                                      │
│ ┌─[outcome]─┐ ┌─[trigger]─┐ ☐ Hot only ☐ Inclure wizard [Filtrer] │
│                                                                      │
│ Total 5 · Pending 3 · Reached 0 · Converted 2 · Discarded 0         │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ PRÉNOM     TÉL          TRIG     OUTCOME  ATTENTE  PAGE  SOURCE││
│ │ Sara       +212...      explicit pending  2h       /kit  💬 chat││
│ │ Yasmine    +212...      inline   converted 5d      /     🔗 inline││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Wireframe — `/admin/leads` (global, INCHANGÉ visuellement mais badge source ajouté)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Leads                                                                │
│ 31 prospects au total                                                │
│ ...                                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ IDENTITÉ  CONTACT       VILLE       PARCOURS  WEBHOOK  STATUT   ││
│ │ yasmine   +212...        Casablanca  Achat    converted WIZARD ⚠️│
│ │ Sara      +212...        —           Lead     new       CHAT ✅ ││
│ └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Conventions de design

- **Couleurs cohérentes** avec la maison FemiGlow (stone, emerald, rose) — voir `design-tokens.md`.
- **Pas d'emoji dans le code** (cf. user instructions du projet). Les emojis ci-dessus sont uniquement illustratifs dans les wireframes — dans le code on utilise des SVG ou texte stylisé.
- **Pas de breaking change visuel** dans `/admin/leads` (vue globale).
- **A11y WCAG AA** : tous les nouveaux composants passent axe-core sans warnings.
