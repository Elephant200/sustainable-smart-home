# Style Guide

Internal reference for the "organic & earthy" design system. Use these
semantic tokens instead of hardcoded color values so light and dark modes
stay in sync.

Sources of truth:
- `app/globals.css` — CSS custom properties (HSL triplets) for light & dark
- `tailwind.config.ts` — Tailwind class mapping (`bg-primary`, `text-chart-1`, …)
- `components/ui/*` — Component variants (Button, Badge, Card, …)

All token values below are HSL triplets and are consumed via
`hsl(var(--token))`. When applying a `bg-*` always pair it with the
matching `text-*-foreground`.

---

## Surface tokens

Backgrounds, borders, and structural surfaces.

| Token | Tailwind class | Light (HSL) | Dark (HSL) | Usage |
|---|---|---|---|---|
| `--background` | `bg-background` | `38 35% 96%` | `28 18% 7%` | Page background |
| `--foreground` | `text-foreground` | `30 20% 14%` | `40 30% 92%` | Primary text |
| `--card` | `bg-card` | `40 40% 98%` | `26 16% 10%` | Card surfaces |
| `--card-foreground` | `text-card-foreground` | `30 20% 14%` | `40 30% 92%` | Text on cards |
| `--popover` | `bg-popover` | `40 40% 98%` | `26 16% 10%` | Menus & popovers |
| `--popover-foreground` | `text-popover-foreground` | `30 20% 14%` | `40 30% 92%` | Text in popovers |
| `--muted` | `bg-muted` | `38 22% 91%` | `26 12% 14%` | Subtle bgs, skeletons |
| `--muted-foreground` | `text-muted-foreground` | `30 12% 40%` | `40 18% 70%` | Secondary text |
| `--border` | `border-border` | `38 20% 84%` | `26 12% 18%` | Borders & dividers |
| `--input` | `border-input` | `38 20% 86%` | `26 12% 18%` | Form input borders |
| `--ring` | `ring-ring` | `145 35% 28%` | `100 32% 62%` | Focus ring |

## Brand tokens

| Token | Tailwind class | Light (HSL) | Dark (HSL) | Usage |
|---|---|---|---|---|
| `--primary` | `bg-primary` | `145 35% 28%` (forest) | `100 32% 62%` (glowing sage) | Primary buttons, key accents |
| `--primary-foreground` | `text-primary-foreground` | `40 40% 97%` | `28 18% 8%` | Text on primary |
| `--secondary` | `bg-secondary` | `100 18% 90%` | `26 12% 16%` | Secondary surfaces, soft pills |
| `--secondary-foreground` | `text-secondary-foreground` | `145 35% 22%` | `40 30% 92%` | Text on secondary |
| `--accent` | `bg-accent` | `16 50% 90%` (terra cotta) | `38 60% 22%` (glowing amber) | Hover states, highlights |
| `--accent-foreground` | `text-accent-foreground` | `16 55% 32%` | `38 80% 72%` | Text on accent |

## Status tokens

Reserve for errors and warnings — do not use as decorative accents.

| Token | Tailwind class | Light (HSL) | Dark (HSL) | Usage |
|---|---|---|---|---|
| `--destructive` | `bg-destructive` | `4 70% 50%` | `4 60% 38%` | Errors, dangerous actions |
| `--destructive-foreground` | `text-destructive-foreground` | `40 40% 97%` | `40 30% 95%` | Text on destructive |
| `--warning` | `bg-warning` | `38 80% 55%` | `38 70% 45%` | Warnings, attention |
| `--warning-foreground` | `text-warning-foreground` | `30 50% 14%` | `40 30% 95%` | Text on warning |

## Chart palette

Use `text-chart-1` … `text-chart-5` (or the matching `bg-*`) so
visualizations stay legible in both themes.

