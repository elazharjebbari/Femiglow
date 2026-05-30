# F17 -- Cross-Cutting Concerns

## Feature ID
F17

## Description

Cross-cutting concerns are non-functional requirements that apply across all AI Engine
pages and components. They include dark mode theming, responsive design, accessibility,
keyboard navigation, session management, network error handling, and loading states.

## Affected Pages

| Page | URL | Source File |
|---|---|---|
| Dashboard | /admin/content-studio-v2/ai-engine | page.tsx |
| Create | /admin/content-studio-v2/ai-engine/create | create/page.tsx |
| Knowledge | /admin/content-studio-v2/ai-engine/knowledge | knowledge/page.tsx |
| Config | /admin/content-studio-v2/ai-engine/config | config/page.tsx |
| Analytics | /admin/content-studio-v2/ai-engine/analytics | analytics/page.tsx |
| Trends | /admin/content-studio-v2/ai-engine/trends | trends/page.tsx |
| Graph | /admin/content-studio-v2/ai-engine/graph | graph/page.tsx |
| Sidebar | (layout component) | shell/Sidebar.tsx |

## Dark Mode

### Design Token System

All AI Engine pages use CSS custom properties (design tokens) prefixed with `--cs-`.
Dark mode inverts these tokens while maintaining contrast ratios.

### Key Token Pairs

| Token | Light Value (approx) | Dark Value (approx) |
|---|---|---|
| --cs-bg-base | #FDFBF9 (warm white) | #1A1A1A (near black) |
| --cs-bg-elevated | #FFFFFF | #242424 |
| --cs-bg-sunken | #F5F0EB | #141414 |
| --cs-fg-primary | #1C1917 (near black) | #FAFAF9 (near white) |
| --cs-fg-secondary | #57534E | #A8A29E |
| --cs-fg-muted | #A89D90 | #78716C |
| --cs-border | #E7DDD3 | #3D3D3D |
| --cs-border-hair | #F0EAE3 | #2D2D2D |
| --cs-accent | #D1B799 (gold) | #D1B799 (unchanged) |

### Requirements

1. All backgrounds use `--cs-bg-*` tokens -- no hardcoded hex values
2. All text uses `--cs-fg-*` tokens
3. All borders use `--cs-border*` tokens
4. Accent color remains constant across themes
5. No invisible text (same color for both bg and fg)
6. ThemeToggle component in Sidebar controls the mode

### Testing Approach

- Toggle dark mode via ThemeToggle
- Screenshot comparison or CSS variable inspection
- Verify all text remains readable (contrast ratio >= 4.5:1 for WCAG AA)
- Check no elements "disappear" against backgrounds

## Responsive Design

### Breakpoint Strategy

All AI Engine pages use CSS inline styles with responsive patterns:

| Viewport | Layout Adaptation |
|---|---|
| >= 1024px | Full sidebar (232px) + content area, 2-column grids |
| 768px - 1023px | Sidebar may collapse, 2-column grids maintained |
| 320px - 767px | Single column layout (1fr), stacked elements |

### Key Responsive Elements

1. **Brief form grid** (F10): `grid-template-columns: 1fr 1fr` needs to collapse
   to `1fr` at small widths
2. **KPI cards grid** (F14): `repeat(auto-fit, minmax(200px, 1fr))` handles
   responsive naturally
3. **Cost charts grid** (F14): `grid-template-columns: 1fr 1fr` needs collapse
4. **Trend score bars grid** (F15): `grid-template-columns: 1fr 1fr` needs collapse
5. **Graph node rows** (F16): `flex-wrap: wrap` allows natural reflow
6. **Jobs table** (F14): `overflowX: auto` prevents horizontal scroll on content
7. **Sidebar** (Sidebar.tsx): 232px fixed width, should collapse on mobile

### Requirements

1. No horizontal scrollbar at 320px viewport width (except tables with overflowX)
2. All touch targets minimum 44px on mobile
3. Text remains readable (no truncation of critical content)
4. Images scale proportionally
5. Pipeline steps (F11) remain vertically stacked (already responsive)

## Accessibility (a11y)

### ARIA Roles

| Component | Required Role | Location |
|---|---|---|
| Sidebar | `role` on aside/nav | Sidebar.tsx |
| Config tabs | role="tablist", role="tab" | config/page.tsx |
| Brief form | implicit form semantics | create/page.tsx |
| Graph nodes | role="button" (non-terminal) | graph/page.tsx |
| Review panel | heading hierarchy | create/page.tsx |
| Modal dialogs | role="dialog" | various |

