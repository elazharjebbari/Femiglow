# 06 — Design UI/UX admin SEO

Conception détaillée de l'interface admin SEO. Couvre architecture des écrans, composants, design tokens, états, accessibilité.

## 1. Architecture des écrans

### 1.1 Inventaire (existant + ajouts)

| Route | Existant | Évolution |
|---|---|---|
| `/admin/seo` | Liste paginée des overrides | Ajouter colonne « dernière action » + lien vers audit log |
| `/admin/seo/new` | Création | Inchangé |
| `/admin/seo/[id]` | Édition | Intégration du media picker phase 2, panel audit log phase 3 |
| `/admin/seo/settings` | Defaults globaux | Intégration media picker pour default OG |
| `/admin/seo/audit-log` | — | **Nouveau** phase 3 — liste paginée des audit events SEO |
| `/admin/products/[slug]/seo` | Édition imbriquée produit | Inchangé (utilise déjà `SeoOverrideEditor`) |

### 1.2 Architecture composant `SeoOverrideEditor`

Layout deux colonnes desktop, accordéon mobile.

```
+------------------------------------------------------+
|  En-tête : Cible (scope/targetKey/locale) verrouillée |
|  + bouton retour                                       |
+----------------------------+-------------------------+
|  Colonne gauche (form)     |  Colonne droite         |
|                            |                          |
|  - Title + counter         |  Preview SERP            |
|  - Description + counter   |  ----                   |
|  - Keywords (chips)        |  Preview Facebook       |
|  - OG title + description  |  ----                   |
|  - OG image (picker)       |  Preview Twitter        |
|  - Canonical               |  ----                   |
|  - Robots (index/follow)   |  Linter (score + items) |
|  - Twitter card            |                          |
|  - Structured data (adv.)  |                          |
+----------------------------+-------------------------+
|  Pied : Save | Publish | Unpublish | Delete | History  |
+------------------------------------------------------+
```

## 2. Nouveau composant — `OgImagePicker` (phase 2)

### 2.1 Comportement

Trois modes mutuellement exclusifs :

1. **Aucun** (default) : retombe sur fallback global de `seoSettings.defaultOgImageMediaId` ou template.
2. **Média uploadé** : choix via `MediaLibraryPicker` réutilisé du système existant.
3. **Template dynamique** (si flag `NEXT_PUBLIC_SEO_OG_DYNAMIC` actif) : choix de template + saisie title/eyebrow/theme.

### 2.2 Maquette texte

```
OG image
+---------------------------------------------+
| ( ) Aucun (utilise le défaut global)        |
| ( ) Image téléversée   [ Parcourir... ]     |
|     +---------------------+                  |
|     | Aperçu 240x126      |                  |
|     +---------------------+                  |
| ( ) Template dynamique                       |
|     Template : [ marketing v ]               |
|     Eyebrow  : [ Le rituel d'éclat ]        |
|     Theme    : [ sauge v ]                   |
|     +---------------------+                  |
|     | Aperçu dynamique    |                  |
|     +---------------------+                  |
+---------------------------------------------+
Aide : choisissez une image téléversée pour
un visuel précis, ou un template pour un
rendu cohérent qui s'adapte au titre.
```

### 2.3 Signature React

```tsx
// apps/web/src/components/admin/seo/OgImagePicker.tsx
export interface OgImagePickerValue {
  mode: 'none' | 'media' | 'template';
  mediaId?: string | null;
  template?: 'marketing' | 'article' | 'product' | 'default';
  templateParams?: { title?: string; eyebrow?: string; theme?: string };
}

export interface OgImagePickerProps {
  value: OgImagePickerValue;
  onChange: (next: OgImagePickerValue) => void;
  dynamicEnabled: boolean;             // flag NEXT_PUBLIC_SEO_OG_DYNAMIC
  fallbackPreviewUrl?: string | null;  // pour le mode 'none'
  inputId?: string;                     // a11y
  disabled?: boolean;
}
```

### 2.4 États

- **Loading** (chargement médiathèque) : skeleton 240×126.
- **Empty** (aucun média) : message « Aucune image téléversée. Importez-en une depuis Médias. »
- **Error** : message d'erreur inline + bouton retry.
- **Selected** : aperçu + bouton « Retirer ».

### 2.5 Accessibilité

