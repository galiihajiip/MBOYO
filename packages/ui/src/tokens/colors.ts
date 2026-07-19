/**
 * MBOYO color tokens — the single source of truth for every color used
 * across packages/ui. No component or app screen may hardcode a hex value
 * for severity, priority, or status — import from here instead.
 *
 * Two token layers:
 *  - Brand/semantic tokens (docs/design/DESIGN_SYSTEM_SPEC.md "Colors" section,
 *    matching AGENTS.md's original brand palette) — used for severity,
 *    priority, and workflow-status color coding, since docs/product/CONTENT_GUIDE.md
 *    maps these 1:1 to enum values.
 *  - Surface/container tokens (docs/design/DESIGN_SYSTEM_SPEC.md front-matter
 *    `colors` block) — used for general UI chrome (backgrounds, borders, text).
 */

export const brandColors = {
  inkNavy: "#082032",
  deepOcean: "#0B3A53",
  signalCyan: "#18B6C9",
  reliefTeal: "#1F9D8B",
  safeGreen: "#2EAD68",
  cautionAmber: "#F6B73C",
  priorityOrange: "#F47A38",
  criticalRed: "#D83A3A",
  cloudWhite: "#F7FAFC",
  mist: "#E8F0F4",
  slate: "#334155",
  muted: "#64748B",
  night: "#06141F",
  border: "#D7E3E9",
} as const;

/**
 * Severity color mapping — docs/product/CONTENT_GUIDE.md "Severity Labels"
 * table. Every SeverityBadge use must resolve its color through this map,
 * never an inline hex value.
 */
export const severityColors = {
  unknown: brandColors.muted,
  no_damage: brandColors.safeGreen,
  minor_damage: brandColors.cautionAmber,
  major_damage: brandColors.priorityOrange,
  destroyed: brandColors.criticalRed,
} as const;

/**
 * Priority color mapping — docs/product/CONTENT_GUIDE.md "Priority Labels"
 * table.
 */
export const priorityColors = {
  unassigned: brandColors.muted,
  low: brandColors.safeGreen,
  medium: brandColors.cautionAmber,
  high: brandColors.priorityOrange,
  critical: brandColors.criticalRed,
} as const;

/**
 * On-color text pairing — every background token above has exactly one
 * correct foreground text color, satisfying WCAG contrast. Amber and
 * caution tones use dark text (docs/design/DESIGN_SYSTEM_SPEC.md note:
 * "amber uses readable dark text") since white-on-amber fails contrast.
 */
export const onColor: Record<string, string> = {
  [brandColors.inkNavy]: brandColors.cloudWhite,
  [brandColors.deepOcean]: brandColors.cloudWhite,
  [brandColors.signalCyan]: brandColors.night,
  [brandColors.reliefTeal]: brandColors.cloudWhite,
  [brandColors.safeGreen]: brandColors.night,
  [brandColors.cautionAmber]: brandColors.night,
  [brandColors.priorityOrange]: brandColors.night,
  [brandColors.criticalRed]: brandColors.cloudWhite,
  [brandColors.mist]: brandColors.night,
  [brandColors.muted]: brandColors.cloudWhite,
};

/**
 * Surface/container tokens from docs/design/DESIGN_SYSTEM_SPEC.md front matter.
 * Used for page backgrounds, card surfaces, and general chrome — not for
 * severity/priority/status semantics (use the maps above for those).
 */
export const surfaceColors = {
  surface: "#f8f9ff",
  surfaceDim: "#ccdbf4",
  surfaceBright: "#f8f9ff",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#eff4ff",
  surfaceContainer: "#e6eeff",
  surfaceContainerHigh: "#dde9ff",
  surfaceContainerHighest: "#d5e3fd",
  onSurface: "#0d1c2f",
  onSurfaceVariant: "#43474c",
  inverseSurface: "#233144",
  inverseOnSurface: "#ebf1ff",
  outline: "#73777d",
  outlineVariant: "#c3c7cd",
  background: "#f8f9ff",
  onBackground: "#0d1c2f",
} as const;

export type SeverityClass = keyof typeof severityColors;
export type PriorityLevel = keyof typeof priorityColors;
