---
name: MineOpsWeb
description: A high-signal geological control room for personal Idle Miner Tycoon strategy.
colors:
  primary: "#71E5D1"
  primary-deep: "#3B9E97"
  secondary: "#FFB454"
  neutral-bg: "#0B1214"
  surface: "#132024"
  surface-muted: "#203238"
  field: "#0E1A1D"
  border: "#2C474C"
  text-primary: "#F2F7F4"
  text-secondary: "#A6B9B5"
  text-tertiary: "#6F8985"
  status-success: "#73E0A0"
  status-error: "#FF7E73"
  light-neutral-bg: "#F4F8F6"
  light-surface: "#FFFFFF"
  light-surface-muted: "#E7F0ED"
  light-border: "#C8DAD5"
  light-text-primary: "#172A2A"
  light-text-secondary: "#536966"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.7rem, 4vw, 2.35rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.045em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.18rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.15em"
rounded:
  sm: "8px"
  md: "9px"
  lg: "14px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#08201E"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.625rem 0.875rem"
  nav:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.5rem"
---

# Design System: MineOpsWeb

## Overview

**Creative North Star: "The Night-Shift Geological Control Room"**

MineOps is expressed as a focused instrument panel for a player checking a roster between decisions. The locked dark mode is mineral slate and oxidized teal; the light mode translates the same system into bright mineral-paper surfaces for daytime use. Both modes keep the next action, confidence state, and warning signal unmistakable.

The interface uses the grammar of survey instruments and control-room readouts without pretending to be a technical simulator. Dense information is allowed when it is structured; technical provenance stays available but never outranks the player’s decision.

**Key Characteristics:**

- Deep mineral canvas with a quiet radial field glow.
- Oxidized teal for actions, active navigation, and verified recommendations.
- Amber for caution, stale data, and patch-sensitive inputs.
- Tactile controls with visible focus and hover response.
- Linear decision paths with expert tools revealed after the primary answer.
- Explicit Light / Dark appearance control in More → Preferences; light is the default for new sessions.

## Colors

The palette is dark and restrained: mineral slate surfaces, one cool action accent, and one warm signal accent.

### Primary

- **Oxidized Teal** (#71E5D1): Primary actions, active navigation, recommendation emphasis, and verified-data cues.
- **Deep Teal** (#3B9E97): Secondary emphasis where the primary accent needs quieter contrast.

### Secondary

- **Amber Signal** (#FFB454): Caution, incomplete data, patch-sensitive assumptions, and attention states.

### Neutral

- **Mineral Night** (#0B1214): Application canvas.
- **Work Surface** (#132024): Cards, dialogs, and primary working surfaces.
- **Slate Control** (#203238): Secondary controls, metric surfaces, and inactive filters.
- **Field Black** (#0E1A1D): Inputs and editable data fields.
- **Survey Border** (#2C474C): Delimiters and focus-adjacent structure.
- **Signal Text** (#F2F7F4): Primary text.
- **Field Note** (#A6B9B5): Supporting copy.
- **Quiet Mark** (#6F8985): Tertiary metadata.

### Named Rules

**The Signal-First Rule.** Teal means act or trust; amber means pause and inspect. Neither accent is decorative.

**The Two-Workspace Rule.** Dark mode preserves the night-shift control-room palette exactly. Light mode changes surface and text tones only; teal, amber, hierarchy, spacing, and interaction behavior remain shared.

## Typography

**Display and body:** system sans stack (`-apple-system`, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif).

The type is compact and workmanlike. Hierarchy comes from scale, weight, and spacing so the interface stays fast to scan on a phone.

### Hierarchy

- **Display** (700, `clamp(1.7rem, 4vw, 2.35rem)`, 1.2): Page orientation.
- **Title** (600, 1.18rem, 1.3): Section and recommendation headings.
- **Body** (400, 1rem, 1.5): Explanations and decisions.
- **Label** (600, 0.68rem, 0.15em tracking): Navigation context and state labels.

## Layout

The app uses a centered wide canvas with a linear mobile reading order. The page title and data-confidence strip establish context, the primary recommendation leads, and supporting tools follow. Cards may become two-column groups at wide sizes; mobile keeps one clear vertical path with a fixed bottom navigation bar.

Spacing follows quarter-rem steps, with compact 0.5rem control gaps, 0.75rem related-group gaps, 1rem section gaps, and 1.25rem working-surface padding.

## Elevation & Depth

Depth comes from dark tonal separation, thin survey borders, and soft black ambient shadows. A subtle radial field glow gives the canvas atmosphere; controls gain depth through state changes rather than decorative effects.

**The One Cue Rule.** A surface uses a border or a shadow as its primary separator. A focused recommendation may use both a border and a quiet halo.

## Shapes

Controls use 9px corners, cards use 14px corners, and status pills remain compact and fully rounded. The silhouette is tactile but not playful: generous targets, restrained radii, and no decorative bevels.

## Components

### Buttons

- **Primary:** Oxidized Teal with dark text, 9px corners, and a soft lift on hover.
- **Secondary:** Slate Control with a Survey Border; hover promotes the teal border.
- **Focus:** 2px teal outline with a 3px offset and soft teal halo.

### Cards and Recommendations

- **Surface:** Work Surface with Survey Border and low ambient shadow.
- **Recommendation:** Teal border emphasis, clear action title, one reason, and one primary action.
- **Technical detail:** Secondary text and disclosure, never the visual lead.

### Inputs and Fields

- **Style:** Field Black background, Survey Border, 9px corners, persistent labels.
- **Focus:** Teal border and visible focus ring.
- **Error / caution:** Amber or red message with a recovery instruction.

In light mode, fields use white surfaces with mineral borders; in dark mode, they use Field Black. Both retain the same focus ring and label treatment.

### Navigation

The fixed bottom navigation is a dark control rail. Active navigation receives a low teal surface tint and teal icon/text; inactive items use Quiet Mark. Hover and focus states remain visible without shifting layout.

## Do's and Don'ts

### Do:

- **Do** lead with the player’s next decision.
- **Do** make data confidence and source visible before recommendations.
- **Do** use tactile hover, focus, active, loading, and reduced-motion states.
- **Do** keep technical provenance expandable and subordinate.

### Don't:

- **Don't** return to a pale generic card dashboard.
- **Don't** use teal or amber as decoration without meaning.
- **Don't** make every calculator equally prominent.
- **Don't** use layout-property animation or hide keyboard focus.
