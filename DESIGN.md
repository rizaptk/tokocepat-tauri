---
name: Kastoko POS
description: The Aurora Till — flat, sharp-cornered, tightly-set Windows 7 premium cashier with an aurora rail and a live receipt tape.
colors:
  primary: "hsl(211 100% 42%)"
  primary-foreground: "hsl(0 0% 100%)"
  win-chrome: "hsl(214 17% 91%)"
  panel-white: "hsl(0 0% 100%)"
  chrome-ink: "hsl(210 10% 15%)"
  hairline-pewter: "hsl(214 14% 79%)"
  muted-field: "hsl(214 15% 87%)"
  ledger-grey: "hsl(210 8% 40%)"
  control-grey: "hsl(214 14% 94%)"
  accent-grey: "hsl(214 16% 85%)"
  total-green: "hsl(142 52% 42%)"
  variance-amber: "hsl(34 92% 48%)"
  wholesale: "hsl(38 92% 50%)"
  wholesale-foreground: "hsl(38 92% 15%)"
  ticket-red: "hsl(8 74% 47%)"
  info-blue: "hsl(199 89% 48%)"
  rail-slate: "hsl(220 16% 14%)"
  rail-active: "hsl(211 95% 55%)"
  rail-muted: "hsl(220 10% 66%)"
  rail-hover: "hsl(220 14% 22%)"
  chart-1: "hsl(211 100% 50%)"
  chart-2: "hsl(280 60% 60%)"
  chart-3: "hsl(160 60% 45%)"
  chart-4: "hsl(28 90% 52%)"
  chart-5: "hsl(2 70% 55%)"
  tape-paper: "#FCFBF7"
  tape-ink: "#1B1A17"
typography:
  display:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 300
    lineHeight: 1
  heading:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.2em"
    textTransform: "uppercase"
  micro:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
  condensed:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.2
  mono:
    fontFamily: "Consolas, 'Cascadia Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "12px"
rounded:
  sm: "0px"
  md: "0px"
  lg: "2px"
  xl: "2px"
  2xl: "2px"
  full: "9999px"
spacing:
  1: "4px"
  1.5: "6px"
  2: "8px"
  2.5: "10px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "hsl(211 100% 38%)"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "32px"
  button-secondary:
    backgroundColor: "{colors.control-grey}"
    textColor: "hsl(210 12% 25%)"
    rounded: "{rounded.md}"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.chrome-ink}"
    rounded: "{rounded.md}"
    height: "32px"
  button-destructive:
    backgroundColor: "{colors.ticket-red}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    height: "32px"
  input-default:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.chrome-ink}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "4px 10px"
  table-head:
    textColor: "{colors.ledger-grey}"
    height: "24px"
    padding: "0 10px"
  card:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.chrome-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Kastoko

## Overview

**Creative North Star: "The Aurora Till"**

Kastoko's world is a flat, sharp-cornered, tightly-set point of sale that feels like a Windows 7 desktop you could lift: calm blue-grey chrome, one Aero-blue action colour, money as a spooling receipt tape, and a faint aurora gradient breathing through the rail. It is the era of the user's own machine read honestly — aero glass kept flat, glossy chrome stripped to a half-shine, Segoe UI back in charge — then tightened to cashier density and lifted to premium finish. The counter reads the way a well-serviced Windows desktop reads: familiar to the point of instinct, exact, and slightly satisfied with itself.

Flatness is the rule, not an option: no 8px rounded SaaS cards, no post-2020 soft gradients on surfaces, no emoji moods. The one permitted gradient is the aurora — a low-opacity teal→blue→violet spectral sweep that lives on the rail and chrome, never on the money. Tightness is the second rule: the interface keeps its dense rows and short line-heights, because a cashier's hands outpace this screen. Premium is the third: crisp 1px hairlines, Segoe UI Light digits on headline figures, a Start-orb-like brand mark, and a faint glass gloss where Windows 7 would have put it.

The memorable moment is the tape. As items ring, the payment success dialog spools a live ESC/POS-style receipt line by line — monospaced, right-aligned, tabular Rupiah, on a deep near-black stage — so the proof of any sale is already printed under the glass while the customer still leans on the counter. Nothing about the counter moved; the register just showed its work.

