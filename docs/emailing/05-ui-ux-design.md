# 05 — UI / UX Design System Emailing

> Tokens, primitives partagées, layouts, états (idle/loading/empty/error), responsive, accessibilité. Dérivé du système admin existant (`stone-*` + brand FemiGlow). Aucun nouveau token global.

## §1 — Principes de design

| Principe | Implication |
|---|---|
| **Sobriété dense** | Toutes les vues admin privilégient la lisibilité info-dense (cf. analytics). Pas de héros visuel ; les cartes sont compactes. |
| **Cohérence avec le reste de l'admin** | Tokens `stone-*` + brand `sauge / champagne / petale`. Aucun écart visuel avec `/admin/products`, `/admin/leads`. |
| **Action depuis la donnée** | Chaque ligne / carte expose une action directe (Retry, Voir, Pause). Pas de menus contextuels cachés. |
| **Stato signalétique** | Code couleur statut stable et systématique (cf. §4 StatusBadge). |
| **Wizard rassurant** | Progression visible, sauvegarde implicite, possibilité de quitter sans perdre. Le wizard ne saute jamais d'étape ; on peut toujours revenir. |
| **Aperçu permanent** | Tout template / mail a un preview iframe-sandboxed disponible en 1 clic. |
| **Respect de la marque sortante** | Tous les templates utilisent la palette brand (sauge, champagne, petale) et la typographie produit (cf. `01-marque-vision-voix.md`). |

## §2 — Tokens utilisés

### 2.1 — Couleurs

| Token | Usage | Hex (référence Tailwind) |
|---|---|---|
| `stone-50..950` | Surfaces neutres admin (background, borders, texte secondaire) | natif |
| `brand-sauge` | Accent primaire admin emails (titres section, focus rings, primary CTA) | défini dans `tailwind.config.ts` |
| `brand-champagne` | Surfaces "important" (cartes mises en avant) | natif |
| `brand-petale` | Accent émotionnel léger (success-flavored info) | natif |
| `emerald-500/600` | Statut "delivered / sent" | natif |
| `blue-500/600` | Statut "opened / scheduled" | natif |
| `amber-500/600` | Statut "pending / sending / soft bounce" | natif |
| `rose-500/600` | Statut "failed / hard bounce / dlq" | natif |
| `stone-400/500` | Statut "draft / cancelled / suppressed" | natif |

### 2.2 — Typographie

- Headings : `font-semibold tracking-tight`, tailles `text-{lg,xl,2xl,3xl}` selon hiérarchie.
- Body : `text-sm leading-6 text-stone-700`.
- Mono (Message-ID, payload JSON) : `font-mono text-xs`.
- Subjects (preview) : `text-sm font-medium` (italique si placeholder).

### 2.3 — Espacements & rayons

- Cards : `rounded-xl` (12 px), `border border-stone-200`, `bg-white`, `p-4` (mobile) / `p-6` (desktop).
- Tables : `rounded-lg`, header `bg-stone-50`, lignes hover `bg-stone-50/60`.
- Buttons : `rounded-md` (6 px), `h-9` standard, `h-8` compact, `h-10` important.
- Form inputs : `rounded-md`, `border-stone-300`, `focus:ring-2 focus:ring-brand-sauge/40 focus:border-brand-sauge`.

## §3 — Primitives partagées (composants)

Toutes dans `apps/web/src/components/admin/emails/`. Réutilisent les primitives admin existantes (`Button`, `Input`, `Select`, `Tabs`, `Toast`, `Drawer`) ; n'ajoutent que ce qui est spécifique au domaine.

### 3.1 — `<StatusBadge status="delivered" />`