- Radio group avec `role="radiogroup"` et `aria-labelledby`.
- Aperçu image avec `alt` descriptif (« Aperçu de l'image OG actuelle »).
- Bouton « Parcourir » associé à input file invisible mais focusable.
- Touche `Espace` toggle, `Tab` navigue entre modes.

## 3. Nouveau composant — `SeoAuditLogPanel` (phase 3)

### 3.1 Comportement

Affiche les 20 derniers `auditEvents` scope SEO, paginé par curseur. Filtres : action (publish, unpublish, delete, ...), actor.

```
Audit log SEO
+---------------------------------------------+
| Filtres : [ Toutes actions v ]  [ Tous v ]  |
+---------------------------------------------+
| 2026-05-19 14:32  Elazhar  publish          |
|   seo:product:le-kit (fr-MA)                |
|   diff : title modifié                       |
+---------------------------------------------+
| 2026-05-19 11:08  Yasmine  update           |
|   seo:component:kit-hero (fr-MA)            |
|   diff : ogImageTemplate=marketing          |
+---------------------------------------------+
| [ Charger plus ]                             |
+---------------------------------------------+
```

### 3.2 Signature

```tsx
export interface SeoAuditLogPanelProps {
  initialEvents: AuditEvent[];
  onLoadMore: (cursor: string) => Promise<{ events: AuditEvent[]; nextCursor: string | null }>;
  onSelectEvent?: (event: AuditEvent) => void;
}
```

### 3.3 Tri et regroupement

Tri par `createdAt` décroissant. Regroupement visuel par jour (sticky header de date).

## 4. Modifications phase 0 — `SeoBulkActionBar`

### 4.1 Modale de confirmation

Avant suppression bulk, ouvrir une modale demandant à l'utilisateur de **saisir le nombre attendu** d'éléments à supprimer.

```
Confirmer la suppression
+---------------------------------------------+
| Vous êtes sur le point de supprimer 12      |
| overrides SEO. Cette action est irréversible.|
|                                              |
| Pour confirmer, saisissez le nombre exact :  |
| +-----+                                      |
| | 12  |                                      |
| +-----+                                      |
|                                              |
| [ Annuler ]            [ Supprimer 12 items ]|
+---------------------------------------------+
```

Le bouton « Supprimer N items » est désactivé tant que la saisie ne correspond pas. Une fois cliqué, désactivation + spinner + appel API.

### 4.2 Signature

```tsx
export interface BulkDeleteConfirmDialogProps {
  open: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}
```

## 5. Design tokens et charte

### 5.1 Couleurs (palette FemiGlow)

- Sauge `#C5DBC4` — états positifs (override published).
- Crème `#FBF8F1` — fond admin.
- Encre `#2C2A28` — texte primaire.
- Pétale `#F2CECC` — alerte légère (warning).
- Ciel `#C5DBE5` — info.
- Champagne rare `#C8A876` — accent action principale.

### 5.2 Typographies

- **Cormorant Garamond** — titres de page (`/admin/seo` h1, modales h2).
- **Inter** — UI, labels, boutons, body.
- **Pas de Pinyon Script** dans l'admin (réservé wordmark).

### 5.3 Spacing

Système 4/8/16/24/32 px aligné sur Tailwind. Cartes 24 px padding, sections 32 px gap.

### 5.4 États interactifs

- Focus : outline 2 px champagne, offset 2 px.
- Hover boutons : bg légèrement assombri.
- Disabled : opacity 0.5, cursor not-allowed.
- Loading : spinner inline 16 px + texte « Enregistrement… ».

## 6. Microcopy

Aucun emoji, aucun superlatif, ton maison. Exemples :

- Save success : « Modifications enregistrées en brouillon. »
- Publish success : « Override publié. Les pages concernées sont en cours d'actualisation. »
- Unpublish success : « Override retiré du rendu public. Le brouillon reste accessible. »
- Delete confirm : « Supprimer définitivement cet override ? Cette action est irréversible. »
- Bulk delete confirm : « Supprimer N overrides SEO. Saisissez le nombre exact pour confirmer. »
- Linter score 0-50 : « À retravailler. Les champs essentiels manquent ou sont hors normes. »
- Linter score 51-79 : « Acceptable. Quelques améliorations possibles. »
- Linter score 80+ : « Solide. Prêt à publier. »
- Empty audit log : « Aucune action récente sur ce périmètre. »

## 7. Workflow d'édition (parcours utilisateur)

### 7.1 Parcours nominal — édition d'un produit

```
1. /admin/products/le-kit
   -> bouton « SEO » dans la sidebar
2. /admin/products/le-kit/seo
   -> SeoOverrideEditor préchargé avec scope=product, targetKey=le-kit
3. Édition title, description, OG image
   -> linter se met à jour à chaque keystroke (debounce 350 ms)
   -> previews SERP/Facebook/Twitter se mettent à jour
4. Bouton « Enregistrer » (sauvegarde brouillon)
   -> publishedAt non touché, draftedAt mis à jour
5. Bouton « Publier »
   -> snapshot créé, revalidateTag déclenché
   -> toast « Override publié. »
6. Vérification via /api/_debug/seo?route=/kit
```

### 7.2 Parcours de rollback

```
1. /admin/seo/<id>
   -> panel History
2. Sélection d'un snapshot précédent
3. Bouton « Restaurer »
   -> nouvelle révision créée avec le contenu du snapshot
   -> publishedAt mis à jour
   -> snapshot du rollback créé (trace l'opération)
```

## 8. Responsive et accessibilité

### 8.1 Breakpoints

- ≥1280 px : layout deux colonnes (form + previews).
- 768-1279 px : layout une colonne, previews en accordéon en bas.
- <768 px : pas de support prioritaire (admin desktop-first). Affichage usable mais pas optimisé.

### 8.2 Accessibilité WCAG AA

- Contrastes texte ≥ 4.5:1 (vérifier Inter sur Crème).
- Labels associés à tous les inputs via `<label htmlFor>` ou `aria-labelledby`.
- Erreurs validées avec `aria-invalid` et `aria-describedby` pointant vers le message.
- Modales avec `role="dialog"`, focus trap, restitution du focus à la fermeture.
- Linter score annoncé via `aria-live="polite"` pour lecteurs d'écran.

### 8.3 Navigation clavier

- `Tab` ordre logique : champs de gauche à droite, haut en bas.
- `Cmd+S` / `Ctrl+S` déclenche Save (si dirty).
- `Cmd+Enter` / `Ctrl+Enter` déclenche Publish (si valide).
- `Esc` ferme les modales et picker.

## 9. Performance UI

- Linter debounce 350 ms (existant, à conserver).
- Previews mémo (React.memo + dérivation côté client, pas d'appel serveur supplémentaire).
- `OgImagePicker` lazy load la médiathèque uniquement quand l'utilisateur clique sur « Parcourir » (réduction initial bundle admin).
- Audit log panel pagination par curseur (pas d'offset).

## 10. États d'erreur

| Scénario | UI | Recovery |
|---|---|---|
| Save échoue (network) | Toast rouge « Échec de l'enregistrement. Vérifiez votre connexion. » + bouton retry | Click retry |
| Publish échoue (validation) | Banner inline pointant vers les champs invalides | Correction puis re-publish |
| Conflict 409 (override déjà existant) | Banner « Un override existe déjà pour cette cible. Ouvrir l'override existant ? » + lien | Navigation |
| OG image upload échoue | Toast rouge + cleanup local | Retry ou choisir autre image |
| Linter API timeout | Score grisé « Indisponible » + retry auto au prochain change | Auto |

## 11. Composants à créer ou modifier

| Composant | Action | Phase |
|---|---|---|
| `SeoOverrideEditor.tsx` | Intégrer `OgImagePicker` | 2 |
| `SeoSettingsEditor.tsx` | Intégrer `OgImagePicker` pour default | 2 |
| `OgImagePicker.tsx` | Nouveau | 2 |
| `MediaPickerDialog.tsx` | Réutiliser ou extraire si besoin | 2 |
| `SeoBulkActionBar.tsx` | Ajouter modale confirmation bulk delete | 0 |
| `BulkDeleteConfirmDialog.tsx` | Nouveau | 0 |
| `SeoAuditLogPanel.tsx` | Nouveau | 3 |
| `SeoLinterPanel.tsx` | Inchangé | — |
| `SeoHistoryPanel.tsx` | Inchangé | — |
| `SerpPreview.tsx`, `FacebookPreview.tsx`, `TwitterPreview.tsx` | Mise à jour pour gérer mode `template` dynamique | 4 |

## 12. Tests UI associés

Liste détaillée dans `07-tests-strategy.md`. Aperçu :

- **Vitest + Testing Library** : chaque composant rendu, états vide/loading/error, interactions clavier.
- **Vitest + MSW** : intégration `SeoOverrideEditor` avec mock `/api/admin/seo/*`.
- **Playwright** : parcours nominal édition + publish + rollback.
- **A11y** : `@axe-core/playwright` sur `/admin/seo`, `/admin/seo/new`, `/admin/seo/[id]`, `/admin/seo/settings`, `/admin/seo/audit-log`.
