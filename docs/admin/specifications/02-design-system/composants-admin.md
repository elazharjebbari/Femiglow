# Composants admin — inventaire

> Ce document liste les composants UI nécessaires pour l'admin. Chaque
> ligne indique s'il s'agit d'un **réutilisé** (déjà présent dans
> `src/components/ui/` ou `src/components/forms/`) ou d'un **nouveau**
> à créer dans `src/components/admin/`.

---

## Réutilisés tels quels

| Composant | Source | Usage admin |
|---|---|---|
| `Button`, `ButtonLink` | `ui/Button.tsx` | actions primaires/secondaires |
| `Heading` | `ui/Heading.tsx` | titres h1, h2 |
| `Text` | `ui/Text.tsx` | paragraphes |
| `Kicker` | `ui/Kicker.tsx` | surtitres uppercase |
| `Container` | `ui/Container.tsx` | wrappers (`width="content"`) |
| `Stack` | `ui/Stack.tsx` | layouts verticaux/horizontaux |
| `Toast` | `ui/Toast.tsx` | notifications de succès/erreur |
| `ConfirmationModal` | `ui/ConfirmationModal.tsx` | confirmations destructives |
| `Field` | `forms/Field.tsx` | wrapper label + input + erreur |
| `Logo`, `Fleuron` | `ui/Logo.tsx`, `ui/Fleuron.tsx` | branding header admin |

## Nouveaux à créer (`src/components/admin/`)

### Layout

| Composant | Description |
|---|---|
| `AdminLayout` | Layout racine `(admin)/layout.tsx` : header + sidebar + main |
| `AdminHeader` | Top bar : logo, titre de section courante, bouton logout |
| `AdminSidebar` | Nav verticale : Dashboard, Leads, Webhooks, Paramètres |
| `AdminBreadcrumb` | Fil d'Ariane (Leads → Détail) |

### Tableaux et listes

| Composant | Description |
|---|---|
| `DataTable<T>` | Wrapper générique : header sortable, body, footer pagination |
| `LeadTable` | Spécialisation `DataTable` pour les leads |
| `DeliveryTable` | Spécialisation `DataTable` pour les livraisons webhook |
| `EmptyState` | État vide illustré avec CTA |

### Filtres

| Composant | Description |
|---|---|
| `LeadFilters` | Barre de filtres : type, statut (chips), période, recherche |
| `FilterChip` | Pastille de filtre actif avec X pour retirer |
| `DateRangePicker` | Sélecteur de période (compatible mobile) |
| `SearchInput` | Input recherche avec debounce 300 ms |

### Statuts et badges

| Composant | Description |
|---|---|
| `StatusBadge` | Badge coloré pour `LeadStatus` |
| `DeliveryStatusBadge` | Badge coloré pour `DeliveryStatus` |
| `MetricCard` | Carte de KPI (compteur 24 h, 30 j) |

### Détails et formulaires

| Composant | Description |
|---|---|
| `LeadDetail` | Fiche complète d'un lead avec timeline |
| `LeadTimeline` | Liste chronologique des `lead_events` |
| `LeadStatusSelector` | Dropdown pour changer le statut |
| `LeadNoteEditor` | Textarea pour ajouter une note interne |
| `WebhookForm` | Création / édition d'un endpoint |
| `WebhookSecretInput` | Input avec génération + copie + masquage |
| `WebhookFilterEditor` | Builder visuel pour le filtre jsonb |

### Feedback

| Composant | Description |
|---|---|
| `LoadingSpinner` | Spinner sobre 16/24 px |
| `InlineError` | Bandeau d'erreur sous un formulaire |
| `Toast` (réutilisé) | Notifs en haut à droite |
| `ConfirmDialog` | Wrapper de `ConfirmationModal` avec messages préformatés |

### Auth

| Composant | Description |
|---|---|
| `LoginForm` | Formulaire login (email + password) |
| `LogoutButton` | Bouton + appel `POST /api/admin/logout` |

---

## Règle de promotion réutilisable → ui

Un composant `admin/` qui devient pertinent pour le marketing/commerce
peut être promu vers `ui/` après revue. Pas de promotion automatique :
chaque composant garde son contexte.

## Patterns de composition

```tsx
// Pattern : Server Component lit la DB et passe les données aux
//           Client Components pour l'interactivité
// Page :
export default async function LeadsPage({ searchParams }) {
  const data = await listLeads(searchParams);
  return (
    <Container width="content">
      <Heading level={1}>Leads</Heading>
      <LeadFilters initial={searchParams} />          {/* client */}
      <LeadTable items={data.items} />                {/* mixed */}
    </Container>
  );
}
```

```tsx
// Pattern : action destructive avec confirmation
<ConfirmationModal
  open={confirmOpen}
  onConfirm={handleDelete}
  onCancel={() => setConfirmOpen(false)}
  title="Supprimer ce lead ?"
  description="Cette action est irréversible."
  confirmLabel="Supprimer définitivement"
  variant="danger"
/>
```