```
delivered    → emerald  ⏺ Livré
sent         → emerald  ⏺ Envoyé
opened       → blue     ⏺ Ouvert
clicked      → blue     ⏺ Cliqué
pending      → amber    ⏺ En attente
sending      → amber    ⏺ Envoi…
scheduled    → blue     ⏺ Planifié
draft        → stone    ⏺ Brouillon
failed       → rose     ⏺ Échec
bounced_soft → amber    ⏺ Bounce soft
bounced_perm → rose     ⏺ Bounce permanent
suppressed   → stone    ⏺ Supprimé
dlq          → rose     ⏺ DLQ
cancelled    → stone    ⏺ Annulé
```

API :
```tsx
type Status = 'delivered' | 'sent' | … ;
<StatusBadge status="delivered" />
<StatusBadge status="failed" detail="SMTP 550 mailbox not found" />  // tooltip on hover
```

### 3.2 — `<KpiTile>` (réutilise pattern analytics)

```tsx
<KpiTile
  label="Envoyés"
  value={1240}
  delta={{ value: 12.4, period: 'vs 7j préc.' }}
  hint="Nombre total d'envois transactionnels et campagne sur la période."
/>
```

Layout : nombre principal `text-3xl font-semibold tabular-nums`, delta `text-xs` coloré (vert ↗, rouge ↘), tooltip `?` discret.

### 3.3 — `<OutboxRow>` / `<OutboxTable>`

Table dense ; ligne :

```
13/05 16:00  contact-acknowledgement  → souheila@…  «Merci pour …»  ⏺Livré  1/5  [Voir] [Retry-disabled]
```

Hover row → `bg-stone-50/60`. Click row → drawer ou navigate vers détail (config setting).

### 3.4 — `<CampaignCard>`

```
┌──────────────────────────────────────────────────────┐
│ ⏺ Brouillon                              il y a 2 j  │
│ Bienvenue printemps 2026                              │
│ « ✨ Découvre tes rituels printemps »                │
│ ───────────────────────────────────────────────────  │
│ 📨 Audience : Newsletter (3 247)                     │
│ 🎨 Template : spring-welcome-v1                      │
│ ⏱ Planifié : non                                    │
│                                                       │
│ [Continuer le brouillon ▸]    [⋯]                     │
└──────────────────────────────────────────────────────┘
```

Variants : `draft` → bordure stone-200, `scheduled` → bordure blue-200 + horloge, `sent` → bordure emerald-200 + métriques inline.

### 3.5 — `<AudienceSelector>`

```
┌──────────────────────────────────────────────────────┐
│ Audience(s) ciblée(s)                                │
│ ▾ Sélectionner une ou plusieurs listes               │
│                                                       │
│ Recherche : [_______________]                         │
│ ☐ Newsletter (3 247)                                  │
│ ☐ Clientes premium (412)                              │
│ ☐ Esthéticiennes pro (89)                             │
│ ☑ Promo printemps (1 240)                             │
│                                                       │
│ Total uniques après dédoublonnage : 1 240             │
│ Suppression list exclue : 12 contacts                 │
│ Envoi final estimé : 1 228                            │
└──────────────────────────────────────────────────────┘
```

API :
```tsx
<AudienceSelector
  value={audienceIds}
  onChange={setAudienceIds}
  excludeSuppressed
  showEstimate
/>
```

### 3.6 — `<TemplatePreview>`

iframe sandboxée + toolbar :

```
┌──────────────────────────────────────────────────────┐
│ [Desktop] [Mobile]   [☼ Light] [☾ Dark]   [Refresh]  │
├──────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────┐ │
│ │ Subject: ✨ Découvre tes rituels printemps        │ │
│ │ ──                                                │ │
│ │ Bonjour {{first_name}},                          │ │
│ │                                                   │ │
│ │ [Image hero…]                                    │ │
│ │                                                   │ │
│ │ Découvre les rituels …                           │ │
│ │ [CTA : Découvrir]                                │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ Variables détectées : {{first_name}} {{product_url}} │
│ ⚠ {{product_url}} non renseignée (placeholder utilisé)│
└──────────────────────────────────────────────────────┘
```

