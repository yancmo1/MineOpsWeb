# MineOpsWeb Dashboard and UX/UI Refactor

## Purpose

Refactor the current MineOpsWeb interface from a manager-focused catalog into a true MineOps command center.

The current manager roster is useful and should remain, but the app's primary experience should answer:

> What should I do next, where is my progress concentrated, and what action gives me the best return?

This implementation should remain deterministic and data-driven. AI must not be required for any core recommendation, calculation, or dashboard feature.

---

## Project Context

Workspace paths:

```text
/Users/yancyshepherd/Projects/mineops-companion
/Users/yancyshepherd/Projects/MineOpsWeb
```

Primary web project:

```text
/Users/yancyshepherd/Projects/MineOpsWeb
```

Current main application file:

```text
/Users/yancyshepherd/Projects/MineOpsWeb/frontend/src/App.tsx
```

The existing `App.tsx` currently handles:

- Catalog loading
- Remote manager catalog normalization
- Kolibri synchronization
- Player manager progress
- Local persistence
- Filtering and ranking
- All primary pages
- Manager cards
- Manager details
- Credentials and diagnostics

Do not discard working sync, catalog, persistence, or manager functionality.

---

# Product Direction

MineOpsWeb should be:

> A data-driven Idle Miner companion that analyzes the player's actual game state, identifies where income and progress are concentrated, detects bottlenecks, ranks upgrade opportunities, and tells the player where time and resources will have the greatest impact.

Engineering principle:

> No core MineOps feature should require AI when it can be solved reliably with game data, formulas, rules, or deterministic calculations.

AI may be added later as an explanation or coaching layer, but not as the source of truth.

---

# High-Level UX Problems to Correct

## 1. The current Today page is not an operational dashboard

The current Today page shows collection statistics:

- Manager count
- Fragment opportunities
- Area coverage
- Strongest manager by area

These are useful secondary metrics, but they do not answer what the user should do next.

Replace the Today concept with an Overview or Command Center experience.

## 2. The Strategy page currently uses placeholder logic

The current implementation uses:

```tsx
managers.slice(0, 3)
```

and labels those managers as sequential phases.

This is misleading because it is not an actual strategy calculation.

Until mine-state analysis is connected, Strategy must clearly identify itself as a manager-lineup summary rather than presenting fake phases.

## 3. Desktop currently feels like an enlarged mobile layout

The desktop layout should use available width.

The app should have:

- A desktop navigation rail or sidebar
- A wider content container
- Dashboard card grids
- Better two-column and three-column layouts
- Less empty horizontal space

The installed mobile PWA should retain bottom navigation.

## 4. Navigation lacks visual priority

Use responsive navigation:

### Desktop

Persistent left navigation:

- Overview
- Mines
- Managers
- Strategy
- Resources
- More

### Mobile / narrow viewport

Bottom navigation with the most important destinations.

For an initial implementation, mobile may show:

- Overview
- Mines
- Managers
- More

Strategy and Resources may remain accessible from More if five or six bottom items become too crowded.

## 5. Sync is overexposed

The app currently has a prominent `Sync Now` button in the global header and another in More.

Desired behavior:

- Auto-sync on app launch when credentials are present
- Show a compact freshness/status indicator globally
- Use a small refresh icon or compact Refresh button in the header
- Keep the full Sync Now action and diagnostics in More
- Do not make synchronization the dominant action on every page

## 6. The manager detail modal behaves like a tall mobile sheet on desktop

Desired behavior:

- Desktop: right-side detail drawer
- Mobile: full-screen or bottom sheet
- Sticky manager header
- Clearly separated Ability, Passives, Elements, and Progress sections
- Preserve existing ownership toggle behavior

## 7. Raw catalog placeholders are visible

Strings such as:

```text
{0} Loading & Movement Speed Boost
```

must be cleaned before rendering.

---

# Implementation Strategy

Do not attempt all domain expansion in one enormous `App.tsx` rewrite.

Use two implementation tracks:

1. Refactor and improve the current experience using existing manager data.
2. Establish the architecture for upcoming mine-state parsing and deterministic recommendations.

---

# Required Navigation Model

Replace the current tab definition:

```ts
type Tab = "today" | "managers" | "strategy" | "more";
```

with:

