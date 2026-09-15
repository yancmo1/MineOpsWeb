---
name: MineOpsWeb
description: A desktop-first game board for personal Idle Miner Tycoon strategy.
colors:
  ink: "#1D2230"
  ink-soft: "#5D6471"
  ink-muted: "#8C9298"
  canvas: "#F3F0E8"
  surface: "#FFFDF8"
  surface-soft: "#F7F4EC"
  border: "#DDDCD3"
  rail: "#201A35"
  rail-muted: "#A59DBD"
  teal: "#087F78"
  teal-soft: "#D8F2ED"
  amber: "#D9781F"
  amber-soft: "#FFF0D9"
  green: "#23895D"
  red: "#C9544C"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.9rem, 3vw, 2.65rem)"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.045em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 450
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "0.12em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.64rem"
    fontWeight: 450
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
navigation:
  desktopIconSize: "24px"
  desktopLabelSize: "1rem"
  desktopItemHeight: "56px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.9rem"
  button-secondary:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.9rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.75rem"
  nav:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-muted}"
    rounded: "{rounded.sm}"
    padding: "0.6rem 0.7rem"
---

# Design System: MineOpsWeb

## Overview

**Creative North Star: “The Mine Map.”**

MineOps is a personal desktop game board: part roster wall, part upgrade notebook, and part next-move compass. It should feel like a satisfying companion to an idle game during a longer computer session, with enough density to compare managers quickly and enough hierarchy to make the next decision obvious. The visual language borrows the satisfying energy of idle-game dashboards—deep game shell, warm paper workspace, bright status accents, compact stat blocks, and visible rarity color—without copying the reference site’s layout or content.

The default workspace is a warm mineral-paper canvas with a deep plum rail and matching top bar. A dark appearance remains available for low-light play sessions. Both themes share the same hierarchy, interaction states, and data-confidence language.

## Colors

- **Mineral canvas** (`#F3F0E8`): Warm application background and page breathing room.
- **Paper surface** (`#FFFDF8`): Cards, drawers, filters, and working areas.
- **Deep plum shell** (`#201A35`): Headings in priority surfaces, navigation rail, and top bar.
- **Teal action** (`#087F78`): Primary actions, active navigation, links, and verified data.
- **Amber attention** (`#D9781F`): Rank-up opportunities, caution, and stale data.
- **Green success** (`#23895D`): Connected/current states and completed milestones.
- **Red recovery** (`#C9544C`): Errors and blocked actions.

Accent colors carry meaning. Teal means go or trust, amber means inspect or prioritize, green means current or complete, and red means recover. Rarity colors are reserved for manager identity and may not be reused as generic decoration.

## Typography

Use the system sans stack (`-apple-system`, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif) for the interface. Technical hashes and machine identifiers use `ui-monospace, SFMono-Regular, Menlo, monospace` so they remain easy to compare without turning the rest of the product into a terminal. The interface is compact and highly scannable rather than loud or futuristic.

- **Display:** 30–42px, 750 weight, tight line height for page orientation.
- **Section title:** 18px, 750 weight for cards and decision groups.
- **Body:** 14–15px, 450 weight, 1.5 line height for explanations.
- **Utility label:** 10–11px, 750 weight, modest tracking for metadata and status.

## Layout

Desktop uses a persistent 236px navigation rail and a sticky 72px top bar. Content is capped at 1500px and uses generous outer gutters with dense internal grids. Today leads with one recommendation, one roster snapshot, and two supporting work areas. Managers defaults to a four-column card board at wide desktop sizes, narrowing to three and two columns as space decreases.

Phone layouts preserve the same order and data hierarchy. The rail becomes a bottom navigation bar, cards become a single readable column, and secondary controls wrap below the primary action. No critical status or action is hidden solely because the viewport is narrow.

The spacing rhythm is 4px-based, with 8px control gaps, 12px related-group gaps, 16px section gaps, and 24px working-surface padding. Use the shared tokens in `frontend/src/styles.css`; do not introduce one-off spacing values in page components.

## Elevation and shapes

Cards use a light border plus a restrained shadow; they do not stack multiple decorative effects. The main recommendation uses a deep plum surface with an amber priority rail and a small geometric ore emblem. Manager cards use a rarity-colored header, portrait frame, and progress signal so the board feels game-native while remaining scannable. Inputs and buttons use 8px corners, regular cards use 18px corners, and pills are fully rounded. Hover and focus states change tone or border before they change position.

## Components

### Navigation

The deep plum shell groups the four product areas—Today, Managers, Strategy, and More—above a compact connection/catalog status footer. Desktop navigation uses 24px icons, 1rem labels, and 56px hit rows so the primary destinations are easy to read at a glance. The active item uses a teal tint and a clear left-edge signal. On phone, the same items become the fixed bottom bar with safe-area padding and a compact label treatment.

### Recommendations

A recommendation has one label, one action-oriented heading, one evidence line, one explanatory sentence, and one clear route into the next useful workspace. When a real catalog portrait is available, the recommended manager appears in the hero emblem. Data freshness appears beside the page orientation and is always explicit when the recommendation is based on cached, stale, or missing player data.

Today’s roster snapshot also uses small area chips and portrait-led department rows. These are derived from the strongest owned managers in each covered area; they are recognition aids, not invented rankings or game-state claims.

### Manager cards

Manager cards are the dense comparison primitive. Each card shows portrait, name, rarity, area, level, promotion, rank, fragments, and only the first useful passive chips. The rarity color owns the card header, portrait frame, chevron, and progression bar so the board has immediate game-like recognition. Locked catalog records remain visible but are visually quieter than owned managers.

### Buttons and fields

Primary buttons are teal with white text. Secondary buttons use the soft surface token and a mineral border. Selects and text fields are labeled, keyboard-operable, and show a 2px teal focus ring. Disabled controls retain readable contrast and explain why they are unavailable when the reason is not obvious.

### Status

Status is always text plus a color cue. Never rely on color alone. Sync failures include recovery guidance; unknown catalog values remain visibly unknown instead of being estimated.

## Do’s and don’ts

### Do

- Lead with the next useful decision.
- Make the desktop roster feel like a board that can be scanned in seconds.
- Keep real player data, catalog provenance, and uncertainty visible.
- Preserve keyboard focus, reduced-motion behavior, and a usable narrow-screen adaptation.

### Don’t

- Reintroduce the previous dark-only, phone-first control-room styling as the default.
- Turn every calculator or diagnostic into equal visual weight.
- Use decorative gradients, icons, or rarity colors without a product meaning.
- Invent manager values, progression state, or strategy claims.
