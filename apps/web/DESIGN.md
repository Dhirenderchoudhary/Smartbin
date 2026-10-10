# SmartBin web: design

SmartBin follows **Uber's Base design system**: black and white, big type, pill buttons, floating controls over a full-screen map, and a bottom sheet. Colour appears only where it means something. Read this before you add or change UI, and keep the Expo app (`Smartbin-Mobile`, `DESIGN.md`) in step: both apps use the same tokens and patterns.

## Principles

1. **The map is the product.** Map screens are full-screen (`fixed inset-0 bg-map`). Everything else floats on top: a top bar of pills, a bottom sheet on phones, a side panel on wider screens.
2. **Black and white, colour with a meaning.** Green means wet waste and blue means dry. Yellow means a problem has been reported, and red means something went wrong or is destructive. Don't add brand colours, gradients or decorative tints.
3. **Phone first.** Most people use this on a phone, standing in the street. Main actions are 48 px tall (`size="xl"`), inputs are at least 16 px (so iOS doesn't zoom), and nothing scrolls sideways at 320 px.
4. **One clear action per screen.** It is a black pill, full width on phones, with secondary actions as grey pills next to or below it.
5. **Plain words.** Sentence case, active verbs, no jargon. See [Writing](#writing).

## Colour tokens

Defined in `src/app/globals.css` as CSS variables, exposed to Tailwind through `@theme inline`. The Expo app copies the same values into `src/lib/theme.tsx`, so **change both together**.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#ffffff` | `#000000` | Page |
| `foreground` | `#000000` | `#ffffff` | Text, icons |
| `card` | `#ffffff` | `#141414` | Sheets, floating pills, cards |
| `primary` / `primary-foreground` | `#000000` / `#ffffff` | `#ffffff` / `#000000` | Main buttons, selected chips, the instruction card while navigating (it inverts in dark mode) |
| `secondary` | `#efefef` | `#282828` | Grey pills, chips, progress tracks |
| `muted` / `muted-foreground` | `#f3f3f3` / `#5e5e5e` | `#1f1f1f` / `#a6a6a6` | Quiet panels, secondary text |
| `accent` | `#e2e2e2` | `#333333` | Hover on chips, sheet handle |
| `border` | `#e2e2e2` | `#2e2e2e` | Dividers in lists |
| `input` | `#efefef` | `#282828` | Filled inputs (Base inputs have no outline) |
| `destructive` | `#e11900` | `#ff5a3c` | Errors, "Report missing", duplicate warnings |
| `wet` | `#05944f` | `#06c167` | Wet waste: pins, badges, dots, success ticks |
| `dry` | `#276ef1` | `#5b91f5` | Dry waste |
| `warning` / `warning-foreground` | `#ffc043` / `#000000` | same | Open problems (full, broken, dirty), warning alerts |
| `map` | `#e5e5e5` | `#1b1b1b` | Behind map tiles while they load |
| `chart-1` to `chart-5` | black, blue, green, yellow, red | lighter versions of the same | Admin charts only |

**Shadows (Base elevation):** `shadow-float` (`0 2px 8px`, 16% black, 60% in dark) for floating pills and buttons, and `shadow-sheet` (`0 4px 16px`) for sheets and the instruction card. Nothing else gets a shadow.

**Bins that take both wet and dry** are shown half green, half blue: the pin background, the list dot (`linear-gradient(90deg, var(--wet) 50%, var(--dry) 50%)`), and both badges.

## Theme

- Light, dark or system, chosen on the account page (`ThemeChooser`) and saved in `localStorage["smartbin.theme"]`.
- `themeScript` in `src/lib/theme.ts` runs inline in `<head>` and sets `<html data-theme="light|dark">` before first paint, so the page never flashes. Dark styles use the `dark:` variant, defined as `[data-theme="dark"]`, not the media query.
- Maps switch to a dark style too (`createMap.ts`). Map layers can't read CSS variables, so `AdminMap` resolves the colours when it draws.

## Type

Uber Move is proprietary, so we use **Inter Tight 700** for headings (like Move) and **Inter 400/500** for text (like Move Text). They're loaded with `next/font` in `src/app/layout.tsx`.

| Role | Style |
|---|---|
| Landing display | `font-heading font-bold leading-[1.08]`, `text-5xl` to `text-7xl` |
| `h1`, `h2` | `font-heading font-bold` (set globally in `globals.css`); screen titles `text-2xl`, sheet titles `text-xl` |
| Big numbers (distance, stats) | `font-heading text-3xl font-bold`, e.g. "350 m" in the bin sheet |
| Body | Inter 16 px, `text-muted-foreground` for secondary lines |
| Buttons and chips | 15 px medium; 16 px on `lg` and `xl` |

Rules: sentence case everywhere. No all-caps labels, no letter-spacing changes, no italics for emphasis.

## Shape and spacing

- `--radius: 0.5rem`, with the scale derived from it. Pills and chips use `rounded-full`, cards and alerts `rounded-2xl`, photos `rounded-xl`, and the phone bottom sheet `rounded-t-3xl` (`md:rounded-2xl` as a side panel).
- Screen gutters are `p-4` (16 px) and sheet padding is `p-5`, with `gap-4` / `gap-5` between blocks.
- Desktop map panels are `md:w-100` (400 px), pinned left at `md:left-4`. Floating UI that shares the screen with them offsets to `md:left-108` or `md:left-112`.

## Components

shadcn on **base-nova** (Base UI primitives, not Radix) lives in `src/components/ui/`. Add more with `npx shadcn add <name>` and restyle them to these tokens. Composition uses `render={<Link … />}` with `nativeButton={false}`, not `asChild`.

| Component | Variants we use | Notes |
|---|---|---|
| `Button` | `default` (black pill), `secondary` (grey pill), `outline`, `ghost`, `destructive` (tinted red), `link`; sizes `default` 40 px, `lg` 44 px, `xl` 48 px, `icon-lg` 44 px | Every button is `rounded-full`. Put icons in with `data-icon="inline-start"`. Main actions on phones: `size="xl"` |
| Floating button | `Button` + `bg-card text-foreground shadow-float hover:bg-muted` (the `floating` constant in the map pages) | Map controls: account, locate me, back, Re-centre |
| `ToggleGroup` `variant="chip"` | Grey pill chips; the selected chip is black | Filters (All / Wet / Dry), waste type when adding, admin filters |
| `Badge` | `wet`, `dry`, `warning`, `secondary` | Waste type and problem labels |
| `Alert` | `default`, `destructive`, `warning` | Inline feedback inside sheets and forms, with `AlertTitle`, `AlertDescription`, `AlertAction` |
| `AlertDialog` | | "Report a problem" chooser |
| `Field*`, `Input` | | Forms: `FieldLabel` above, `FieldDescription` below |
| `Card`, `Skeleton`, `Spinner`, `Table`, `Tabs`, `Sheet`, `chart` (Recharts) | | Account page and admin |

App-specific pieces: `Logo` / `LogoMark` (a bin mark in a black rounded square), `AppTopBar` (back arrow and title for the inner screens), `SiteChrome` (landing header and black footer), `TestLogin` (local mode only), `ThemeToggle` / `ThemeChooser`.

## Map screens

```
Phone (≤ md)                         Desktop (md+)
┌────────────────────────────┐       ┌──────────┬───────────────────────────┐
│ (Logo)        [+ Add] (👤) │       │ Logo     │ [All|Wet|Dry]  [+Add] (👤)│
│ [All|Wet|Dry]          (◎) │       │ selected │                           │
│                            │       │ bin      │          map              │
│           map              │       │ ──────── │                           │
│        pins + you          │       │ nearest  │                       (◎) │
│╭──────────────────────────╮│       │ bins     │                           │
││ ═══  (handle)            ││       │          │                           │
││ selected bin / nearest   ││       └──────────┴───────────────────────────┘
│╰──────────────────────────╯│        side panel: md:inset-y-4 md:left-4 md:w-100
└────────────────────────────┘
 bottom sheet: max-h-[46dvh]
```

- **Bottom sheet** (`BinPanel`): `rounded-t-3xl bg-card shadow-sheet`, at most 46% of the screen high, and it scrolls inside. The handle collapses it to one line (swipe down or tap) and opens it again (swipe up or tap). Selecting a bin opens it. On `md+` it becomes a full-height side panel and the handle is hidden.
- **Pins** (`BinMap.tsx`): 36 px circles with a 3 px `background` border and `shadow-float`, filled `wet`, `dry` or half-and-half, with a white bin icon. A selected pin grows (`scale-125`) and gets a `ring-foreground`. A yellow dot at the top right means an open problem. The scale sits on the inner button, never on the marker element, which MapLibre positions with `transform`.
- **You**: a black dot (white in dark mode) with a soft halo and a heading cone once the device reports a direction. It sits above the pins but lets taps through.
- **Route line**: a `foreground` line on a `background` casing, so it inverts in dark mode like everything else.
- **Navigation**: a black instruction card at the top (`bg-primary`, turn icon, distance to the turn in `text-2xl` heading type, instruction text) and a summary sheet at the bottom (bin name, distance left in `text-3xl`, minutes, End, Google Maps). There's a floating "Re-centre" pill if you pan away.
- **Status pills**: "Finding your location…", "Zoom in to see bins" use `rounded-full bg-card px-5 py-3 shadow-float`, centred and `pointer-events-none`.
- **Confirmation banner** after adding a bin: a black card at the top with a green tick. It hides itself after 6 s.

## Landing page (`/`)

Editorial and type-led: big Inter Tight headlines ("Where's the nearest dustbin?", "Green for wet, blue for dry"), illustrations in `components/landing/illustrations.tsx` (the hero route draws once on load with `route-draw`, `pin-in` and `rise-in` in `globals.css`), and a black footer. There's only one motion moment, on load, and nothing animates on scroll.

## Admin

`AdminShell` gives a sidebar (Overview, Map, Cleaning, Bins, Activity, Users, Settings) on desktop and a top bar with a menu on phones. Each page uses `AdminPage` (a `text-3xl` title, a muted description, actions on the right) and `Panel` from `components/admin/parts.tsx`. The same tokens apply. Charts use `chart-1` to `chart-5` with `isAnimationActive={false}`, so screenshots and slow devices show data straight away. Admin maps colour pins by their worst problem (broken over full) and show search demand as a heatmap: blue where people searched, red where nobody found a bin nearby.

## Writing

- Say what happens: "Add bin", "Send report", "Report missing", "Confirm location". An action keeps its name through the flow ("Add a bin" → "Bin added").
- Buttons that can't be used yet say why: "Add a photo to continue", "Choose wet or dry", "Move the map to the bin".
- Errors say what went wrong and what to do: "You need to be within 50 m of the bin. Walk over and try again." Never "Error", never an apology.
- An empty state invites action: "No bins mapped here yet. Spotted one nearby? Add it and it'll show up for everyone."
- Indian English, metric units (`350 m`, `1.2 km`) and walking minutes at about 80 m a minute (`walkMinutes`).

## Accessibility

- Visible focus: `focus-visible:ring-2 ring-ring` on custom buttons. Base components bring their own.
- Icon-only buttons have an `aria-label` ("Your account", "Show my location"). Decorative icons are `aria-hidden`.
- Live areas: `role="status"` for banners, `aria-live="polite"` on the navigation card, `role="alert"` on form errors.
- Touch targets are at least 40 px, 48 px for main actions.
- The sheet handle is a real `<button>` with `aria-expanded`.
