# Architecture frontend — composants & responsabilités

> Modularité maximale : **un** hook de logique, **des** composants de présentation « bêtes ». Aucune duplication client/admin.

## 1. Arbre des composants

```
LocaleSwitcher                (orchestrateur léger, lit la config publique)
├── variant="dropdown"        → DropdownSwitcher (desktop header)
├── variant="pills"           → PillsSwitcher    (drawer mobile, footer)
└── variant="segmented"       → SegmentedSwitcher (A/B challenger, flag)
         │
         └─ tous appellent ──► useLocaleTransition().switchTo(target, surface)

LocaleVeil                     (overlay de fondu, piloté par hook.veil — fallback)
LocaleNudge                    (perle one-shot, reçoit `suggested` en prop SSR)
LiveAnnouncer                  (région aria-live polite, montée une fois)
```

## 2. Responsabilités (séparation stricte)

| Élément | Responsabilité | NE fait PAS |
|---|---|---|
| `useLocaleTransition` | Toute la logique de bascule (URL, dir/lang, VT/veil/reduced, events, fallback). | Aucun rendu. |
| `LocaleSwitcher` | Choisir la variante, lire la config (locales actives, endonymes, ordre), rendre. | Pas de logique de transition. |
| `DropdownSwitcher` / `PillsSwitcher` / `SegmentedSwitcher` | Présentation + a11y clavier locale + appel `switchTo`. | Pas de calcul d'URL ni de `dir`. |
| `LocaleVeil` | Animer l'overlay selon `hook.veil`. | Aucune décision. |
| `LocaleNudge` | Afficher la perle, gérer dismiss (cookie), émettre events nudge. | Pas de détection (faite serveur). |
| `LiveAnnouncer` | Annoncer le changement (INV-10). | Rien d'autre. |

## 3. Provenance des données

- **Config publique** (`locales`, `endonym`, `order`, `surfaces`, `nudge.enabled`) : `GET /api/i18n/config`, **résolue côté serveur** (SSR / RSC) et passée en props → **pas de flash**, pas de fetch client bloquant. Cache + ETag (cf. backend).
- **`suggested`** (pour le nudge) : `resolveSuggestedLocale()` côté serveur, prop SSR.
- **Locale active** : dérivée du `pathname` (1er segment).

## 4. Montage (où vivent les composants)

| Composant | Monté dans | Condition |
|---|---|---|
| `LocaleSwitcher` (dropdown) | `Header` | desktop ; **caché** `/admin/*` + wizard (INV-5) |
| `LocaleSwitcher` (pills) | `SommaireOverlay` (drawer), `Footer` | toujours (hors wizard) |
| `LocaleVeil` | `app/[locale]/layout.tsx` (client boundary) | rendu permanent, inactif par défaut |
| `LocaleNudge` | `Header` ou layout | si `suggested≠served` & non dismiss & nudge.enabled |
| `LiveAnnouncer` | layout (une fois) | toujours |

## 5. Modularité & réutilisation

- **Admin** réutilise `LocaleSwitcher` en mode **preview** (rendu FR/AR/EN sans navigation réelle) via une prop `previewLocale` — **zéro duplication**.
- Les variantes partagent un **sous-composant `LocaleItem`** (endonyme + état actif + a11y) pour garantir un rendu identique.

## 6. Éléments à vérifier / tester

- Rendu conditionnel correct (caché wizard/admin — INV-5).
- Config absente/invalide → **valeurs par défaut** (INV-12), switcher fonctionnel.
- Endonymes affichés dans la bonne écriture ; **0 latin** sur /ar (INV-6).
- Variante pilotée par config/flag (dropdown ↔ segmented) sans casse.
- `LiveAnnouncer` présent et unique (pas de doublon d'annonce).
- Preview admin n'altère **pas** la locale réelle de la page.
