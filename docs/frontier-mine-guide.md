# Frontier Mine strategy guide for MineOps

**Research snapshot:** 2026-08-01
**Use:** strategy reference for MineOps, with roster-aware recommendations on the Strategy page
**Confidence:** game rules are highest confidence when confirmed by Kolibri's help center; barrier values and manager sequencing are patch/community sensitive.

## The governing idea

Frontier Mine is a separate Super Manager economy. The winning loop is not “activate the biggest manager whenever it is ready.” It is:

1. preserve Sparks and build a passive income base;
2. clear the next affordable checkpoint;
3. collect the FC or Frontier multiplier reward;
4. prepare a cost-reduced upgrade and a burst lineup;
5. spend the burst while the reward multiplier and stockpile are aligned;
6. stop and recharge when the next checkpoint is a poor trade.

The event is therefore a campaign of resource windows. MineOps should recommend a next action, not claim that one fixed lineup is optimal for every account.

## What is different in Frontier

Kolibri states that only Managers and Super Managers can be brought into Frontier. Normal Boosts, Super Cash, Instant Cash, Research bonuses, Artifacts, Collectibles, and Friend Boosts do not apply. Frontier supplies its own Multipliers, Credits, Time Jumps, and Sparks instead. See [Kolibri: What are Frontier Mines?](https://kolibri-games.helpshift.com/hc/en/3-idle-miner-tycoon/faq/194-what-are-frontier-mines/?han=1&hpn=1&l=en&p=ios).

Frontier Credits can buy event-shop items, instantly unlock barriers, and recharge Sparks. Credits carry across Frontier tiers during the same event; at event end, excess Credits are converted into Mystery Boost Tickets. See [Kolibri: What are Frontier Mine items?](https://kolibri-games.helpshift.com/hc/en/3-idle-miner-tycoon/faq/195-what-are-frontier-mine-items/).

Community reference material describes five-shaft barrier steps and a maximum of 30 shafts in a Frontier mine. The current Idle Master's Hub calculator exposes FM I–VII checkpoints and should be treated as the live planning reference for newer tiers, not as a permanent game-data contract. See [Frontier Mine on the Idle Miner Tycoon Wiki](https://idleminertycoon.fandom.com/wiki/Frontier_Mine) and the [Idle Master's Hub FM Calculator](https://idle-miners.com/#fm/calculator).

## Roster roles MineOps should look for

MineOps derives these tags from the verified catalog text and the synced owned roster:

| Role | How to use it | Priority rule |
|---|---|---|
| Income passive | Leave the manager assigned in the active mine while other managers run abilities. | Preserve passive assignments unless the active run clearly repays the swap. |
| Upgrade-cost reduction | Activate before a large shaft, elevator, or warehouse spend. | Place this before the burst spend, not after it. |
| Shaft burst | Build shaft levels and stockpile output during a short active window. | Spend after opening a barrier or activating a Frontier multiplier. |
| Elevator/warehouse burst | Convert a shaft stockpile into spendable cash. | Use after the shaft side is ready; do not waste the window on an empty mine. |
| Support | Flexible manager whose exact effect is not completely mapped. | MineOps shows it as support and does not invent a bonus. |

The strongest general account signals are Mine Income Factor (MIF), Continent Income Factor (CIF), and upgrade-cost reduction passives. Community guides repeatedly emphasize passive assignments, cost reduction, and pairing shaft bursts with transport-side conversion. These are recommendations, not official balance rules; see [Super Managers on the Idle Miner Tycoon Wiki](https://idleminertycoon.fandom.com/wiki/Super_Managers), [Anima's Frontier guide discussion](https://www.reddit.com/r/IdleMinerTycoon/comments/11471kx/animas_guide_to_frontier_mine/), and [community Frontier strategy discussion](https://www.reddit.com/r/IdleMinerTycoon/comments/1shjbka/frontier_mine_strategy/).

## The run sequence

### 1. Enter with a target

Choose one of three targets:

- **Milestone target:** stop at the next valuable resource reward with minimal FC/Spark spend.
- **Tier target:** reach the next mine tier or unlock the next manager/equipment reward.
- **Completion target:** continue only if the roster has enough burst depth and the remaining event time supports it.

Do not spend Credits merely because they are available. A checkpoint reward that unlocks another checkpoint can be worth more than a small immediate time save.

### 2. Establish the passive floor

Assign owned income-passive managers before starting active rotations. Keep the best cost reducer available for the next material spend. If the imported catalog does not contain a verified passive description, MineOps marks the manager as support rather than guessing.

### 3. Advance cheaply

Buy the next affordable shaft levels and use normal Managers as the event allows. Let barrier timers run while Sparks recharge. Use FC to skip only when the resulting reward or time window is better than waiting.

### 4. Create a burst window

The preferred order is:

1. open the barrier or claim the checkpoint reward;
2. apply any Frontier multiplier that is about to power the run;
3. activate cost reduction;
4. build the shaft-side stockpile;
5. activate the strongest shaft burst;
6. convert the stockpile through elevator/warehouse burst managers;
7. spend the resulting cash before the multiplier window expires.

Exact manager order depends on active durations, cooldowns, Spark costs, and the imported mine state. MineOps currently has manager ability data but not a complete Frontier mine-state model, so it presents this as an explainable sequence rather than a fake timed script.

### 5. Recalculate after every reward

Frontier rewards can change the correct decision. After a reward, recompute:

```text
available FC = current FC + checkpoint reward + selected shop/Edgar FC
next decision = wait, recharge Sparks, buy a multiplier, or skip barrier
```

The MineOps planner now accepts a manually entered live barrier cost and remaining wait, plus barrier skips and Time Jumps. It does not automatically read those values from a save or the game UI, so the in-game screen remains the source of truth.

## Live barrier decision rule

On Strategy → Frontier Mine start, enter:

- **Live barrier cost (FC):** the current FC price shown for the barrier. This overrides the first row of the reference checkpoint table.
- **Wait remaining:** the current barrier timer in minutes. Leave it blank until you have checked the live timer; a blank value produces no rush/burst claim.
- **Barrier skips:** free barrier skips you are willing to spend now.
- **Time Jumps:** available Time Jumps. Official help says Time Jumps skip Barrier time and Spark recharge, but do not reduce Super Manager active cooldowns.

The planner returns one of three next actions:

1. **Wait** when the timer is 10 minutes or less, when the live cost is missing, or when no rush resource can cover a longer wait.
2. **Spend FC** when the timer is longer than 10 minutes, the live cost is present and affordable, and no skip or Time Jump is entered.
3. **Run a burst** when the timer is already open, or after using an entered barrier skip/Time Jump to remove a long wait.

These are explicit MineOps assumptions, not a complete Frontier simulator. One barrier skip is treated as one free unlock; one Time Jump is treated as enough to remove the current wait; and a burst assumes a usable multiplier, Sparks, and a ready shaft/transport lineup. The rule has no event-end timestamp, Spark balance, manager cooldowns, active multiplier duration, mine cash, or stockpile input, so it cannot prove that spending is optimal. It is a conservative next-action prompt, not an automatic action.

## FC and barrier planning

The Idle Master's Hub calculator currently assumes a headpiece, both pendrives, and Edgar offers treated as a flat starting bonus. Its raw table reports both full-timer and reduced “after” costs, and identifies pass-specific breakpoints. The calculator describes its estimate as a power-law FC curve and reports furthest push, rush timing, a balance chart, and a barrier-by-barrier progression table.

The current snapshot includes these useful reference points:

| Checkpoint | Cost after waiting | Free FC reward | Elite FC reward |
|---|---:|---:|---:|
| FM II 5 | 83 | 400 | 500 |
| FM III 10 | 168 | 500 | 600 |
| FM III 20 | 257 | 700 | — |
| FM IV 5 | 215 | 600 | 700 |
| FM IV 15 | 296 | 800 | — |
| FM V 5 | 272 | 600 | 700 |
| FM V 20 | 470 | 700 | 100 |
| FM VII 20 | 672 | 800 | — |

These numbers are not timeless. The calculator itself asks users to report incorrect data to its maintainer, and official/community event updates have changed Frontier difficulty and rewards. Always compare the in-game displayed current cost with the planner before committing scarce FC.

## Spark discipline

- Prefer passives for background production.
- Do not repeatedly activate a mediocre manager while its Spark cost is rising.
- Reserve a full burst for a barrier reward, a strong Frontier multiplier, or a spend that materially changes the next checkpoint.
- Recharge Sparks with FC only when the resulting burst clears a meaningful target.
- In the final event window, spend stranded FC/Sparks for reachable value; unused FC does not remain as Frontier currency after the event.

## Equipment considerations

Frontier-specific equipment is unusually relevant. The community equipment reference lists Frontier Claw and Frontier Helmet variants that reduce assigned Super Manager Spark costs in Frontier, with stronger tiers reducing more. Verify that the equipment is actually owned and assigned before treating it as part of a plan. See [Equipment on the Idle Miner Tycoon Wiki](https://idleminertycoon.fandom.com/wiki/Equipment).

MineOps currently displays captured equipment and does not infer an equipment multiplier when the player import lacks it. The next useful extension is to connect owned equipment assignments to the Spark-budget calculation.

## What MineOps does today

The Strategy page now contains:

- a Frontier rules card explaining what does and does not carry into the event;
- an account-aware roster grouped by income passives, cost reduction, shaft burst, transport burst, and support;
- a checkpoint planner for FM I–VII using the checked-in reference table;
- a five-step run sequence and explicit data limitations;
- release evidence for the underlying manager catalog in the existing lineup section.

The guide is rules-first. It never fabricates a manager, passive, Spark cost, cooldown, or mine state when the verified catalog/import does not contain it.

## Research limitations and next data work

The public calculator is maintained by a community contributor and its values are patch-sensitive. Official help confirms the event rules and item behavior but does not publish a complete machine-readable barrier table. Community posts are useful for sequencing patterns but are account- and patch-dependent.

The highest-value future MineOps additions are:

1. capture the live current barrier cost and remaining timer from a player import;
2. capture owned Sparks, Frontier Credits, active multipliers, and remaining event time;
3. map manager active effects to exact Frontier-compatible action types and cooldowns;
4. map Frontier equipment assignments and Spark reductions;
5. add a what-if simulator for “wait,” “skip,” “recharge,” and “multiplier” choices.
