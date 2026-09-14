# Personal Frontier Mine plan — synced roster

**Snapshot observed:** 2026-09-14  
**Player import:** 61 managers received; 61 resolved; 61 fragment counts present  
**Equipment:** 10 manager assignment references; 0 owned equipment items  
**Catalog shown by the live app:** 5.59.0 lossless-v2  
**Newest APK review candidate:** 5.63.0, release `5.63.0_97356_20260914T134142Z`

This is a roster-specific plan based on the synced manager levels, promotions, ranks, fragments, and the APK's exact passive IDs. It is not a complete “press these buttons now” script because the save does not include the live Frontier barrier, Sparks, Frontier Credits, active multiplier, cooldown state, or event deadline.

## The short version

Your account already has the most important early Frontier foundation:

- four active P3 mine-income managers at level 30: Ranger Sue, Mr. Turner, Zi Galvani, and Damian Jones;
- a strong set of shaft cost reducers;
- two active elevator cost reducers;
- three active warehouse cost reducers;
- several barrier- and shaft-unlock reducers;
- a high-level warehouse manager, Altitude, for transport conversion.

Your best immediate upgrade is Queen Aurora from rank 1 to rank 2. The synced roster has 29 of the 30 fragments required, so this costs one fragment and adds the catalog's documented +21% active-value step. Queen Aurora is also a useful elevator-to-warehouse conversion manager, making this unusually efficient for Frontier.

After Queen Aurora, the next practical targets are:

1. Lila Starborne rank 1 → 2: two fragments, +21% active step.
2. Mr. Turner rank 3 → 4: eight fragments, +46% active step.
3. Thalia rank 1 → 2: five fragments, +21% active step.
4. Chef Bearnard or Mad Eye Drake rank 2 → 3 when the needed eight fragments are available and the associated burst is useful.

The first two are pure fragment bargains. Mr. Turner is the better Frontier burst investment after them because he is already P3/L30 and his active converts stored resources into cash.

## Corrected passive roles in your roster

The live 5.59 UI currently uses legacy labels such as `BUCR` and `MSUCR`. The 5.63 APK enum and promotion rows provide the more accurate role identity below.

### Income floor

| Manager | Current state | APK passive | Use |
|---|---|---|---|
| Ranger Sue | L30/P3/R4 | Mine income, ID 1007; barrier unlock cost, ID 1005 | Best multi-role foundation; preserve for income or barrier preparation |
| Damian Jones | L30/P3/R4 | Mine income, ID 1007; elevator upgrade cost, ID 8 | Best elevator-side utility; preserve for elevator spend/conversion |
| Mr. Turner | L30/P3/R3 | Mine income, ID 1007 | Shaft income floor plus short cash-conversion active |
| Zi Galvani | L30/P3/R3 | Mine income, ID 1007 | Shaft income floor plus elevator beam active |

All four currently show the catalog/reference MIF value of 1.44x. The player save itself did not provide passive numeric values, so that number is catalog-derived rather than live-save-confirmed.

### Cost and unlock reducers that are actually active at your current promotion

| Action | Best current options | Current state | APK identity |
|---|---|---|---:|
| Shaft upgrade | Floating Agatha, Blingsley, Chester, H4 V0 C, Thalia | P1, P1, P2, P1, P1 | 7 |
| Elevator upgrade | Damian Jones, Sojo | P3, P1 | 8 |
| Warehouse upgrade | Octavia De Vere, Jade Kim, Dr. Nova | P1, P1, P1 | 9 |
| Barrier unlock | Ranger Sue, Mr. Goodman, Mrs. Goodman, Goodman Jr., Archibald | P3/P2/P2/P2/P1 | 1005 |
| Shaft unlock | H4 V0 C, Chef Bearnard, Freesia, Gordon | P1/P1/P1/P1 | 1006 |

The important correction is that Gordon, Freesia, and Chef Bearnard are shaft-unlock reducers at their current milestone, not ordinary shaft-upgrade reducers. Ranger Sue and the Goodman managers are barrier-unlock reducers, not generic building reducers.

## Recommended Frontier lineups by phase

These are role lineups, not simultaneous assignments. Swap managers between phases only when the active effect is ready and the resulting spend is worthwhile.

### Passive/preparation phase

- Keep Ranger Sue available for the barrier decision and income foundation.
- Keep Damian Jones available for elevator upgrades and transport conversion.
- Use Mr. Turner or Zi Galvani as the shaft-side income/burst choice depending on whether you need cash conversion or elevator delivery.
- Do not consume all four income managers in one short rotation if doing so removes your passive floor.

### Shaft-building phase

1. Use the exact shaft-upgrade reducer matching the purchase. Floating Agatha has the highest displayed catalog reducer value among your currently active shaft reducers; Blingsley is the safer higher-rank alternative.
2. Use Ranger Sue when you need raw mining speed and infinite worker capacity.
3. Use H4 V0 C when the plan is to multiply deposits and beam them to the warehouse.
4. Use Zi Galvani when the stockpile should be beamed to the elevator.

### Conversion/burst phase

1. Open the barrier or claim the multiplier first.
2. Use Damian Jones for an elevator-side upgrade/conversion window.
3. Use Queen Aurora after the rank-2 upgrade when the shaft stockpile is ready; her active flings resources to the warehouse.
4. Use Altitude as the strongest current warehouse-side general pick.
5. Use Mr. Turner for the short final cash-conversion window when the stored resources are ready to unload.

Chef Bearnard is a strong alternate conversion test: his active multiplies worker resources and sends half to the elevator and half to the warehouse. Because mode-specific Frontier compatibility is not fully verified, treat him as the first alternate to test rather than a guaranteed replacement for the main rotation.

## Equipment conclusion

There is no owned equipment in the synced inventory, so there is currently no equipment assignment that can improve this Frontier plan. The ten assignment references in the manager save should not be treated as owned inventory until their IDs reconcile with the inventory section.

The APK identifies Frontier Claw and Frontier Helmet, but the numeric effect join is still unresolved. The correct next equipment action is:

1. reconcile the ten assignment references against the 0-item owned-equipment inventory;
2. decode the equipment effect localization and tier values;
3. craft or acquire the first verified Frontier item;
4. assign it to the manager used most frequently in the confirmed Spark rotation.

Do not spend materials on an assumed Claw/Helmet Spark percentage yet.

## Current Frontier planner state

The live planner currently shows 705 FC, the Free reward path, and no live barrier cost or wait time. Those fields are planner inputs, not fields supplied by the player sync. Since live cost and wait are blank, MineOps cannot safely choose wait versus rush versus burst.

Before the next run, enter the in-game values for:

- current Frontier tier and shaft;
- barrier cost and remaining wait;
- Sparks and Frontier Credits;
- active multiplier and remaining event time;
- manager cooldowns that affect the planned rotation.

With those values, the plan can be reduced to a specific next action.

## General account priorities outside Frontier

The sync-backed upgrade focus identifies Warehouse as the weakest top area. For regular mines, prioritize warehouse cooldown/duration research and the warehouse manager path. That research does not carry into Frontier, so it should not be mistaken for a Frontier investment.

## Confidence and limitations

- Synced levels, ranks, promotions, fragments, manager count, equipment count, and assignment count are player-import facts.
- Passive IDs and promotion milestones are APK-derived from 5.63.
- Passive numeric values and several manager descriptions are reference-enriched through the current catalog/reference table.
- Frontier mode compatibility of every manager-specific active effect still needs one controlled runtime check.
- No equipment ranking is possible until owned equipment and effect values are reconciled.
