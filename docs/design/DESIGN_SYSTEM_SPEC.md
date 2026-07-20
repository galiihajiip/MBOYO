---
name: Humanitarian Operational Excellence
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf4'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dde9ff'
  surface-container-highest: '#d5e3fd'
  on-surface: '#0d1c2f'
  on-surface-variant: '#43474c'
  inverse-surface: '#233144'
  inverse-on-surface: '#ebf1ff'
  outline: '#73777d'
  outline-variant: '#c3c7cd'
  surface-tint: '#4b6075'
  primary: '#00060e'
  on-primary: '#ffffff'
  primary-container: '#082032'
  on-primary-container: '#73889e'
  inverse-primary: '#b3c9e1'
  secondary: '#006874'
  on-secondary: '#ffffff'
  secondary-container: '#66e9fd'
  on-secondary-container: '#006773'
  tertiary: '#000604'
  on-tertiary: '#ffffff'
  tertiary-container: '#00231e'
  on-tertiary-container: '#109685'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cfe5fe'
  primary-fixed-dim: '#b3c9e1'
  on-primary-fixed: '#051d2f'
  on-primary-fixed-variant: '#34495c'
  secondary-fixed: '#98f0ff'
  secondary-fixed-dim: '#51d8eb'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#87f6e1'
  tertiary-fixed-dim: '#6ad9c5'
  on-tertiary-fixed: '#00201b'
  on-tertiary-fixed-variant: '#005046'
  background: '#f8f9ff'
  on-background: '#0d1c2f'
  surface-variant: '#d5e3fd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-lg:
    fontFamily: IBM Plex Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  data-md:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding-mobile: 16px
  container-padding-desktop: 40px
  gutter: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style
The design system is engineered for high-stakes humanitarian coordination and disaster response. The brand personality is **authoritative yet calm**, prioritizing utility and clarity over aesthetic flair. It must instill confidence in field reporters operating in stressful environments while providing precision for regional coordinators.

The visual style is **Corporate / Modern** with a lean toward **Tactile precision**. By utilizing large, rounded surfaces (16-20px) paired with technical typography, the interface balances "Humanitarian Care" with "Operational Technology." It avoids decorative gradients in favor of flat, semantic color blocking that communicates status instantly.

**Key Principles:**
- **Calmness:** Ample negative space to reduce cognitive load during emergencies.
- **Precision:** Monospaced data points for coordinates and IDs to prevent reading errors.
- **Resilience:** Visual cues that distinguish between "Offline/Queued" and "Live" states.

## Colors
The palette is rooted in **Ink Navy** and **Deep Ocean**, providing a stable, institutional foundation. High-visibility accents like **Signal Cyan** and **Relief Teal** are used for interactive elements and progress indicators.

**Severity Mapping:**
Color is the primary vehicle for triage.
- **Critical Red (#D83A3A)** is strictly reserved for "Destroyed" or "Life-Threatening" states.
- **Priority Orange (#F47A38)** indicates major structural damage.
- **Caution Amber (#F6B73C)** indicates minor functional impairment.
- **Safe Green (#2EAD68)** signals a cleared or functional status.

**Neutral Tones:**
- **Mist (#E8F0F4)** is used for secondary backgrounds and inactive states.
- **Slate (#334155)** provides high-contrast legibility for body text.

## Typography
The system uses a dual-font approach to separate narrative information from technical data.

1.  **Plus Jakarta Sans:** Used for all UI controls, headings, and descriptive text. Its friendly yet professional curves keep the interface approachable for field workers.
2.  **IBM Plex Mono:** Used exclusively for non-narrative data including:
    *   Report IDs (e.g., `#REP-2024-001`)
    *   GPS Coordinates
    *   Timestamps
    *   Quantities (e.g., "150 Korban")

**Scaling:**
On mobile devices, `headline-xl` should scale down to 24px to ensure critical titles remain visible above the fold.

## Layout & Spacing
The design system utilizes a **Fluid Grid** for dashboards and a **Single-Column Stack** for mobile field reporting.

- **Mobile:** Uses a bottom-heavy navigation model for one-handed use. Content is padded at 16px from the screen edge.
- **Desktop:** A fixed sidebar (280px) for navigation with a 12-column grid for data visualization and report cards.
- **Gaps:** A consistent 20px gutter ensures that even dense data tables or card clusters remain legible and "breathable."

**Offline Visibility:** A persistent 4px top-border or status bar indicates the "Sync" status (e.g., Blue for online, Amber for local-only queue).

## Elevation & Depth
Depth is used functionally to indicate priority and "touchability."

- **Level 0 (Canvas):** Mist (#E8F0F4) or Cloud White.
- **Level 1 (Cards/Surface):** Pure White with a subtle 1px border (#D7E3E9). This is the default for report items.
- **Level 2 (Active/Floating):** Used for modals or floating action buttons. Uses a soft, diffused shadow: `0 8px 24px rgba(8, 32, 50, 0.08)`.
- **Interactions:** Buttons use a slight "press" effect (downward shift) rather than a glow, emphasizing the tactile, physical nature of the tool.

## Shapes
The shape language is defined by large, approachable radii that soften the technical nature of the platform.

- **Primary Containers:** 16px to 20px corner radius.
- **Input Fields:** 8px radius to maintain a distinct "functional" look separate from the cards they sit on.
- **Buttons:** 12px radius or fully pill-shaped for high-visibility actions.
- **Status Pills:** Fully rounded (pill) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Ink Navy background, White text. High-contrast for "Submit Report."
- **Secondary:** Signal Cyan. Used for "Add Media" or "Edit."
- **Success/Warning/Critical:** Semantic backgrounds for "Verify," "Escalate," or "Delete."
- **Ghost:** Used for navigation within complex forms to prevent visual clutter.

### Status & Severity Badges
- **Severity Badges:** High-contrast text on semi-transparent semantic backgrounds (e.g., "Hancur Total" uses Critical Red at 15% opacity with 100% opacity text).
- **Workflow Badges:** Use Mist or Slate for "Draf" and "Arsip." Use Relief Teal for "Terverifikasi" to show a positive path.

### Forms & Inputs
- **Map Pin:** Large, draggable handle with a 44px touch target.
- **Camera Upload:** Large 20px rounded "Dropzone" style area with a clear iconography for "Ambil Foto."
- **Offline Sync Indicator:** A specific component showing a counter (e.g., "3 Antrean") with a pulse animation during synchronization.

### Navigation
- **Public/Field Header:** Minimalist, showing only the current Location and Sync Status.
- **Mobile Bottom Nav:** Large icons (32px) for "Lapor," "Riwayat," and "Profil" to facilitate rapid access in the field.
- **Sidebar (Admin/Coord):** Stacked navigation with nested categories for "Wilayah," "Relawan," and "Analitik."