```ts
type Tab =
  | "overview"
  | "mines"
  | "managers"
  | "strategy"
  | "resources"
  | "more";
```

The initial selected tab should be:

```ts
const [tab, setTab] = useState<Tab>("overview");
```

Use the following visible names:

| Tab value | Visible label |
|---|---|
| `overview` | Overview |
| `mines` | Mines |
| `managers` | Managers |
| `strategy` | Strategy |
| `resources` | Resources |
| `more` | More |

Do not derive all labels from capitalization. Use an explicit navigation configuration.

Example:

```ts
const navigationItems: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "mines", label: "Mines" },
  { id: "managers", label: "Managers" },
  { id: "strategy", label: "Strategy" },
  { id: "resources", label: "Resources" },
  { id: "more", label: "More" },
];
```

---

# Required File Structure

Split `App.tsx` before adding substantial mine analysis.

Target structure:

```text
frontend/src/
  app/
    AppShell.tsx
    navigation.ts
  pages/
    OverviewPage.tsx
    MinesPage.tsx
    ManagersPage.tsx
    StrategyPage.tsx
    ResourcesPage.tsx
    MorePage.tsx
  components/
    AppHeader.tsx
    AppNavigation.tsx
    SyncStatus.tsx
    MetricCard.tsx
    EmptyState.tsx
  features/
    managers/
      ManagerCard.tsx
      ManagerDetailDrawer.tsx
      managerSelectors.ts
      managerText.ts
    sync/
      SyncPanel.tsx
    mines/
      mineTypes.ts
      parseMineState.ts
      calculateProduction.ts
      calculateUpgradeCost.ts
      detectBottleneck.ts
      rankMineOpportunities.ts
    recommendations/
      recommendationTypes.ts
      rankRecommendations.ts
  lib/
    db.ts
    kolibri.ts
```

This exact structure may be adapted to existing project conventions, but responsibilities must be separated.

`App.tsx` should become a composition/root file rather than containing every page and component.

---

# Immediate Existing-Data Dashboard

Until full mine-state parsing is implemented, the Overview page must use only truthful, existing manager data.

Do not invent mine cash, production, ROI, or upgrade values.

## Overview Header

Use:

```text
MINEOPS
Command Center
```

The page should show a compact sync freshness line below or inside the header.

Examples:

```text
Synced 2 minutes ago
Offline · showing cached data
Sync error · <message>
No player data imported
```

## Section 1: Best Next Move

Use the best immediately actionable manager rank-up.

A manager is rank-up ready only when:

```ts
player.fragments >= (rankThreshold(player.rank) ?? Infinity)
```

Do not treat every manager with fragments as an opportunity.

Sort actionable opportunities by:

1. Highest strength score
2. Largest fragment surplus
3. Manager name as stable fallback

Suggested language:

```text
BEST NEXT MOVE

Rank up <Manager Name>

<Area> · Rank <current rank> · <fragment count> fragments available

This is the strongest immediately actionable roster improvement found in the synced player data.
```

If no rank-up is available but an owned manager exists, show the strongest owned manager as a temporary lineup focus.

If no player data exists, prompt the user to sync.

## Section 2: Empire Snapshot

Until mine data exists, use honest manager metrics:

- Owned Managers
- Rank-ups Ready
- Operating Areas Covered

Do not label collection statistics as mine production metrics.

## Section 3: Roster Leaders

Show the strongest owned manager for:

- Mine Shaft
- Elevator
- Warehouse

Each row/card should show:

- Manager name
- Area
- Level
- Promotion
- Rank
- Click/tap opens manager details

## Section 4: Mine Intelligence

Use an explicit development-state panel, not fake data.

Example:

```text
Mine Intelligence

Full mine-state analysis is the next dashboard milestone:
cash balances, production concentration, bottlenecks,
affordable upgrades, and time-based ROI.

Manager recommendations currently use deterministic imported player data.
```

This section should be designed so it can later be replaced with real mine opportunity cards.

---

# Mines Page

Create a dedicated Mines page now, even if the full data model is not yet wired.

## Current empty/development state

The page should explain what will appear here:

- Mine cash balance
- Prestige
- Mineshaft levels
- Elevator level
- Warehouse level
- Current production
- Production contribution
- Affordable upgrades
- Bottleneck
- Recommended action
- Estimated time to next upgrade

Use a polished empty state rather than placeholder fake values.