**Renamed identity:** formerly TokoCepat POS, now Kastoko POS (`package.json:name kastoko`, `0.7.0`). No visual tokens changed — the rename is nominal; Aero Blue, Win Chrome, and Tape Paper remain canonical.

**Layout invariants established in this pass:** `KasirKlasik` (`ClassicCashierPage.tsx`) is the fullwidth source — a single dense ledger occupying the full viewport width, the canonical pattern for transaction-heavy, keyboard-driven surfaces. `Produk` (`Product/page.tsx`) is the split-panel source — `md:grid md:grid-cols-10` with left `col-span-6` ledger + right `col-span-4` editor/detail (Pill tabs, `bg-muted/60` container, `p-1`), the canonical pattern for browse-then-edit surfaces. New list-detail surfaces copy one of the two, never invent a third.

**Anti-reference:** the post-2020 rounded-soft "SaaS cashier" (cards float, corners bend, gradients mist) and any skeuomorphic NCR fantasy (brass skins, leather strips, clattering digits). This world is flat, bright, and Windows-native; it wears its history as speed, not costume.

**Key Characteristics:**
- Sharp or near-sharp corners (0–2px) everywhere; rectangles over capsules.
- One Aero-blue action color; state hues reserved; the aurora gradient confined to the rail and brand mark.
- Segoe UI throughout; Consolas reserved for codes and the receipt tape.
- Dense rows and low line-heights; the keyboard (F1–F8) rules the register.
- A live receipt tape spools proof of each sale into the payment dialog.
- Two layout dialects: fullwidth ledger (KasirKlasik) vs split-panel browse/edit (Produk, Pelanggan, Piutang detail).

## Colors

A Windows-flat, blue-grey, premium palette: cool neutral chrome for surfaces, one committed Aero-blue, an aurora spectral band licensed only to the rail, and Windows-reserved state hues (green/red/amber) for money truth. The work surface stays calm and achromatic; the aurora is the only gradient and it never touches a number. Values are canonical from `src/globals.css` (`hsl(var(--token))`).

### Primary
- **Aero Blue** (`hsl(211 100% 42%)`): the one committed accent — primary actions, active nav, focus rings, selected rows (as a `10%` wash), and the grand-total bar. This is the colour the cashier reaches for with their thumb; everything else steps back.

### Neutral
- **Win Chrome** (`hsl(214 17% 91%)`): the flat workspace the app sits on — like a freshly logged-in Windows desktop (`--background`).
- **Panel White** (`hsl(0 0% 100%)`): flat desks that hold tables, forms, the cashier's cart table, and inputs (`--card` / `--field`).
- **Chrome Ink** (`hsl(210 10% 15%)`): primary text — a blue-grey not-quite-black, exactly as crisp as Win7 rendered it (`--foreground`).
- **Hairline Pewter** (`hsl(214 14% 79%)`): 1px borders and row strokes; bank-ledger thin (`--border`).
- **Muted Field** (`hsl(214 15% 87%)`): hover rows, chips, kbd keys, and washed tool bars — flat fills, no simulated depressions (`--muted`).
- **Control Grey** (`hsl(214 14% 94%)`): the raised grey control (secondary buttons), Win7's neutral chrome (`--secondary`).
- **Accent Grey** (`hsl(214 16% 85%)`): hover highlight on ghost controls and rows (`--accent`).
- **Ledger Grey** (`hsl(210 8% 40%)`): secondary text, captions, micro-headers, placeholders (`--muted-foreground`).

### Aurora (the licensed gradient — the world's one ornament)
- **The Aurora Band** (teal `hsl(180 70% 45%)` → Aero Blue `hsl(211 100% 50%)` → violet `hsl(260 60% 60%)`), rendered as a `linear-gradient(180deg, …)` at `0.16–0.20` opacity with `background-size: 100% 300%` drifting `18s` linear infinite (`.aurora-rail`): used **only** on the rail ("taskbar") chrome and the brand mark. In dark mode it reads as a glass aurora over black; in light, a spectral sheen over the dark rail. It never appears on a card, a number, or the work surface.

