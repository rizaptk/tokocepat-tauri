<!-- SEED: established with the user before implementation; re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: TokoCepat POS
description: The Aurora Till — flat, sharp-cornered, tightly-set Windows 7 premium cashier with an aurora gradient rail and a spooling receipt tape.
---

# Design System: TokoCepat

## Overview

**Creative North Star: "The Aurora Till"**

TokoCepat's new world is a flat, sharp-cornered, tightly-set point of sale that feels like a Windows 7 desktop you could lift: calm blue-grey chrome, one Aero-blue action colour, money as a spooling receipt tape, and a faint aurora gradient breathing through the rail. It is the era of the user's own machine read honestly — aero glass kept flat, glossy chrome stripped to a half-shine, Segoe UI back in charge — then tightened to cashier density and lifted to premium finish. The counter reads the way a well-serviced Windows desktop reads: familiar to the point of instinct, exact, and slightly satisfied with itself.

Flatness is the rule, not an option: no 8px rounded SaaS cards, no post-2020 soft gradients on surfaces, no emoji moods. The one permitted gradient is the aurora — a low-opacity teal→blue→violet spectral sweep that lives on the rail and chrome, never on the money. Tightness is the second rule: the interface keeps its dense rows and short line-heights, because a cashier's hands outpace this screen. Premium is the third: crisp 1px hairlines, Segoe UI Light digits on headline figures, a Start-orb-like brand mark, and a faint glass gloss where Windows 7 would have put it.

The memorable moment is the tape. As items ring, the totals panel spools a live ESC/POS-style receipt line by line — monospaced, right-aligned, tabular Rupiah — so the proof of any sale is already printed under the glass while the customer still leans on the counter. Nothing about the counter moved; the register just showed its work.

**Anti-reference:** the post-2020 rounded-soft "SaaS cashier" (cards float, corners bend, gradients mist) and any skeuomorphic NCR fantasy (brass skins, leather strips, clattering digits). This world is flat, bright, and Windows-native; it wears its history as speed, not costume.

**Key Characteristics:**
- Sharp or near-sharp corners (0–2px) everywhere; rectangles over capsules.
- One Aero-blue action color; state hues reserved; the aurora gradient confined to the rail and chrome.
- Segoe UI throughout, mono spare for codes and the receipt tape.
- Dense rows and low line-heights; the keyboard rules the register.
- A live receipt tape spools proof of each sale into the totals panel.

## Colors

A Windows-flat, blue-grey, premium palette: cool neutral chrome for surfaces, one committed Aero-blue, an aurora spectral band licensed only to the rail, and Windows-reserved state hues (green/red/amber) for money truth. The work surface stays calm and achromatic; the aurora is the only gradient and it never touches a number.

### Primary
- **Aero Blue** (`[to be resolved during implementation]`; directional anchor near Windows accent `#0078D7`, hsl-family `211 100% 42%`): the one committed accent — primary actions, active nav, focus rings, selected states, and the chart's first series. This is the colour the cashier reaches for with their thumb; everything else steps back.

### Neutral
- **Win Chrome** (directional `hsl(210 12% 97%)`): the flat workspace the app sits on — like a freshly logged-in Windows desktop.
- **Panel White** (`[to be resolved during implementation]`, near `#FFFFFF`): flat desks that hold tables, forms, and the tape.
- **Chrome Ink** (near `hsl(210 10% 15%)`): primary text — a blue-grey not-quite-black, exactly as crisp as Win7 rendered it.
- **Hairline Pewter** (near `hsl(210 10% 88%)`): 1px borders and row strokes; bank-ledger thin.
- **Muted Field** (near `hsl(210 12% 93%)`): chips, hover rows, and input wells — flat fills, no simulated depressions.
- **Ledger Grey** (near `hsl(210 8% 48%)`): secondary text, captions, micro-headers, placeholders.