## Future mine card shape

Design types and UI around this expected model:

```ts
type MineSummary = {
  id: string;
  name: string;
  continent?: string;
  prestige: number;
  currency?: string;
  availableCash?: number;
  productionPerSecond?: number;
  productionShare?: number;
  elevatorLevel?: number;
  warehouseLevel?: number;
  highestShaftLevel?: number;
  bottleneck?: "mineshaft" | "elevator" | "warehouse" | "balanced";
  affordableUpgradeCount?: number;
};
```

Do not assume numeric values can safely use JavaScript `number` for all Idle Miner magnitudes. Investigate the project's existing large-number representation and use decimal/scientific-string handling when needed.

---

# Future Operational Dashboard Specification

Once mine-state parsing is connected, the Overview page should evolve into the following hierarchy.

## 1. Primary recommendation

Largest card on the page.

Example:

```text
Best Next Move

Upgrade Ruby Mine Shaft 30 by 10 levels

Cost: 2.43 bd
Expected production gain: +31%
Estimated payback: 7m 18s
```

## 2. Empire snapshot

Metrics:

- Total active production
- Highest-producing mine
- Current limiting system
- Affordable upgrade count
- Time until next meaningful upgrade

## 3. Where the cash is coming from

Ranked mine contribution list.

Example structure:

| Mine | Production Share | Status |
|---|---:|---|
| Ruby | 68% | Elevator constrained |
| Sapphire | 19% | Balanced |
| Coal | 8% | Shaft constrained |
| Gold | 5% | Low priority |

Use horizontal bars or similarly clear visualization.

## 4. Best opportunities

Rank three to five actions.

Each action should include:

- Mine
- Component
- Upgrade amount
- Cost
- Expected gain
- Payback time
- Bottleneck effect
- Human-readable reason

Possible actions:

- Upgrade Mineshaft
- Upgrade Elevator
- Upgrade Warehouse
- Collect idle cash
- Rank/promote an assigned manager
- Save toward prestige
- Save toward a major milestone

## 5. Session plan

Provide deterministic session choices:

- 5 minutes
- 15 minutes
- 30 minutes
- Long session

The engine should return a sequenced list of actions based on available data and estimated affordability timing.

---

# Deterministic Recommendation Architecture

The recommendation engine must not live inside React components.

Create pure, independently testable functions.

Suggested modules:

```text
features/mines/
  mineTypes.ts
  parseMineState.ts
  calculateProduction.ts
  calculateUpgradeCost.ts
  detectBottleneck.ts
  rankMineOpportunities.ts
```

Recommended function shapes:

```ts
function parseMineState(rawSave: unknown): MineState[];
```

```ts
function calculateMineProduction(mine: MineState): ProductionBreakdown;
```

```ts
function detectMineBottleneck(
  production: ProductionBreakdown,
): "mineshaft" | "elevator" | "warehouse" | "balanced";
```

```ts
function getAffordableUpgrades(
  mine: MineState,
  catalog: MineCatalog,
): UpgradeOpportunity[];
```

```ts
function rankMineOpportunities(
  mines: MineState[],
  catalog: MineCatalog,
): RankedOpportunity[];
```

```ts
function buildSessionPlan(
  opportunities: RankedOpportunity[],
  durationMinutes: 5 | 15 | 30 | number,
): SessionPlan;
```

All calculations must return reason fields that allow the UI to explain why an action was ranked.

Example:

```ts
type RankedOpportunity = {
  id: string;
  mineId: string;
  title: string;
  cost: BigValue;
  expectedGain?: BigValue;
  expectedGainPercent?: number;
  paybackSeconds?: number;
  score: number;
  reason: string;
};
```

---

# Manager Page Requirements

Preserve the existing manager grid because it is currently the strongest part of the application.

Keep:

- Search
- Area filters
- Owned/all segmentation
- Manager count
- Rarity treatment
- Level
- Promotion
- Rank
- Fragments
- Rank-up-ready badge
- Locked state
- Sprite loading

Improve:

- Use extracted components
- Avoid inline styles where practical
- Preserve stable sorting
- Keep manager catalog definitions separate from player progress
- Use semantic buttons and accessible labels
- Ensure keyboard focus styles are visible

---

# Manager Opportunity Calculation Fix

