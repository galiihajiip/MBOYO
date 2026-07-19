/**
 * Typography tokens per docs/design/DESIGN_SYSTEM_SPEC.md front matter and
 * AGENTS.md ("Plus Jakarta Sans for UI, IBM Plex Mono for IDs, coordinates,
 * model versions, and metrics"). Exposed as Tailwind-consumable className
 * fragments so components never inline a font-family/size combination.
 */

export const fontFamily = {
  sans: "var(--font-plus-jakarta-sans)",
  mono: "var(--font-ibm-plex-mono)",
} as const;

/**
 * Named type scale — maps to the DESIGN_SYSTEM_SPEC.md `typography` block.
 * Each entry is a Tailwind utility string combination consumable directly
 * in a component's className.
 */
export const textStyle = {
  "headline-xl": "font-sans text-[36px] font-bold leading-[44px] tracking-[-0.02em] max-sm:text-2xl",
  "headline-lg": "font-sans text-[28px] font-bold leading-9 tracking-[-0.01em]",
  "headline-md": "font-sans text-xl font-semibold leading-7",
  "body-lg": "font-sans text-lg leading-7",
  "body-md": "font-sans text-base leading-6",
  "body-sm": "font-sans text-sm leading-5",
  "data-lg": "font-mono text-lg font-semibold leading-6",
  "data-md": "font-mono text-sm font-medium leading-5",
  "label-caps": "font-sans text-xs font-bold leading-4 tracking-[0.05em] uppercase",
} as const;

export type TextStyleName = keyof typeof textStyle;