### State — Windows' own hues, money's law
- **Total Green** (`hsl(142 52% 42%)`): paid, balanced, stock healthy, and the change/paid readouts (`--success`).
- **Variance Amber** (`hsl(34 92% 48%)`): short change, low stock, unsynced state, shift variance flags (`--warning`).
- **Wholesale** (`hsl(38 92% 50%)`): grosir mode bar — amber distinct from variance, tokenized `bg-wholesale/12` light/dark, `wholesale-foreground` for ink (`--wholesale`).
- **Ticket Red** (`hsl(8 74% 47%)`): void, delete, destructive confirm — and only those (`--destructive`).
- **Info Blue** (`hsl(199 89% 48%)`): informational status, badges, banner accents (`--info`).

### Rail — the dark taskbar chrome
- **Rail Slate** (`hsl(220 16% 14%)`): the `48px` aurora rail's base (`--sidebar`).
- **Rail Active** (`hsl(211 95% 55%)`): the selected nav tile — Aero Blue, sharp-cornered (`--sidebar-active`).
- **Rail Muted / Rail Hover** (`hsl(220 10% 66%)` / `hsl(220 14% 22%)`): idle nav glyphs and their hover fill (`--sidebar-muted` / `--sidebar-hover`).

### Tape — thermal paper (theme-ignorant)
- **Tape Paper** (`#FCFBF7`): the receipt's always-paper background, whatever the app theme.
- **Tape Ink** (`#1B1A17`) with **Tape Ink Muted** (`#8B857B`): the ink that writes the sale.

### Charts
- **chart-1 … chart-5** (`hsl(211 100% 50%)`, `hsl(280 60% 60%)`, `hsl(160 60% 45%)`, `hsl(28 90% 52%)`, `hsl(2 70% 55%)`): the macOS-derived series for dashboard charts — blue, purple, teal, orange, red (`--chart-1` … `--chart-5`).

### Named Rules
**The Sharp-Corner Rule.** Corners are 0–2px. `rounded-md`/`rounded-sm` resolve to 0px and `rounded-lg`+ resolve to 2px in the token math. Rounded-domain interface, rounded cards, and rounded buttons belong to the world this replaces; rectangles read faster and they are the point. (`--radius: 0.125rem` / `--radius-lg: var(--radius)`)

**The Aurora-Discipline Rule.** The aurora gradient lives on the rail and the brand mark and nowhere else. The moment a gradient touches a Card, a Table, or a total, the counter has been dressed up instead of sped up. (`.aurora-rail` + `@keyframes aurora-drift 18s`)

**The One-OS Rule.** Surfaces speak Windows: Aero Blue for actions, Windows' green/red/amber for money state, Segoe UI for type. No hue enters the system that Windows itself would not have printed.

## Typography

**Display/UI Font:** Segoe UI (Windows-native; `'Segoe UI Variable Text'`, `'Segoe UI'`, `-apple-system, BlinkMacSystemFont, system-ui, sans-serif`), with **Segoe UI Light** weight (300) assigned to headline money figures — the Win7 big-number voice, flatted to premium. `--font-body` + `--font-headline` in `@theme`.
**Mono Font:** `Consolas`, `'Cascadia Mono'`, `ui-monospace`, `'SF Mono'`, `Menlo`, `monospace` — invoice numbers, voucher codes, reference IDs, and the receipt tape (`--font-mono` / `--font-code`).

**Character:** Windows-native, near-weightless, quietly confident. Hierarchy reads from weight (600/700) and Segoe's natural rectangular rhythm rather than from decoration. Big cash figures are Segoe UI Light at their full column width with tabular numerals and no decimals; micro-headers are the tightly-tracked uppercase Segoe UI used by the old shell.