| Token | Tailwind class | Light (HSL) | Dark (HSL) | Conventional usage |
|---|---|---|---|---|
| `--chart-1` | `text-chart-1` / `bg-chart-1` | `38 80% 55%` | `38 85% 65%` | Solar / amber |
| `--chart-2` | `text-chart-2` / `bg-chart-2` | `100 28% 52%` | `100 38% 62%` | Battery / sage |
| `--chart-3` | `text-chart-3` / `bg-chart-3` | `16 55% 50%` | `16 65% 60%` | Grid / carbon / terra cotta |
| `--chart-4` | `text-chart-4` / `bg-chart-4` | `145 35% 28%` | `145 30% 55%` | Efficiency / forest |
| `--chart-5` | `text-chart-5` / `bg-chart-5` | `28 45% 55%` | `28 55% 60%` | Misc / warm honey |

Tinted-badge pattern used across the dashboard:

```tsx
<Badge variant="outline" className="bg-chart-1/10 text-chart-1 border-chart-1/30">Solar</Badge>
<Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/30">Battery</Badge>
<Badge variant="outline" className="bg-chart-3/10 text-chart-3 border-chart-3/30">Grid</Badge>
<Badge variant="outline" className="bg-chart-4/15 text-chart-4 border-chart-4/30">Efficiency</Badge>
<Badge variant="outline" className="bg-chart-5/10 text-chart-5 border-chart-5/30">EV</Badge>
```

---

## Typography

Two webfonts loaded via `next/font/google` in `app/layout.tsx`:

- **Display — Fraunces** (serif), variable `--font-display`, class `font-display`.
  Auto-applied to `h1`, `h2`, `h3`, `[data-slot="card-title"]`,
  `[data-slot="dialog-title"]`, `[data-slot="alert-dialog-title"]` via
  `app/globals.css`.
- **Body / UI — Inter** (sans), variable `--font-sans`, class `font-sans`
  (default on `body`).

Heading weights are intentionally light (500). Letter-spacing is tightened
(`-0.015em`) and `font-feature-settings: "ss01"` is enabled.

Type scale (Tailwind):

| Class | Usage |
|---|---|
| `text-4xl` | Hero |
| `text-3xl` | Page title |
| `text-2xl` | Section |
| `text-xl` | Subsection |
| `text-lg` | Card title |
| `text-base` | Body |
| `text-sm` | Secondary / labels |
| `text-xs` | Captions / metadata |

---

## Buttons

From `components/ui/button.tsx`. Each variant binds to semantic tokens
above — never hardcode colors on buttons.

| Variant | Recipe |
|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |

Sizes: `sm` (h-8), `default` (h-9), `lg` (h-10), `icon` (h-9 w-9).

---

## Badges

From `components/ui/badge.tsx`.

| Variant | Recipe |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `destructive` | `bg-destructive text-destructive-foreground` |
| `outline` | `text-foreground` (transparent bg, default border) |

For category indicators prefer the chart-tinted outline pattern shown in
the Chart palette section above.

---

## Surfaces & radius

- `--radius` is `0.875rem`. Tailwind aliases derive from it:
  `rounded-lg = var(--radius)`, `rounded-md = var(--radius) - 4px`,
  `rounded-sm = var(--radius) - 8px`.
- Cards (`components/ui/card.tsx`) use `rounded-xl border bg-card
  text-card-foreground shadow-sm`.

---

## Special utilities (in `app/globals.css`)

- `.text-gradient` — primary → chart-1 → chart-3 gradient text. Has a
  dark-mode variant tuned for the bioluminescent palette.
- `.font-display` — apply Fraunces to non-heading elements.
- `.grain` — subtle SVG noise overlay for hero/cards. Adapts to dark mode.
- `.skeleton-shimmer` — shimmering loading bar (uses `--muted` and
  `--secondary`).
- `.nav-progress` — top-of-page route progress bar (primary → chart-1 →
  chart-3 gradient).

---

## Conventions

- **Never** introduce hardcoded Tailwind palette classes such as
  `text-green-600`, `bg-blue-100`, `border-red-500`. Use the semantic
  tokens above so dark mode and theme tweaks remain centralized.
- Always pair `bg-*` with `text-*-foreground` to guarantee contrast.
- For one-off tinted surfaces, prefer the alpha-modifier pattern on
  semantic tokens (e.g. `bg-chart-2/10`) instead of new colors.
- When adding a new semantic token, add it in three places: the CSS
  variables in `app/globals.css` (light + dark), the Tailwind mapping in
  `tailwind.config.ts`, and this document.