Rendu : `react-email` → HTML inline → iframe `srcdoc`. Sandboxed `sandbox="allow-popups"` (pas de `allow-scripts` pour ne pas exécuter le HTML).

### 3.7 — `<SubjectComposer>`

Input texte avec :
- Compteur caractères (idéal 30-50, max 78).
- Insertion variables `{{ }}` via dropdown.
- Preview "comme dans la boîte de réception" : `[Avatar] FemiGlow • il y a 1m  Subject preview…`
- Detection emojis : warning si > 2 emojis (anti-spam heuristic).

### 3.8 — `<MetricBadge>`

Petites pastilles inline :

```
Envoyés 1 240  •  Ouverts 412 (33 %)  •  Clics 78 (6.3 %)  •  Bounces 2 (0.16 %)
```

Chaque chunk est un `<MetricBadge value=… label=… pct=… />`.

### 3.9 — `<BouncesPanel>`

Table 4 col : email, raison (chip), date, action (`Ré-essayer` / `Marquer comme valide` / `Bloquer`).

### 3.10 — `<SuppressionList>`

Identique mais en lecture seule sauf "Retirer de la suppression list" (avec confirmation).

### 3.11 — `<EmailsHealthBadge>`

Header global. États :
- `🟢 Système OK` (SMTP + Listmonk OK + outbox < seuil)
- `🟡 Dégradé` (outbox > 50 OR Listmonk lent)
- `🔴 Incident` (SMTP KO OR Listmonk KO OR DLQ > 10)

Click → drawer avec détail health (SMTP test, Listmonk version, queue size, last refresh matview).

## §4 — Layouts globaux

### 4.1 — Layout admin standard

Réutilise `layout.tsx` admin existant. Sidebar + header global. La section "Emails" ajoute son propre `layout.tsx` avec tabs internes.

### 4.2 — Layout wizard

Plein écran avec progress bar fixe + zone contenu + nav bottom (Précédent / Suivant). Cf. `06-wizard-specification.md` §2.

### 4.3 — Layout iframe wrapper