### Hierarchy
- **Display** (Segoe UI, 300, 40px, 1.0): the grand total (`text-[2.5rem] font-light leading-none tracking-tight tabular-nums`) — the single biggest figure on the counter.
- **Heading** (Segoe UI, 600, 20px, 1.2): page titles and the shift-open "Buka Sif Baru" heading.
- **Title** (Segoe UI, 600, 16px, 1.2): card titles, dialog titles, section headers.
- **Body** (Segoe UI, 400, 14px, 1.35): the default operating size; tables run at 14px with 12px where density demands.
- **Micro** (Segoe UI, 400/600, 11px, 1.2): compact metadata and captions — list subtitles, timestamps, stock chips, badge text. `13px` is the condensed-body step for dense report rows and tab labels.
- **Label** (Segoe UI, 600, 10px, `0.2em`, uppercase): cashier micro-labels ("GRAND TOTAL", "UANG TUNAI CEPAT", "BAYAR TUNAI · F8"); table headers run the same voice at 12px, `0.05em`, uppercase.
- **Mono** (Consolas, 12px): codes, invoice, tape; the tape's own face renders at 9–13px on thermal paper.

### Named Rules
**The Segoe Rule.** All text is Segoe UI; mono is Consolas-family, reserved for codes and the tape. A second text face is a defect.

**The No-Decimal Rule.** Operating-surface Rupiah figures are whole numbers (`minimumFractionDigits: 0`), right-aligned, tabular — the tape totalling column never wiggles.

## Layout

Tight, desktop-first, Windows-native. The app shell keeps its fixed left rail — the **Aurora Taskbar**: `48px` wide, dark chrome with the aurora drifting vertically through it, `border-right` one hairline, a `1px` gloss highlight across its top. Operating screens sit on the flat Win Chrome ground; the header is a `40px` (`h-10`) flat chrome band with a hairline underline (`border-border/60 bg-background/80 backdrop-blur-md`).

- **Density budget:** interactive controls `28–32px` (`h-7`/`h-8`); cash inputs `h-9` (36px); buttons default `h-8` (32px), small `h-7` (28px); touch targets expand to `44px` on mobile via `h-11 md:h-7` / `size-11 md:size-8`. Table headers `24px` (`h-6`), table cells `py-1` (24px rows) / `px-2.5`. Card padding `16px`. Top bars `40px`.
- **Two dialects:**
  - **Fullwidth (KasirKlasik)** — `ClassicCashierPage.tsx` occupies the full viewport width: search + filter bar on top, dense `Table` ledger below. Keyboard (arrow → `bg-muted/40` row + `bg-primary/10` cell) is the primary navigation. No right panel — the transaction is the page.
  - **Split-panel (Produk / Pelanggan / Piutang detail)** — `w-full md:grid md:grid-cols-10` with left `col-span-6` ledger (`bg-background`) + right `col-span-4` editor (`bg-card md:border-l`). Right panel's tab container is `bg-muted/60 rounded-md p-1` with `PillButton` peers (`bg-background ring-1 ring-border` active). This is the canonical browse-then-edit pattern — copied for Customers (`PillButton: Pelanggan|Grup`) and Piutang detail.
- **Cashier split within KasirKlasik:** search bar + cart table left, payment rail right (`w-72`, grows to `24rem` at `lg`). The totals panel is capped by the **Aero Blue grand-total bar**, and the change/paid readouts are Windows green/amber.
- **The receipt stage:** payment success renders the thermal tape centered on a deep near-black stage (`#0d0e12`), teeth torn at top and bottom, `264px` wide, spooling line by line (see Elevation/Motion).
- **Targets:** desktop Windows mouse/keyboard; keyboard density wins over casual touch; a sale must survive on Scan → F8 → Enter alone. F1 search, F2 history, F3 park, F4 return, F5 voucher, F6 discount, F8 cash focus.
- **Responsive:** below `sm` the Aurora Taskbar becomes a bottom tab bar (`BottomNav`); ledgers and split panels collapse to single-column (`col-span-10` stacked) with `overflow-x-auto [scrollbar-width:thin]` on tables and `hidden md:flex` meta lines.

## Elevation & Depth

Flat, with exactly four depth gestures, all Windows 7 honest:

1. **The Aurora Taskbar** — the dark rail with its low-spec aurora drift; the app's one "expensive" surface.
2. **Gloss chrome** — a single, very faint top-edge highlight (`.gloss-chrome`: `inset 0 1px 0 hsl(0 0% 100% / 0.30)`) on primary buttons and the taskbar, Win7's flat take on glass.
3. **Hover response** — rows fill Muted Field (`hover:bg-muted/40`–`/50`), buttons shift colour (`hover:bg-primary/90`), ghost icons warm from Ledger Grey to Chrome Ink.
4. **The tape settle** — receipt lines latch in with a `150ms` opacity/translate settle (`ease-out`), a print-head landing, not a spring. The grand total also settles on a `0.3s` zero-bounce spring when it changes.

No panel floats. Working surfaces are flat panels separated by hairline, set on the chrome ground — the deep hierarchy comes from ink weight and the rail's darkness, never from drop shadows. The only sanctioned shadow lives on the modal: a **receipt paper cast** (`0 24px 60px -18px rgba(0,0,0,0.75)`) under the tape's thermal paper, which is a printed object, not a panel.

### Named Rules
**The Flat-Chrome Rule.** At rest every working surface is flat; the only shine allowed is the Win7 gloss highlight on primary chrome, and the only depth is the rail. A dropped shadow on a panel is a bug, not a style — the paper on the stage is the one exception, because it is paper.

## Shapes

Sharp and rectangular, with one licensed curve:

- **Surfaces (cards, dialogs, panels):** corners `2px` (`rounded-lg` = `var(--radius)`); flat sheets, not puffed cushions. Stats cards use `rounded-[2px]`. The receipt dialog's paper container uses `rounded-[2px]`.
- **Controls (buttons, inputs, badges, selects):** corners `0px` (`rounded-md` = `calc(var(--radius)-2px)`); buttons read as flat tabs. `rounded` (4px) survives only on seated `kbd` key caps.
- **The one curve:** the **Start Orb** — a circular (`rounded-full`) brand mark where the aurora closes; plus `rounded-full` where a single seated token (a success check, a dot, a count) must not collide. Everything else is square.
- **Edges:** 1px hairlines everywhere; `hsl(214 14% 79%)` at full opacity for structural separators, 60% on chrome (`--border` at `border-border/60` for chrome bars). Sharp enough to cut a receipt.

### Named Rules
**The Rectangle Rule.** Unless it is the Start Orb or a seated dot, the profile is a rectangle. Rounding is an error this build refuses, not a knob to tune.

## Components

*[Implemented and carbonized from source — `src/globals.css` + `src/components/ui/*` + `ClassicCashierPage.tsx` + `Product/page.tsx` + `Dashboard/piutang|customers/page.tsx`. Radius and height values are the token-resolved numbers, not Tailwind class names.]*

### Buttons
- **Shape:** rectangles (`0px`, `rounded-md`); `kbd` key caps alone take 4px.
- **Primary (default):** Aero Blue fill, white text, `h-8` (32px) `px-3`, `.gloss-chrome` top shine; hover `bg-primary/90`, active `/80`. The BAYAR action is `h-12` (48px) `text-lg font-black`. On touch, expands to `h-11`/`size-11` then collapses at `md`.
- **Secondary:** Control Grey fill (`hsl(214 14% 94%)` / `--secondary`), dark text, hover `/80` — the PARKIR action's chrome.
- **Outline:** Panel White fill, `1px` Hairline Pewter stroke (`--border`), hover Accent Grey — voucher/discount quick-actions and "Detail".
- **Ghost:** no fill, Accent Grey hover — row icon actions (qty ±, trash, `X` clear).
- **Destructive:** Ticket Red fill, white text, hover `/90` — void confirm, Tutup Sif.
- **Success / Warning / Info:** tinted (`/40`) fill with a `60%` border, Windows-green/amber/blue — change and status actions.
- **Pill (split-panel tabs & filters):** `h-11 md:h-7` / `px-3` `text-xs gap-1.5 flex-1` inside `bg-muted/60 rounded-md p-1`; active `bg-background ring-1 ring-inset ring-border text-foreground`. The same primitive powers Product's `FilterPill`, Customers' `FilterPill/PillButton`, and Piutang's `FilterPill`.