### Focus Management

1. Focus ring visible on all interactive elements (border-color change on :focus)
2. Tab order follows visual layout
3. Focus trapped within modal dialogs when open
4. Focus restored after modal closes
5. Skip-to-content link for keyboard users

### Color Contrast

All text must meet WCAG AA minimum contrast ratios:
- Normal text (< 18pt): 4.5:1 contrast ratio
- Large text (>= 18pt or 14pt bold): 3:1 contrast ratio
- UI components and graphics: 3:1 contrast ratio

### Required Labels

- All `<select>` elements have associated `<label>` elements
- All `<input>` elements have associated `<label>` elements
- All `<textarea>` elements have associated `<label>` elements
- Required fields indicated by both visual asterisk and programmatic `required` attribute
- Buttons have descriptive text content (not icon-only without aria-label)

### Screen Reader

- Heading hierarchy follows h1 -> h2 -> h3 -> h4 without skipping levels
- Status messages (success/error banners) use appropriate live regions
- Loading states announced to screen readers

## Keyboard Navigation

### Tab Order

All pages follow top-to-bottom, left-to-right tab order:
1. Sidebar navigation items
2. Page header actions
3. Main content interactive elements
4. Footer/action buttons

### Keyboard Interactions

| Key | Context | Action |
|---|---|---|
| Tab | Anywhere | Move focus to next interactive element |
| Shift+Tab | Anywhere | Move focus to previous interactive element |
| Enter | Button, Link | Activate the element |
| Space | Button | Activate the element |
| Enter/Space | Graph node (F16) | Toggle node expansion |
| Escape | Feedback textarea (F12) | Cancel and close feedback mode |
| Escape | Modal/Popover | Close the modal or popover |
| Arrow keys | Select dropdown | Navigate options |

### Specific Keyboard Requirements

1. Generate button (F10): Enter activates when form valid
2. Review decision buttons (F12): Enter activates, no keyboard trap
3. Collapsible sections (F13): Enter/Space toggles
4. Period selector (F14): Tab through options, Enter activates
5. Category filters (F15): Tab through pills, Enter selects

## Session Expired

### Behavior

When a user's session expires (e.g., authentication token becomes invalid):

1. Any API call returns 401 Unauthorized
2. Application detects the 401 response
3. User is redirected to the login page
4. An informational message is shown: "Session expiree, veuillez vous reconnecter"

### Testing Approach

- Mock API responses with 401 status
- Verify redirect occurs
- Verify message is displayed on login page

## Network Error

### Behavior

When network connectivity is lost or API calls fail:

1. Loading states terminate (no infinite spinners)
2. Error UI displays with descriptive message
3. Retry buttons are provided where applicable
4. Previously loaded data is preserved when possible

### Per-Page Error Handling

| Page | Error UI | Retry Mechanism |
|---|---|---|
| Create (F10) | Error phase with AlertTriangle | "Reessayer" + "Modifier le brief" |
| Analytics (F14) | Red banner with error text | "Reessayer" button |
| Trends (F15) | Silent degradation to empty state | "Lancer une collecte" |
| Graph (F16) | Red banner with error text | "Reessayer" button |
| Knowledge | Error toast or inline message | Refresh button |
| Config | Error state per section | Refresh button |

## Loading States

### Skeleton Placeholders

All pages that fetch data show skeleton placeholders during loading:

| Page | Skeleton Pattern |
|---|---|
| Analytics (F14) | 4 shimmer blocks (60, 100, 200, 300px) |
| Graph (F16) | 3 shimmer blocks (60, 500, 200px) |
| Trends (F15) | 4 card placeholders (160px each) |
| Knowledge | Card placeholders per collection |
| Config | Section placeholders |

### Shimmer Animation

```css
@keyframes cs-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Applied via inline styles:
```
animation: cs-shimmer 1.6s ease-in-out infinite
backgroundImage: linear-gradient(90deg, var(--cs-bg-sunken) 0%, var(--cs-bg-feature) 50%, var(--cs-bg-sunken) 100%)
backgroundSize: 200% 100%
```

### Button Loading States

All action buttons that trigger async operations show loading indicators:
- Generate button: no explicit loading (phase change is immediate)
- Publish button: `loading` prop on Button primitive renders cs-spinner
- Review buttons: disabled state + Loader2 spinner replacement
- Refresh buttons: RefreshCw icon with animate-spin class