The existing code currently treats every owned manager with fragments as an opportunity:

```ts
.filter(({ p }) => p.fragments > 0)
```

Replace that logic with a true ready-to-rank check:

```ts
const opportunities = unlocked
  .map((player) => ({
    player,
    manager: byId.get(player.managerId),
  }))
  .filter(
    (
      item,
    ): item is {
      player: PlayerManager;
      manager: CatalogManager;
    } =>
      Boolean(item.manager) &&
      item.player.fragments >=
        (rankThreshold(item.player.rank) ?? Infinity),
  )
  .sort(
    (a, b) =>
      strengthScore(b.manager, b.player) -
        strengthScore(a.manager, a.player) ||
      b.player.fragments - a.player.fragments ||
      a.manager.name.localeCompare(b.manager.name),
  );
```

Do not arbitrarily truncate the source opportunity list. Truncate only at the presentation layer when a card needs the top three or four.

---

# Strategy Page Requirements

Remove the current fake sequence:

```text
Phase 1
Phase 2
Phase 3
```

Until mine analysis is available, the Strategy page should display:

```text
Manager Lineup
```

Show the strongest owned manager for each operating area:

- Mine Shaft
- Elevator
- Warehouse

Clearly label the scope:

```text
This page currently ranks imported managers only.
Mine-specific sequencing will replace this summary
after mine-state calculations are connected.
```

Do not present manager score ordering as a timed activation strategy unless the necessary ability and cooldown logic is actually implemented.

---

# Resources Page

Create a Resources page with a development-state layout prepared for:

- Continent currencies
- Super Cash
- Crystals
- Fragments
- Equipment
- Artifacts
- Collectibles
- Boost inventory
- Keys/tokens where present

Do not invent values.

Use imported values only after the relevant save fields are parsed.

---

# More Page

Move account and system actions here.

Include:

- Kolibri credentials
- Manual Sync Now button
- Sync diagnostics
- Last successful sync
- Last attempted sync
- Cached/offline state
- Unmatched manager IDs
- Save-game key
- App/build information
- Data export, when available
- Reset cached player data, with confirmation

Keep credentials secure and do not display auth tokens in plain text.

---

# Catalog Text Normalization

Add a reusable helper:

```ts
export function cleanDescription(value?: string): string | undefined {
  return value?.replace(/^\{\d+\}\s*/, "").trim() || undefined;
}
```

Use it when normalizing active ability descriptions:

```ts
description: cleanDescription(
  item.descriptionLong ?? item.descriptionShort,
),
```

Also apply it at render time as a defensive fallback.

Do not alter other meaningful template placeholders unless there is a known replacement value.

---

# Responsive Layout Requirements

## Desktop

At a suitable breakpoint, use:

```text
┌──────────────┬─────────────────────────────────────┐
│ Navigation   │ Header / status                     │
│ rail         ├─────────────────────────────────────┤
│              │ Main page content                   │
│              │ cards and responsive grids          │
└──────────────┴─────────────────────────────────────┘
```

Recommended behavior:

- Sidebar width around 220–260 px
- Main content uses available width
- Sensible max-width around 1400–1600 px
- Overview uses multi-column card grid
- Manager grid remains responsive
- More page form does not stretch excessively wide

## Mobile

- Bottom navigation
- Header remains compact
- Cards become single-column
- Manager detail becomes full-screen or bottom sheet
- Touch targets at least 44 px
- Respect safe-area insets for installed PWA mode

## Navigation CSS behavior

Do not show both sidebar and bottom navigation simultaneously.

Use media queries to switch between them.

---

# Visual Hierarchy

Use the existing dark MineOps visual language, but adjust hierarchy.

## Strongest emphasis

- Best Next Move
- Current bottleneck
- Best ROI
- Time to next action

## Medium emphasis

- Mine ranking
- Production concentration
- Affordable upgrades
- Roster leaders

## Lowest emphasis

- Sync mechanics
- Build information
- Diagnostics
- Catalog counts

Avoid making every card equally prominent.

---

# Sync UX Requirements

Keep existing sync mechanics working.

Desired global treatment:

- Small freshness status
- Compact refresh action
- Full-size Sync Now only in More

Do not remove automatic first sync:

```ts
if (
  catalog.length &&
  credentials.kolibriId &&
  credentials.authToken &&
  !metadata.lastSuccessfulSyncAt
) {
  void syncNow();
}
```