```
┌──────────────────────────────────────────────────────┐
│ ← Retour Emails   [URL native: /admin/campaigns]  ⟳  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ iframe Listmonk (h-[calc(100vh-9rem)])         │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## §5 — États (idle / loading / empty / error)

### 5.1 — Loading (skeleton)

Pattern : `<Skeleton variant="kpi" />`, `<Skeleton variant="row" count={5} />`. Animation `animate-pulse` natif Tailwind. **Pas** de spinners full-screen.

### 5.2 — Empty

```
┌────────────────────────────────┐
│        📭                      │
│   Aucun envoi sur la période   │
│   sélectionnée                  │
│                                 │
│   [Élargir la période]          │
└────────────────────────────────┘
```

Illustrations textuelles (emoji) ; pas d'image marketing.

### 5.3 — Error

```
┌────────────────────────────────┐
│        ⚠ Code : MAIL-FETCH     │
│   Impossible de charger les     │
│   métriques.                    │
│                                 │
│   [Réessayer]  [Reporter]       │
└────────────────────────────────┘
```

Code court (4-7 caractères) pour aider le support. Bouton "Reporter" → préfill Sentry feedback.

### 5.4 — Optimistic / pending

Pour les actions (retry, cancel, schedule), affichage immédiat de l'état attendu avec `aria-busy="true"` ; revert + toast d'erreur si l'action échoue.

## §6 — Toast / notifications

Réutilise le pattern existant (`apps/web/src/components/ui/toast.tsx`). Conventions :

| Niveau | Couleur | Durée | Usage |
|---|---|---|---|
| success | emerald | 3 s | "Campagne planifiée pour le 14 mai à 09:00." |
| info | blue | 4 s | "Brouillon enregistré." |
| warning | amber | 6 s | "Aperçu désactivé : variables manquantes." |
| error | rose | 8 s (sticky si critique) | "Échec de l'envoi : SMTP unreachable. [Réessayer]" |

Toasts s'affichent bottom-right. Toujours avec action si applicable.

## §7 — Responsive

- **Desktop ≥ 1024 px** : layout natif, tables denses, sidebar pleine.
- **Tablet 768-1023 px** : sidebar collapse à icônes, tables scroll horizontal.
- **Mobile ≤ 767 px** : sidebar drawer (hamburger), tables → cards stack, **wizard masqué** (CTA "Ouvrir sur desktop pour créer une campagne"), iframe Listmonk **masquée** (CTA "Ouvrir version native"). Dashboard reste utilisable (KPI cards, liste outbox lecture seule).

## §8 — Accessibilité

| Critère | Implémentation |
|---|---|
| Contraste | Tous les textes sur fond white ≥ AA (vérifié). Couleurs statut testées sur stone-50 et white. |
| Focus visible | `ring-2 ring-brand-sauge/40` sur tous les éléments interactifs. Pas de `outline: none` jamais. |
| Navigation clavier | Tab order logique. Wizard : `←/→` change d'étape (avec confirmation si dirty). |
| Skip-links | "Aller au contenu", "Aller à la table principale" en haut de chaque page. |
| ARIA roles | `role="status"` sur les health badges, `aria-live="polite"` sur toasts, `aria-busy` sur boutons en cours, `aria-current="page"` sur tab actif. |
| Form labels | Tous les `<input>` ont un `<label>` associé OU `aria-label`. Erreurs via `aria-describedby`. |
| Tableaux | `<th scope="col">`, `<caption>` cachée. |
| Iframe | `<iframe title="Listmonk admin">` ; le contenu Listmonk a sa propre accessibility (déjà testée upstream). |
| `prefers-reduced-motion` | Transitions wizard désactivées si demandé. |

## §9 — Mockups synthétiques par page

(Tous en ASCII pour reproductibilité.)

### 9.1 — `/admin/emails` (Dashboard)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Emails                                          🟢 Système OK  [⚙]  │
│ ─────────────────────────────────────────────────────────────────── │
│ Vue d'ensemble | Transactionnel | Campagnes | Audiences | …         │
├─────────────────────────────────────────────────────────────────────┤
│ Période : [7j ▾]                                                    │
│                                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ │ Envoyés  │ │ Livrés   │ │ Ouverts  │ │ Cliqués  │ │ Bounces  │ │ Désabos  │
│ │  1 240   │ │   98 %   │ │  33 %    │ │   6.3%   │ │  0.16 %  │ │  0.08 %  │
│ │ ↗12.4 %  │ │ ↗0.4 %   │ │ ↘1.2 %   │ │ ↗0.8 %   │ │ ↘0.05 %  │ │ —        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
│                                                                     │
│ ┌─── Envois & livraisons (7j) ──────────────────────────────────┐  │
│ │  [line chart sent vs delivered]                               │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ ┌─── Top templates ─────┐  ┌─── Dernières campagnes ─────────────┐ │
│ │ contact-ack    98 %   │  │ Bienvenue printemps 2026 (draft)    │ │
│ │ order-confirm  99 %   │  │ Solde hivernal -20% (sent, 33% open)│ │
│ │ newsletter     85 %   │  │ Lancement masque (sent, 41% open)   │ │
│ └───────────────────────┘  └─────────────────────────────────────┘ │
│                                                                     │
│ ┌─── Alertes ──────────────────────────────────────────────────┐  │
│ │ ⚠ 3 envois en DLQ. [Voir]                                    │  │
│ │ ⚠ 12 hard bounces ces 24 h. [Voir suppression list]          │  │
│ └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 — `/admin/emails/audiences`

```
┌─────────────────────────────────────────────────────────────────────┐
│ Audiences                                       [+ Nouvelle liste]  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─── Newsletter ──────────────────────────────────────────────┐    │
│ │ 3 247 contacts  •  Public  •  Double opt-in                  │    │
│ │ Croissance : +124 (7 j)  •  Désabos : 8 (7 j)                │    │
│ │ [Voir ▸] [Importer] [Exporter]                                │    │
│ └─────────────────────────────────────────────────────────────┘    │
│ ┌─── Clientes premium ────────────────────────────────────────┐    │
│ │ 412 contacts  •  Privée  •  Simple opt-in                    │    │
│ │ [Voir ▸]                                                      │    │
│ └─────────────────────────────────────────────────────────────┘    │
│ ⊕ Synchronisation Listmonk : il y a 2 min  [Resync maintenant]     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 — `/admin/emails/templates`

