# Typography

## 1. Familles de polices

| Rôle | Famille | Fallback | Source |
|---|---|---|---|
| Sans (UI) | `Inter` | `system-ui, -apple-system, sans-serif` | Google Fonts, self-host |
| Serif (titres marketing) | `Fraunces` | `Georgia, serif` | Google Fonts (rarement utilisé en admin) |
| Mono (JSON, IDs, code) | `JetBrains Mono` | `Menlo, Consolas, monospace` | Google Fonts, self-host |
| Arabe | `Tajawal` | `'Noto Sans Arabic', sans-serif` | Google Fonts (i18n ar) |

Inter est la police par défaut sur tout l'admin. La serif Fraunces n'apparaît **pas** dans l'admin tracking (réservée au public-facing). La mono est utilisée pour : IDs (Pixel, GA4, Ads), JSON preview, codes d'erreur, hash de bundle.

## 2. Échelle typographique

Échelle modulaire ratio `1.250` (Major Third), base 16px.

| Token | rem | px | Usage |
|---|---|---|---|
| `text-xs` | 0.75 | 12 | Helper text, labels secondaires, badges |
| `text-sm` | 0.875 | 14 | Body texte UI dense, table cells |
| `text-base` | 1 | 16 | Body texte par défaut |
| `text-lg` | 1.125 | 18 | Subtitles |
| `text-xl` | 1.25 | 20 | Section titles (H3) |
| `text-2xl` | 1.5 | 24 | Page sub-headers (H2) |
| `text-3xl` | 1.875 | 30 | Page headers (H1) |
| `text-4xl` | 2.25 | 36 | Hero (rare en admin) |

Line-height :
- Display (≥ `text-2xl`) : `1.2` (compact)
- Body : `1.5` (lisibilité)
- Tight (badges, mono) : `1.3`

## 3. Poids

| Poids | Valeur | Usage |
|---|---|---|
| Regular | 400 | Body texte |
| Medium | 500 | Labels, boutons secondary |
| Semibold | 600 | Titres H2/H3, boutons primary, badges |
| Bold | 700 | H1, mise en valeur ponctuelle |

Pas d'italic en UI admin (réservé aux citations marketing).

## 4. Hiérarchie typographique appliquée

### Page tracking home
```
H1 (text-3xl semibold encre-900)   → "Tracking — État global"
H2 (text-xl semibold encre-900)    → "Plan actif", "Synchronisation client", "Historique"
Body (text-base regular encre-700) → Descriptions, libellés
Label (text-xs medium stone-700)   → "Mis à jour il y a 2 min"
Badge (text-xs semibold)           → "Actif", "v8", "OK"
```

### Wizard step
```
H1 (text-2xl semibold encre-900)   → "Étape 2 — Identifiants des outils"
H2 (text-lg semibold encre-900)    → Nom du provider ("Meta Pixel")
H3 (text-base medium stone-700)    → Nom du champ ("Pixel ID")
Helper (text-xs regular stone-500) → "Format attendu : 15-16 chiffres"
Error (text-xs medium brique-600)  → "Pixel ID invalide"
Mono (text-sm regular mono)        → Valeur saisie ID
```

### JSON preview
```
Lines (text-xs regular mono creme-50 sur fond #0E1622)
Highlight (text-xs semibold sauge-400) → Clés JSON modifiées
```

## 5. Espacements verticaux

Suit l'échelle Tailwind. Patterns :

| Pattern | Espacement |
|---|---|
| Entre H1 et premier paragraphe | `mt-6` (24px) |
| Entre paragraphes | `mt-4` (16px) |
| Entre label et input | `mt-1` (4px) |
| Entre input et helper text | `mt-1` (4px) |
| Entre champs d'un même groupe | `gap-4` (16px) |
| Entre sections d'une page | `gap-8` (32px) |

## 6. Caractères spéciaux et accessibilité

- **Accents français** : tous préservés (à, é, è, ê, ë, î, ï, ô, ù, û, ç).
- **Espace insécable** avant `:`, `?`, `!`, `;` (typographie française).
- **Apostrophe typographique** `'` plutôt que `'` (rendu serif-quality dans Inter).
- **Tirets** : tiret cadratin `—` pour énumérations, demi-cadratin `–` pour intervalles, trait d'union `-` pour mots composés.
- **Guillemets français** : `«   »` avec espaces insécables pour les citations longues.

## 7. Texte tronqué

Long IDs ou noms de plan peuvent excéder l'espace disponible.

| Cas | Stratégie |
|---|---|
| Nom de plan en liste | `truncate` (1 ligne) + tooltip au hover montrant le nom complet |
| Pixel ID dans card | Affichage complet, font mono, wrap si trop long |
| JSON preview ligne longue | Wrap doux (overflow-x scroll, mais wrap par défaut) |
| Toast message | Max 2 lignes, ensuite "… [Détails]" qui ouvre une modale |

## 8. Internationalisation

### Français (par défaut)
- Direction : LTR
- Police : Inter
- Particularités : espace insécable, casse phrase pour titres (pas Title Case).

### Arabe
- Direction : RTL
- Police : Tajawal
- Particularités :
  - Mirror du layout (icônes, marges).
  - Pas de capitalisation (langue sans casse).
  - Ne pas tronquer les mots arabes au milieu (ils sont attachés).
  - Tester `text-justify: inter-word` désactivé.

### Mélange (admin avec sigles anglais)
- Sigles type "GA4", "GTM", "ID" restent en latin même dans un texte arabe.
- Direction du paragraphe arabe maintenue, les sigles s'insèrent naturellement.