### Inputs / Fields
- **Style:** Panel White fill (`bg-field` / `--field`), `1px` Hairline stroke, rectangles (`0px`), `h-8` default (`bg-card` on ledgers so field lifts off `bg-background` ground). Dark mode `/* field: 220 10% 12% */` slightly darker than `card`.
- **Cash input:** `h-9` (36px) `border-2`, Segoe UI bold, `pl-8` (`pl-10` with `Rp` adornment in Piutang dialog), tabular; the counter's primary numeric surface.
- **Search with clear:** `pl-9 pr-9` `h-8 bg-card` + absolute `size-6` `X` clear at `right-1` (`hover:bg-accent`), mirroring Customers/Piutang. Hidden label `sr-only`.
- **Focus:** `2px` Aero Blue ring with `2px` offset (`focus-visible:ring-ring`), never a glow. `selection:bg-primary selection:text-primary-foreground` on root.
- **In-cell qty edit (cart):** `w-16 h-7`, centered, bold, `ring-1 ring-primary` while editing; commits on blur or Enter.

### Tables
- **Character:** ledger-dense, bank-thin. Head rows `h-6` (24px), uppercase `11px` `tracking-wider` labels (`text-muted-foreground`), Hairline `border-b`; body cells `py-3 md:py-2.5`, `14px`; rows separated by 1px hairlines. Heads use `text-[11px] font-semibold uppercase tracking-wider` (carbonized from Piutang/Customers after audit). Same body across cashier cart, product, inventory, promo, and piutang.
- **State:** hover fills Muted Field (`hover:bg-muted/40 transition-colors`); the keyboard-active cart row fills `bg-muted/40` and its focused cell gets a `bg-primary/10` wash. `focus-within:bg-muted/40` on piutang rows. No zebra stripes — hover is the only row state.
- **Money columns:** right-aligned, `font-bold tabular-nums`, whole Rupiah. Sisa remains `text-destructive`.
- **Empty states:** illustrated — `Wallet`/`Users`/`Layers` at `size-8 opacity-30` centered in `h-40` `py-6`, with primary + secondary copy and `Reset filter` / `Hapus filter` CTA. Loading uses 5-row `Skeleton` (`h-4` swatches).
- **Responsive:** `overflow-x-auto [scrollbar-width:thin] min-w-[760px]` on 8-col piutang ledger; single-column card fallback available.

### Badges
- **Style:** `rounded-md` (0px) `px-2 py-0.5`, `12px` medium; solid Aero Blue for default, tinted `/40` fills with dark ink for success/warning/info, `rounded-none` for `Cicilan` outline, solid Ticket Red for destructive. Piutang's `Piutang` uses `bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30` (amber, not red — Money's law).

### Cards / Containers
- **Corner Style:** `2px` (`rounded-lg` / `rounded-[2px]` on stats).
- **Background:** Panel White on Win Chrome ground; `border` Hairline. Overdue stat adds `border-destructive/50 bg-destructive/[0.03]` wash.
- **Shadow Strategy:** none — flat sheets on the chrome ground (see Elevation).
- **Internal Padding:** `16px` (`p-4`), stats use `p-3 pb-1` header + `px-3 pb-3` body. `space-y-4` in editors.
- **Selection:** `selection:bg-primary` on ledger roots.

### Navigation
- **The Aurora Taskbar:** `48px` fixed rail, Rail Slate fill (`--sidebar`), aurora drift overlay (`18s linear infinite`, pauses at `prefers-reduced-motion`), `1px` top gloss, `border-r` hairline. Nav tiles `36px` square, `2px` corners; the active tile is Aero Blue with a spring-animated shared layout (`layoutId`), idle glyphs Rail Muted warming to white on hover. Tooltips sit right of the rail.
- **Header:** `40px` flat chrome band, `sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md`; holds `TokoCepatLogo` (now Kastoko) + `Wallet Piutang Grosir` + live `filtered/count` + search + `Select` + `NotificationBell` + `ThemeToggle` (piutang pattern). Other dashboards share the same `h-10` spec; Kastoko logo is the home link (`aria-label="Kembali ke beranda"`).
- **Mobile:** the rail becomes a bottom tab bar; the cashier's ledgers and split panels collapse into a single column flow. Piutang's header search hides at `hidden sm:block` with a duplicate `sm:hidden` block below; Customers' ledger meta uses `hidden md:flex` vs `flex md:hidden`.

