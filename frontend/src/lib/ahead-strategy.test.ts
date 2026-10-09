import { describe, expect, it } from "vitest";
import { buildComboCards, buildNextTasks, diagnoseAhead, findOwnedManager } from "./ahead-strategy";
import type { CatalogManager, PlayerManager } from "./db";

function player(managerId: string, overrides: Partial<PlayerManager> = {}): PlayerManager {
  return { managerId, level: 10, rank: 0, promoted: 0, fragments: 0, unlocked: true, updatedAt: "2026-10-01T00:00:00Z", ...overrides };
}
const catalog: CatalogManager[] = [];

describe("diagnoseAhead", () => {
  it("labels Elevator Ahead with warehouse bottleneck (live rates, not hardcoded)", () => {
    const d = diagnoseAhead({ mineshaft: 6.84, elevator: 122, warehouse: 17.7 });
    expect(d.label).toBe("elevator-ahead");
    expect(d.bottleneck).toBe("mineshaft"); // smallest leg overall; warehouse still chokes elevator-pile conversion (17.7 << 122)
    expect(d.pileLocation).toBe("elevator-building");
  });
  it("labels Shaft-Ahead", () => {
    const d = diagnoseAhead({ mineshaft: 100, elevator: 40, warehouse: 30 });
    expect(d.label).toBe("shaft-ahead");
    expect(d.pileLocation).toBe("shaft-crate");
  });
  it("labels Warehouse Ahead", () => {
    const d = diagnoseAhead({ mineshaft: 40, elevator: 80, warehouse: 120 });
    expect(d.label).toBe("warehouse-ahead");
  });
  it("asks for rates instead of inventing a diagnosis", () => {
    const d = diagnoseAhead({ mineshaft: null, elevator: null, warehouse: null });
    expect(d.label).toBe("unknown");
  });
});

describe("buildComboCards", () => {
  it("marks Lilly combo playable only with Lilly + a builder owned", () => {
    const cards = buildComboCards(catalog, [player("dr-lilly"), player("ranger-sue")]);
    const lilly = cards.find((c) => c.id === "lilly-crate-stockpile")!;
    expect(lilly.playable).toBe(true);
    const locked = buildComboCards(catalog, [player("dr-lilly")]);
    expect(locked.find((c) => c.id === "lilly-crate-stockpile")!.playable).toBe(false);
  });
  it("keeps Belle chain as an unlock target when Belle is locked", () => {
    const cards = buildComboCards(catalog, [player("ranger-sue"), player("belle-snowdrop", { unlocked: false })]);
    const belle = cards.find((c) => c.id === "sue-belle-handoff")!;
    expect(belle.playable).toBe(false);
    expect(belle.missing).toContain("Belle Snowdrop");
  });
  it("includes the new Instant Cash chain", () => {
    const cards = buildComboCards(catalog, [player("sir-axiom"), player("harumi")]);
    expect(cards.find((c) => c.id === "instant-cash-chain")!.playable).toBe(true);
  });
});

describe("buildNextTasks", () => {
  it("suggests warehouse-past-elevator from live rates", () => {
    const rates = { mineshaft: 6.84, elevator: 122, warehouse: 17.7 };
    const tasks = buildNextTasks(catalog, [player("dr-lilly")], diagnoseAhead(rates), rates);
    expect(tasks.some((t) => t.id === "rate-warehouse-past-elevator")).toBe(true);
    expect(tasks.some((t) => t.id === "unlock-belle-snowdrop")).toBe(true);
  });
});


describe("live database ID resolution", () => {
  it("matches canonical sm- IDs by display name so owned managers are not falsely locked", () => {
    const liveCatalog: CatalogManager[] = [
      { id: "sm-10001", name: "Dr. Lilly", rarity: "epic", type: "Elevator", elements: [] },
      { id: "sm-10002", name: "Ranger Sue", rarity: "rare", type: "Mine Shaft", elements: [] },
    ];
    const found = findOwnedManager(liveCatalog, [player("sm-10001")], { id: "dr-lilly", name: "Dr Lilly" });
    expect(found?.id).toBe("sm-10001");
    const cards = buildComboCards(liveCatalog, [player("sm-10001"), player("sm-10002")]);
    expect(cards.find((c) => c.id === "lilly-crate-stockpile")!.playable).toBe(true);
  });
});