### Aurora (the licensed gradient — the world's one ornament)
- **The Aurora Band** (teal `hsl(180 70% 45%)` → Aero Blue `hsl(211 100% 50%)` → violet `hsl(260 60% 60%)`), rendered at `10–25%` opacity as a slow vertical drift: used **only** on the rail ("taskbar") chrome and the brand mark. In dark mode it reads as a glass aurora over black; in light, a spectral sheen over the dark rail. It never appears on a card, a number, or the work surface.

### State — Windows' own hues, money's law
- **Total Green** (`[to be resolved during implementation]`, near `hsl(142 52% 42%)`): paid, balanced, stock healthy, and the tape's final total.
- **Variance Amber** (`[to be resolved during implementation]`, near `hsl(34 92% 48%)`): low stock, unsynced state, expiry-soon, shift variance flags.
- **Ticket Red** (`[to be resolved during implementation]`, near `hsl(8 74% 50%)`): void, delete, destructive confirm — and only those.

### Named Rules
**The Sharp-Corner Rule.** Corners are 0–2px. Rounded-domain interface, rounded cards, and rounded buttons belong to the world this replaces; rectangles read faster and they are the point.

**The Aurora-Discipline Rule.** The aurora gradient lives on the rail and the brand mark and nowhere else. The moment a gradient touches a Card, a Table, or a total, the counter has been dressed up instead of sped up.

**The One-OS Rule.** Surfaces speak Windows: Aero Blue for actions, Windows' green/red/amber for money state, Segoe UI for type. No hue enters the system that Windows itself would not have printed.

## Typography

**Display/UI Font:** Segoe UI (Windows-native; `'Segoe UI Variable Text'`, `'Segoe UI'`, `system-ui, sans-serif`), with **Segoe UI Light** assigned to headline money figures — the Win7 big-number voice, flatted to premium.
**Mono Font:** `Consolas`, `'Cascadia Mono'`, `monospace` — invoice numbers, voucher codes, reference IDs, and the receipt tape.

**Character:** Windows-native, near-weightless, quietly confident. Hierarchy reads from weight (600/700) and Segoe's natural rectangular rhythm rather than from decoration. Big cash figures are Segoe UI Light at their full screen width with tabular numerals and no decimals; micro-headers are the tightly-tracked uppercase Segoe UI used by the old shell.

### Hierarchy
- **Display** (Segoe UI Light, 24px, 700, 1.15): dashboard headline figures and the big total.
- **Heading** (Segoe UI, 18px, 600): page titles.
- **Title** (Segoe UI, 16px, 600): card titles and section headers.
- **Body** (Segoe UI, 14px, 400, 1.35 line-height — tighter than modern defaults, per the brief): the default operating size; tables may drop to 12–13px for density.
- **Label** (Segoe UI, 12px, 500, `0.04em`, uppercase): table column headers, micro-tags.
- **Mono** (Consolas, 13px): codes, invoice, tape.

### Named Rules
**The Segoe Rule.** All text is Segoe UI; mono is Consolas-family, reserved for codes and the tape. A second text face is a defect.
**The No-Decimal Rule.** Operating-surface Rupiah figures are whole numbers, right-aligned, tabular — the tape totalling column never wiggles.

## Layout

Tight, desktop-first, Windows-native. The app shell keeps its fixed left rail — now the **Aurora Taskbar**: `48px` wide, dark chrome with the aurora drifting vertically through it, `border-right` one hairline. Operating screens sit on the flat Win Chrome ground; top bars are `36–40px` (`h-9`/`h-10`) flat chrome bands with a hairline underline — thinner than the previous `48px`, per "tight".

- **Density budget (the new floor, tighter than the replaced system):** interactive controls `28–32px` (`h-7`/`h-8`); cash inputs `h-9`. Table rows `28px` tall (`py-1.5`), column headers `28–32px`, cells `px-2.5`. Card padding `12–16px`. Everything the previous world did at 8, this one does at 6.
- **The cashier split:** product listing left + cart right; the totals panel ends in the **receipt tape** — a Consolas, right-aligned spool where each rung of the sale prints itself line by line (see Elevation/Motion and the surface brief).
- **Targets:** desktop Windows mouse+keyboard and — where the brief affirmed — keyboard density wins over casual touch; a sale must survive on Enter/Scan alone.
- **Responsive:** below `sm` the Aurora Taskbar becomes a bottom tab bar; tables degrade to compact rows. Breakpoints stay the Tailwind defaults; the rhythm of "tight" is a density constant, not a breakpoint switch.