### Kbd (shortcut keycap)
- `h-5 min-w-5 px-1.5`, `4px` corners, Hairline border, Muted Field fill, Consolas `10px` semibold, Ledger Grey text — the F1–F8 legend printed along the counter's base. (F1 search, F2 history, F3 park, F4 return, F5 voucher, F6 discount, F8 cash focus.)

### Start Orb (brand mark)
- `24–28px` circle with a `radial-gradient(circle at 32% 28%, #5ad2d6, #0a84ff 55%, #9671ee)` aurora core and a `.gloss-chrome` half-shine — the only licensed curve, the world's mark.

### ReceiptTape (signature component)
- 264px-wide thermal paper on a `#0d0e12` stage; torn-tooth edges top/bottom; paper `#FCFBF7`, ink `#1B1A17`; a faint `0.08→0` top shading and `1px/3px` ruled scanlines over the paper. Prints store name (`0.22em` tracking), meta, `2px` dashed rules, ledger rows (dotted leader, right-aligned tabular), `3px` double rule, a solid-ink TOTAL block, TUNAI/KEMBALI, a seeded faux barcode, and "TERIMA KASIH". A `#E5484D` print head sweeps the tape; each line settles in (150ms) as it passes. Theme-ignorant by design — paper is always paper. `bonus_label` (`1 bonus`) renders in `LED` red beside the item name.

### Dialog (Piutang pay pattern)
- `sm:max-w-sm`, `rounded-[2px]`, header `DialogTitle` with live invoice, `DialogDescription sr-only` for a11y, 4-line `bg-muted p-3` summary with `border-t` sisa in `text-destructive tabular-nums`, `Rp` adorned `Input pl-8`, `aria-describedby="pay-sisa pay-error"` + `aria-invalid` + `role="alert"` error, footer `ghost Batal` + primary `Konfirmasi Bayar disabled={!payValid}` and focus return via `lastTriggerRef`.

## Do's and Don'ts

### Do:
- **Do** keep rows tight and line-heights short (24px table rows, `py-1` cells, 1.35 body) — density is the premium.
- **Do** let the receipt tape print every rung of a sale in Consolas, right-aligned, tabular, whole-rupiah — proof is the product.
- **Do** confine colour to Aero Blue actions and Windows' green/red/amber money states; a calm counter has one committed accent.
- **Do** use the aurora only on the rail and the brand mark, at `0.16–0.20` opacity, drifting `18s`.
- **Do** keep void, delete, and close-shift behind confirm dialogs painted Ticket Red; keep the keyboard (scan → qty → F8 → Enter) as the fastest path.
- **Do** mark the keyboard-active row and its focused cell (`bg-muted/40` + `bg-primary/10`) so a hands-on-cashier always knows where the cursor is.
- **Do** copy the established dialect: fullwidth ledger for KasirKlasik, split-panel `grid-cols-10` for browse-then-edit; don't invent a third.

### Don't:
- **Don't** round corners beyond 2px, add drop shadows to panels, or put gradients anywhere but the rail and mark — flat chrome reads faster and premium is not decoration.
- **Don't** touch money with the aurora or with soft tints; the tape, the totals, and the change readout stay achromatic and tabular until Total Green (or Variance Amber) arrives.
- **Don't** introduce a second typeface or a cursive/display face — Segoe UI is the voice, Consolas writes the receipts.
- **Don't** let the rail's darkness leak into the work surface (it owns the left `48px` and the taskbar chrome, nothing else).
- **Don't** show decimals on Rupiah figures, zebra-stripe tables (hover is the only row state), or animate layout during ringing — the tape settles, nothing swims.
- **Don't** invent a new header; `sticky h-10 border-border/60 backdrop-blur-md` with logo + search + bell + theme is the system header.

