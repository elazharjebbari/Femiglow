# F01 -- Navigation & Sidebar

## Feature ID
F01-navigation-sidebar

## Description
The Sidebar component provides primary navigation for the Content Studio v2 interface, including a top-level nav with 5 modes and a contextual AI Engine subnav that appears when the user is on any `/ai-engine/*` route. The sidebar is rendered on every page, is 232px wide, sticky-positioned, and displays a brand header, main nav links, conditional AI Engine subnav, a theme toggle, and a legacy studio link.

## UI Location
- **Page path**: Every `/admin/content-studio-v2/*` page
- **Section**: Left sidebar, always visible
- **Rendered by**: `<Sidebar />` inside the shell layout

## Components Involved
| Component | Path |
|---|---|
| `Sidebar` | `apps/web/src/components/admin/content-studio-v2/shell/Sidebar.tsx` |
| `ThemeToggle` | `apps/web/src/components/admin/content-studio-v2/shell/ThemeToggle.tsx` |

## API Routes
None -- the Sidebar is purely client-side and uses `usePathname()` for routing state.

## Data Flow
1. `usePathname()` returns the current URL path
2. NAV array (5 items) is iterated; `isActive` is computed via exact match, `startsWith`, or regex `.match`
3. If `pathname.startsWith('/admin/content-studio-v2/ai-engine')`, the AI_SUBNAV block (5 items) is rendered below a separator
4. Active items get `aria-current="page"`, accent color, bold weight, and a 2px left indicator bar
5. ThemeToggle and legacy link are rendered in a pinned footer area

## Main Navigation Items
| # | href | label | icon |
|---|---|---|---|
| 1 | `/admin/content-studio-v2/home` | Accueil | `Home` |
| 2 | `/admin/content-studio-v2/create` | Creation | `Sparkles` |
| 3 | `/admin/content-studio-v2/library` | Bibliotheque | `LayoutGrid` |
| 4 | `/admin/content-studio-v2/plan` | Planning | `CalendarDays` |
| 5 | `/admin/content-studio-v2/ai-engine` | AI Engine | `Cpu` |

## AI Engine Subnav Items
| # | href | label | icon |
|---|---|---|---|
| 1 | `/admin/content-studio-v2/ai-engine/create` | Generer | `Sparkles` |
| 2 | `/admin/content-studio-v2/ai-engine/knowledge` | Connaissances | `BookOpen` |
| 3 | `/admin/content-studio-v2/ai-engine/trends` | Veille | `TrendingUp` |
| 4 | `/admin/content-studio-v2/ai-engine/analytics` | Metriques | `BarChart3` |
| 5 | `/admin/content-studio-v2/ai-engine/config` | Config | `Settings` |

## States
| State | Condition | Visual |
|---|---|---|
| Default (no active) | pathname matches none | All items secondary color |
| Active main nav | pathname matches item href or `startsWith` | Accent color, 600 weight, accent background, 2px left bar |
| Active subnav | pathname matches subnav item | Accent color, 600 weight, accent background |
| AI Engine section visible | pathname starts with `/admin/content-studio-v2/ai-engine` | Subnav block rendered with separator and "AI Engine" label |
| AI Engine section hidden | pathname does NOT start with `/ai-engine` path | Subnav block not in DOM |
| Create match | pathname matches `/create/*` via regex | "Creation" highlighted, "AI Engine" NOT highlighted |

## Validation Rules
- `isActive` for `create` uses regex `/^\/admin\/content-studio-v2\/create/` to match sub-routes
- `isActive` for `ai-engine` (main nav) uses regex `/^\/admin\/content-studio-v2\/ai-engine$/` to match only the exact path (not sub-routes)
- Subnav items use simple `===` or `startsWith` comparison

## Design Tokens
| Token | Usage |
|---|---|
| `--cs-bg-base` | Sidebar background |
| `--cs-border-hair` | Right border, subnav separator |
| `--cs-accent` | Active link color, left indicator |
| `--cs-accent-bg` | Active link background |
| `--cs-fg-secondary` | Inactive main nav color |
| `--cs-fg-muted` | Inactive subnav color, "AI Engine" label |
| `--cs-radius-sm` | Link border radius |
| `--cs-radius-full` | Brand logo circle |
| `--cs-motion-fast` | Transition speed |
| `--cs-easing` | Transition easing |
| `--cs-text-sm` | Main nav font size |
| `--cs-text-xs` | Subnav font size, section label |
| `--cs-font-display` | Brand name, section label font |

## Accessibility
- Main nav: `<nav aria-label="Modes du Studio">`
- AI Engine subnav: `<nav aria-label="AI Engine">`
- Active link: `aria-current="page"` is set
- Inactive link: `aria-current` is `undefined` (attribute omitted)
- Left indicator bar: `aria-hidden` on the decorative element
- All links are `<Link>` elements (rendered as `<a>` by Next.js)
- Keyboard: standard tab order, Enter/Space to follow link

## Edge Cases
- `pathname` is `null` (handled by `usePathname() ?? ''`)
- User navigates directly to `/admin/content-studio-v2/ai-engine` exact path: main nav "AI Engine" is active but none of the subnav items are active
- User navigates to `/admin/content-studio-v2/ai-engine/config/something`: "Config" subnav is active (via `startsWith`)
- User navigates to `/admin/content-studio-v2/create/new`: "Creation" is active via regex, AI Engine subnav hidden
- Sidebar width is fixed at 232px; no responsive collapse
- ThemeToggle in footer is always rendered regardless of pathname
