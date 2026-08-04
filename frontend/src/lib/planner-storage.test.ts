import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  deleteStrategyPlan,
  dismissRecommendation,
  isDismissed,
  listDismissedRecommendations,
  listStrategyPlans,
  saveStrategyPlan,
  undismissRecommendation,
} from "./planner-storage";

beforeEach(async () => {
  const { db } = await import("./db");
  await db.open();
  await db.table("strategy_plans").clear();
  await db.table("dismissed_recommendations").clear();
});

describe("saved strategy plans", () => {
  it("saves and lists plans newest-first", async () => {
    await saveStrategyPlan({ kind: "lineup", title: "Plan A", catalogReleaseId: "r1", catalogVersion: "c1", snapshot: { picks: 3 } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveStrategyPlan({ kind: "upgrade", title: "Plan B", catalogReleaseId: "r1", catalogVersion: "c1", snapshot: { items: 5 } });
    const plans = await listStrategyPlans();
    expect(plans).toHaveLength(2);
    expect(plans[0].title).toBe("Plan B");
    expect(plans[0].kind).toBe("upgrade");
    expect(plans[1].snapshot).toEqual({ picks: 3 });
  });

  it("deletes a saved plan by id", async () => {
    const id = await saveStrategyPlan({ kind: "lineup", title: "Temp", catalogReleaseId: null, catalogVersion: null, snapshot: {} });
    await deleteStrategyPlan(id);
    expect(await listStrategyPlans()).toHaveLength(0);
  });
});

describe("dismissed recommendations", () => {
  it("dismisses, checks, lists, and restores", async () => {
    await dismissRecommendation("sm-10001", "lineup");
    expect(await isDismissed("sm-10001", "lineup")).toBe(true);
    expect(await isDismissed("sm-10001", "upgrade")).toBe(false);
    const dismissed = await listDismissedRecommendations();
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].managerId).toBe("sm-10001");
    await undismissRecommendation("sm-10001", "lineup");
    expect(await isDismissed("sm-10001", "lineup")).toBe(false);
  });

  it("keeps lineup and upgrade dismissals independent", async () => {
    await dismissRecommendation("sm-10001", "lineup");
    await dismissRecommendation("sm-10001", "upgrade");
    expect(await listDismissedRecommendations()).toHaveLength(2);
  });
});
