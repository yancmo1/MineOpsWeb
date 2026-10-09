# MineOps UI/UX refactor — 2026-10-08

Approved direction: Concept A, Mission Board, with the light Control Room language available through the existing light/dark theme option.

## Design contract

- Light theme is the default. Dark remains an option in More.
- Desktop-first, mobile-friendly. Desktop keeps a persistent left rail; phones get a bottom nav.
- Warm parchment canvas (`#f7efe0`), cream surfaces (`#fffaf0`), deep ink-brown rail/header (`#241708`), amber action (`#f2a33c` / `#b45309`), teal readiness (`#0f766e`).
- Cards use 18px radii and soft warm shadows. Headings use the display stack; rates and compact numeric values use the mono stack.
- Today is the Mission Board: mine selector, fast MS/E/W rate entry, biggest cash earner, all ranked plays, then roster recommendation/leaders/upgrade focus.
- Managers is a crew board: find who can work now, who is near a breakpoint, and who to invest in next.
- Strategy is the playbook library: start with the next useful move, then open a focused tool.
- More is the control room: data, sync, catalog health, account, and recovery. Technical details stay collapsed/secondary.

## Non-goals for this pass

- No backend behavior change. Mine profiles remain localStorage-backed until the PocketBase mine-state work is scheduled.
- No fabricated rates, multipliers, or dollar projections. Projected pace remains a labelled relative score.

## Acceptance

- All four tabs render in the new visual language at desktop and mobile widths.
- Light is the first-run default; dark remains selectable.
- Existing tests and production build pass.