```
┌─────────────────────────────────────────────────────────────────────┐
│ Templates                                       [+ Nouveau template]│
├─────────────────────────────────────────────────────────────────────┤
│ Catégorie : [Transactionnel] [Broadcast] [Automation] [Tous]        │
│                                                                     │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │
│ │ thumbnail    │ │ thumbnail    │ │ thumbnail    │                  │
│ │ contact-ack  │ │ order-confirm│ │ newsletter   │                  │
│ │ v3 • actif   │ │ v1 • actif   │ │ v2 • actif   │                  │
│ │ 1 240 envois │ │ 12 envois    │ │ 0 envoi      │                  │
│ │ [Éditer]     │ │ [Éditer]     │ │ [Éditer]     │                  │
│ └──────────────┘ └──────────────┘ └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

## §10 — Conventions de copy

| Cas | Tonalité | Exemple |
|---|---|---|
| Empty state | Doux, action positive | "Aucun envoi sur cette période. [Élargir la période]" |
| Erreur réseau | Factuel, sans techno-jargon | "Impossible de joindre le serveur d'email." |
| Erreur SMTP | Technique mais lisible | "Stalwart a refusé : 535 Authentification échouée. Vérifie SMTP_USER/SMTP_PASSWORD dans Réglages." |
| Confirmation destructive | Question + verbe à l'infinitif | "Supprimer définitivement cette campagne ?" |
| Toast succès | Court, factuel | "Brouillon enregistré." |
| Tooltip stat | Une phrase, explique la formule | "Taux d'ouverture = Ouverts uniques / Livrés × 100" |
| Wizard étape | Verbe action + objectif | "Choisis qui va recevoir ce mail." |

## §11 — Animation & motion

- Toutes les transitions ≤ 200 ms (sauf wizard step transition : 300 ms).
- Easing : `cubic-bezier(0.2, 0.8, 0.2, 1)` (cohérent avec admin existant).
- Hover : `transition-colors duration-150`.
- Skeleton : `animate-pulse` natif.
- Toasts : slide-in bottom-right + fade-out.
- `prefers-reduced-motion: reduce` → toutes les transitions à `0ms`, opacités directes.

## §12 — Iconographie

- Bibliothèque : **lucide-react** (déjà utilisée dans l'admin).
- Icônes principaux : `Mail`, `Send`, `Inbox`, `Users`, `LayoutTemplate`, `Workflow`, `Settings`, `AlertCircle`, `CheckCircle2`, `Clock`, `Pause`, `RotateCcw`, `Eye`, `MoreHorizontal`.
- Taille standard : `w-4 h-4` inline, `w-5 h-5` boutons, `w-6 h-6` empty states.
- Stroke : `1.5` (cohérent admin existant).

## §13 — Références

- Tokens admin : `apps/web/tailwind.config.ts`
- Brand palette : `docs/preparation/02-design-system.md`
- Patterns analytics : `docs/analytics/04-ui-design.md`
- Primitives existantes : `apps/web/src/components/admin/`
- Wizard détaillé : `06-wizard-specification.md`
- Tests visuels : `08-tests-strategy.md` § visual regression