Refactor it safely to satisfy React hook dependencies and avoid accidental repeated syncing.

Do not sync continuously while the app remains open.

---

# Accessibility Requirements

- Every icon-only button must have an accessible label
- Preserve keyboard navigation
- Add visible focus indicators
- Dialog/drawer should trap focus if the project already has a dialog utility
- Escape should close manager details
- Restore focus to the triggering manager card
- Navigation must use `aria-current="page"`
- Status text should use `role="status"` or appropriate live-region behavior
- Do not rely only on color to communicate rarity or state

---

# Testing Requirements

Add or update tests for:

## Manager selectors

- Strongest manager by area
- Locked managers excluded
- Search and area filtering
- Stable ordering

## Rank-up opportunity logic

- Below threshold is excluded
- Equal to threshold is included
- Above threshold is included
- Missing catalog record is excluded
- Maximum rank with no next threshold is excluded

## Text normalization

Input:

```text
{0} Loading & Movement Speed Boost
```

Expected:

```text
Loading & Movement Speed Boost
```

Input without placeholder remains unchanged.

## Navigation

- Default route/tab is Overview
- Desktop and mobile navigation activate correct page
- `aria-current` follows selected page

## Sync regression

- Existing cached data still loads
- Successful sync updates progress and metadata
- Failed sync preserves cached data
- Offline state remains visible

## Build verification

Run the project's actual commands, likely equivalents of:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Inspect `package.json` and use the scripts defined there rather than assuming script names.

---

# Implementation Order

Use this sequence.

## Pass 1: Safe structural refactor

1. Extract manager card
2. Extract manager detail drawer/modal
3. Extract navigation
4. Extract header/status
5. Extract existing pages without changing behavior
6. Verify build and sync

## Pass 2: Current-data UX improvement

1. Rename Today to Overview
2. Add Command Center header
3. Implement true rank-up-ready opportunity logic
4. Build Best Next Move card
5. Add Empire Snapshot
6. Add Roster Leaders
7. Replace Strategy placeholder phases
8. Add Mines and Resources development states
9. Normalize raw manager descriptions

## Pass 3: Responsive application shell

1. Add desktop sidebar
2. Keep mobile bottom navigation
3. Expand content width
4. Add dashboard card grids
5. Convert manager modal to desktop drawer/mobile sheet
6. Reduce sync prominence

## Pass 4: Mine domain foundation

1. Locate full mine/player state in Kolibri save response
2. Create typed parser
3. Preserve raw source snapshots for diagnostics
4. Add fixture-based tests
5. Display real mine list without recommendations

## Pass 5: Deterministic opportunity engine

1. Production calculation
2. Bottleneck detection
3. Upgrade affordability
4. Upgrade gain
5. ROI/payback
6. Opportunity ranking
7. Session planning
8. Replace development-state dashboard cards with real data

---

# Acceptance Criteria

The task is complete when:

- `App.tsx` is no longer a single monolithic file containing every page and component
- The default screen is Overview / Command Center
- Desktop uses a sidebar and meaningful width
- Mobile uses bottom navigation
- Sync remains functional
- The global sync control is visually secondary
- Manager browsing remains fully functional
- Manager details work as desktop drawer/mobile sheet
- Raw `{0}` ability placeholders no longer display
- Rank-up opportunities use actual threshold logic
- Strategy no longer presents fake phases
- Mines and Resources have honest, polished empty/development states
- No fake mine numbers are displayed
- Mine calculation functions are isolated from React
- Core behavior requires no AI service or API key
- Lint, type checking, tests, and production build pass

---

# Non-Goals for This Pass

Do not:

- Add an AI provider
- Send player data to an LLM
- Fabricate mine production values
- Guess upgrade costs
- Rewrite working Kolibri authentication unnecessarily
- Remove offline caching
- Replace the verified manager catalog
- Change persistence format without a migration
- Present incomplete calculations as authoritative recommendations

---

# Final Agent Deliverable

After implementation, provide:

1. Summary of files changed
2. Summary of UX changes
3. Current mine-state fields successfully parsed
4. Any formulas still missing
5. Test and build results
6. Screenshots or a clear description of desktop and mobile layouts
7. Any follow-up items that require catalog decoding rather than UI work
