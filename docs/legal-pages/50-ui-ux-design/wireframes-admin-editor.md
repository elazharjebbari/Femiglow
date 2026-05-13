# 50.4 — Wireframe : éditeur admin

## Vue : `/admin/legal/cgv/edit`

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◀ Admin / Pages légales / CGV     ⏳ Édition · v5      💾 Enr. 12s · 🚀 ▾ │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────┬───────────┬──────────┬──────┬──────────┬────────────┐            │
│ │ ✏    │           │          │      │          │ Zone       │            │
│ │ Cont.│ Métadon.  │Placement │ SEO  │ Histoir. │ ⚠ danger   │            │
│ └──────┴───────────┴──────────┴──────┴──────────┴────────────┘            │
├────────────────────────────────────────────────────────────────────────────┤
│ Markdown                                │ Aperçu                            │
│ ╔═══════════════════════════════════╗   │ ╔═══════════════════════════════╗ │
│ ║ # Conditions Générales de Vente   ║   │ ║ Conditions Générales de…      ║ │
│ ║                                   ║   │ ║                               ║ │
│ ║ > Les présentes Conditions…       ║   │ ║ ⟨ Les présentes Conditions … ⟩│ │
│ ║                                   ║   │ ║                               ║ │
│ ║ ## 1. Préambule                   ║   │ ║ 1. Préambule                  ║ │
│ ║                                   ║   │ ║                               ║ │
│ ║ Les présentes CGV s'appliquent à  ║   │ ║ Les présentes CGV s'appliquent│ │
│ ║ toute commande passée sur         ║   │ ║ à toute commande passée sur   ║ │
│ ║ {{SITE_URL}}, édité par           ║   │ ║ femiglow.ma ✓, édité par      ║ │
│ ║ {{COMPANY_NAME}}, RC {{RC}}…      ║   │ ║ FemiGlow Sàrl ✓, RC 123456 ✓  ║ │
│ ║                                   ║   │ ║                               ║ │
│ ║ ## 2. Produits                    ║   │ ║ ## 2. Produits…               ║ │
│ ║                                   ║   │ ║                               ║ │
│ ╚═══════════════════════════════════╝   │ ╚═══════════════════════════════╝ │
│ B I H1 H2 🔗 ≡ {{}}      Find: [____]  │ Aperçu en mode "Production" ▾    │
├────────────────────────────────────────────────────────────────────────────┤
│ 4 233 car. · 0 var manquante · 8 liens (1 vérif. en attente) · 💾 12s ago │
├────────────────────────────────────────────────────────────────────────────┤
│ [Annuler]        [Soumettre à revue]    [👁 Aperçu public]    [💾 Sauver] │
└────────────────────────────────────────────────────────────────────────────┘
```

## Variants par tab

### Tab "Métadonnées"

```
┌────────────────────────────────────────────────────┐
│  Titre :        [_Conditions Générales de Vente_] │
│  Slug :         [_conditions-generales-vente_]    │
│                 ⚠ Modifier le slug → redirect 301 │
│  Description :  [_Conditions d'achat sur…______]  │
│  Langue :       [Français ▾] (multi-lang en V2)   │
└────────────────────────────────────────────────────┘
```

### Tab "Placement"

```
┌─────────────────────────────────────────────────┐
│ Où afficher cette page ?                        │
│                                                 │
│ Footer                                          │
│ ☑ Footer principal               Position : 2  │
│ ☑ Footer bottom bar              Position : 2  │
│                                                 │
│ Menus                                           │
│ ☐ Menu mobile                                  │
│ ☐ Sidebar compte client                        │
│                                                 │
│ Cookies                                         │
│ ☐ Liens bannière cookies                       │
│                                                 │
│ Checkout                                        │
│ ☑ Consentement checkout         Position : 1   │
│ ☐ Page confirmation                            │
└─────────────────────────────────────────────────┘
```

### Tab "Historique"

```
┌────────────────────────────────────────────────────────┐
│ Historique (5 versions)                                │
│                                                        │
│ ✓ v5 · 11/05/2026 par Maya     [Voir diff]            │
│   "Ajout précision droit rétractation hygiène"        │
│                                                        │
│ ✓ v4 · 02/04/2026 par Maya     [Voir diff] [Restaurer]│
│ ✓ v3 · 15/03/2026 par Yassin   [Voir diff] [Restaurer]│
│ ✓ v2 · 10/02/2026 par Maya     [Voir diff] [Restaurer]│
│ ✓ v1 · 01/01/2026 par seeder   [Voir diff] [Restaurer]│
└────────────────────────────────────────────────────────┘
```

### Tab "SEO"

```
┌──────────────────────────────────────────────────┐
│ Indexer sur Google ?                             │
│ ◯ Non, exclure du SEO (recommandé)              │
│ ◯ Oui, indexer cette page                       │
│                                                  │
│ Les pages légales sont par défaut exclues.       │
│ N'activez que pour FAQ ou pages utiles SEO.      │
└──────────────────────────────────────────────────┘
```

### Tab "Zone danger"

```
┌──────────────────────────────────────────────────┐
│ ⚠ Zone dangereuse                                │
│                                                  │
│ Dépublier (passe en draft)                       │
│ La page redevient privée. À utiliser si problème │
│ critique détecté.                               │
│ [Dépublier]                                      │
│                                                  │
│ Archiver                                         │
│ Soft-delete. Les liens en footer sont retirés    │
│ automatiquement. Restaurable.                    │
│ [Archiver]                                       │
└──────────────────────────────────────────────────┘
```

## Publication flow

```
        ┌─────────────────────────────────────────┐
Click → │ Publier la version 6 ?                  │
"Publier"│                                         │
        │ ⚠ Cette action est définitive            │
        │   Une version immutable sera créée       │
        │                                          │
        │ Checklist :                              │
        │ ☑ J'ai relu intégralement                │
        │ ☑ Toutes les variables sont remplies     │
        │ ☑ Les liens internes ont été testés      │
        │ ☑ La date est correcte                   │
        │                                          │
        │ Tapez "PUBLIER" pour confirmer :         │
        │ [______________________]                 │
        │                                          │
        │ [Annuler]         [🚀 Publier v6]        │
        └─────────────────────────────────────────┘
```

## Variable highlighting

Dans le pane aperçu :
- `{{COMPANY_RC}}` résolu en `RC 123456` (vert ✓)
- `{{MISSING_VAR}}` reste affiché en rouge avec icône ⚠

Cliquer sur ⚠ → ouvre drawer "Variables template" pour remplir.

## Lock indicator

```
┌────────────────────────────────────────────────────────┐
│ 👤 Yassin édite cette page depuis 4 min               │
│    [Demander la main]  [Lecture seule]                │
└────────────────────────────────────────────────────────┘
```

Pessimistic lock, auto-release 15min.

## Auto-save indicator

States :
- `💾 Enregistré il y a 12s` (gris, normal)
- `💾 Enregistrement…` (gris, animation pulse)
- `⚠ Échec de sauvegarde (retry)` (amber)
- `✗ Erreur de sauvegarde — votre travail n'est PAS perdu` (red, action: copier le texte)