## Elevation & Depth

Flat, with exactly four depth gestures, all Windows 7 honest:

1. **The Aurora Taskbar** — the dark rail with its low-spec aurora drift; the app's one "expensive" surface.
2. **Gloss chrome** — a single, very faint top-edge highlight (a half-shine `inset 0 1px 0` light line) on primary buttons and the taskbar, Win7's flat take on glass.
3. **Hover response** — rows fill Muted Field (`hover:bg-muted/50`), buttons shift colour (`hover:bg-primary/90`), ghost icons warm from Ledger Grey to Chrome Ink.
4. **The tape settle** — tape lines latch in with a `150ms` opacity/translate settle, a print-head landing, not a spring.

No card floats. Cards are flat panels separated by hairline, set on the chrome ground — the deep hierarchy comes from ink weight and the rail's darkness, never from drop shadows.

### Named Rules
**The Flat-Chrome Rule.** At rest every surface is flat; the only shine allowed is the Win7 gloss highlight on primary chrome, and the only depth is the rail. A dropped shadow on a panel is a bug, not a style.

## Shapes

Sharp and rectangular, with one licensed curve:

- **Surfaces (cards, dialogs, panels):** corners `0–2px` (`rounded-none`–`rounded-[2px]`). Flat sheets, not puffed cushions.
- **Controls (buttons, inputs, badges, selects):** corners `0–2px`; buttons read as flat tabs.
- **The one curve:** the **Start Orb** — a circular (or a `rounded-full`) brand mark / "endpoint" where the aurora closes; and full-pill where a single seated token (a dot, a count) must not collide. Everything else is square.
- **Edges:** 1px hairlines everywhere; 60% opacity on chrome, full opacity on structural separators. Sharp enough to cut a receipt.

### Named Rules
**The Rectangle Rule.** Unless it is the Start Orb or a seated dot, the profile is a rectangle. Rounding is an error this build refuses, not a knob to tune.

## Components

*[No components exist yet — this is a pre-implementation seed. The component layer lands when the world is built and then gets documented by a scan pass. The durable contracts above (sharp corners, aurora rail, Segoe UI, receipt tape, tight rows) bind any component authored from here.]*

## Do's and Don'ts

### Do:
- **Do** keep rows tight and line-heights short (28px rows, 1.3–1.4 leading) — density is the premium.
- **Do** let the receipt tape print every rung of a sale in Consolas, right-aligned, tabular, whole-rupiah — proof is the product.
- **Do** confine colour to Aero Blue actions and Windows' green/red/amber money states; a calm counter has one committed accent.
- **Do** use the aurora only on the rail and the brand mark, at `10–25%` opacity, drifting slowly.
- **Do** keep void, delete, and close-shift behind confirm dialogs painted Ticket Red; keep the keyboard (scan → qty → Enter → pay) as the fastest path.

### Don't:
- **Don't** round corners beyond 2px, add drop shadows to panels, or put gradients anywhere but the rail and mark — flat chrome reads faster and premium is not decoration.
- **Don't** touch money with the aurora or with soft tints; the tape and the totals stay achromatic and tabular until Total Green arrives at close.
- **Don't** introduce a second typeface or a cursive/display face — Segoe UI is the voice, Consolas writes the receipts.
- **Don't** let the rail's darkness leak into the work surface (it owns the left `48px` and the taskbar chrome, nothing else).
- **Don't** show decimals on Rupiah figures, zebra-stripe tables (hover is the only row state), or animate layout during ringing — the tape settles, nothing swims.