/**
 * Kinetic Codex Design Tokens
 *
 * Two-layer architecture following Ousterhout principles:
 * - Primitives (DNA): Raw color/font values. Internal only.
 * - Semantics (Interface): What components actually use. Public API.
 *
 * Rule: Components import semantics, never primitives.
 */

// =============================================================================
// PRIMITIVES (DNA Layer)
// Raw values. Never use directly in components.
// =============================================================================

export const primitives = {
  // Kinetic Codex Core Palette
  vellum: '#F0EBE3', // Warm aged paper
  vellumWarm: '#F5F0E8', // Slightly warmer for surfaces
  vellumCool: '#EBE6DE', // Cooler for hover states

  ironGall: '#2B2B2B', // Primary text - iron gall ink
  ironGallLight: '#4A4A4A', // Secondary text
  ironGallMuted: '#6B6B6B', // Muted/tertiary text
  ironGallFaint: '#8B8B8B', // Placeholder text

  rubric: '#D64045', // Primary accent - manuscript rubric red
  rubricDeep: '#B83338', // Hover state
  rubricLight: '#E65C60', // Light variant
  rubricFaint: 'rgba(214, 64, 69, 0.1)', // Background tint

  // Status Colors (preserved from existing palette)
  laurel: '#22c55e', // Success - victory laurels
  laurelLight: '#4ade80',
  laurelFaint: 'rgba(34, 197, 94, 0.1)',

  terracotta: '#f97316', // Warning - Roman pottery
  terracottaLight: '#fb923c',
  terracottaFaint: 'rgba(249, 115, 22, 0.1)',

  verdigris: '#00E0C6', // Electric accent - patina on bronze
  verdigrisLight: '#2dd4bf',
  verdigisFaint: 'rgba(0, 224, 198, 0.1)',

  bronze: '#C5A059', // Achievement - Roman medals
  bronzeLight: '#d4b56a',
  bronzeFaint: 'rgba(197, 160, 89, 0.1)',

  // Neutrals
  border: '#D4D0C8', // Warm gray border
  borderSubtle: '#E5E1D9',

  // Typography
  fontDisplay: 'var(--font-display)', // Fraunces
  fontSerif: 'var(--font-serif)', // Crimson Pro
  fontSans: 'var(--font-sans)', // System UI
} as const;

// =============================================================================
// SEMANTICS (Interface Layer)
// What components use. Maps intent to primitives.
// =============================================================================

export const semantics = {
  // Backgrounds
  colorBackground: primitives.vellum,
  colorSurface: primitives.vellumWarm,
  colorSurfaceHover: primitives.vellumCool,

  // Text
  colorTextPrimary: primitives.ironGall,
  colorTextSecondary: primitives.ironGallLight,
  colorTextMuted: primitives.ironGallMuted,
  colorTextFaint: primitives.ironGallFaint,
  colorTextInverse: primitives.vellum,

  // Interactive (Rubric)
  colorAccent: primitives.rubric,
  colorAccentHover: primitives.rubricDeep,
  colorAccentLight: primitives.rubricLight,
  colorAccentFaint: primitives.rubricFaint,

  // Focus
  colorFocusRing: primitives.rubric,

  // Borders
  colorBorder: primitives.border,
  colorBorderSubtle: primitives.borderSubtle,

  // Status
  colorSuccess: primitives.laurel,
  colorSuccessLight: primitives.laurelLight,
  colorSuccessFaint: primitives.laurelFaint,

  colorWarning: primitives.terracotta,
  colorWarningLight: primitives.terracottaLight,
  colorWarningFaint: primitives.terracottaFaint,

  colorCelebration: primitives.verdigris,
  colorCelebrationLight: primitives.verdigrisLight,
  colorCelebrationFaint: primitives.verdigisFaint,

  colorAchievement: primitives.bronze,
  colorAchievementLight: primitives.bronzeLight,
  colorAchievementFaint: primitives.bronzeFaint,

  // Typography
  fontDisplay: primitives.fontDisplay,
  fontSerif: primitives.fontSerif,
  fontSans: primitives.fontSans,
} as const;

// =============================================================================
// MOTION TOKENS
// Ink-physics inspired timing and easing
// =============================================================================

export const motion = {
  // Durations
  durationInstant: '75ms',
  durationFast: '150ms',
  durationNormal: '300ms',
  durationSlow: '500ms',
  durationSlower: '800ms',

  // Easings
  easeInk: 'cubic-bezier(0.22, 1, 0.36, 1)', // Smooth ink flow
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Tactile bounce
  easeOutExpo: 'cubic-bezier(0.16, 1, 0.3, 1)', // Quick deceleration
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)', // Standard
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Primitive = keyof typeof primitives;
export type Semantic = keyof typeof semantics;
export type Motion = keyof typeof motion;
