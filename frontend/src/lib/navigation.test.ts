import { describe, expect, it } from "vitest";
import { getTabLabel, hashForTab, navigationItems, tabFromHash, toolboxViewFromHash } from "./navigation";

// IA changed 2026-10-23: four tabs (Today/Crew/Plays/Data) became three
// (Home/My Plan/Toolbox). These expectations pin the new shell plus the
// legacy-hash redirects so old bookmarks keep landing somewhere sensible.
describe("navigation (Home / My Plan / Toolbox)", () => {
  it("exposes exactly the three new tabs in order", () => {
    expect(navigationItems.map((item) => item.id)).toEqual(["home", "plan", "toolbox"]);
    expect(navigationItems.map((item) => item.label)).toEqual(["Home", "My Plan", "Toolbox"]);
    expect(getTabLabel("plan")).toBe("My Plan");
  });

  it("maps tabs to their canonical hashes", () => {
    expect(hashForTab("home")).toBe("#home");
    expect(hashForTab("plan")).toBe("#plan");
    expect(hashForTab("toolbox")).toBe("#toolbox");
  });

  it("resolves canonical hashes, with home as the default", () => {
    expect(tabFromHash("#home")).toBe("home");
    expect(tabFromHash("#plan")).toBe("plan");
    expect(tabFromHash("#toolbox")).toBe("toolbox");
    expect(tabFromHash("#/plan")).toBe("plan");
    expect(tabFromHash("")).toBe("home");
    expect(tabFromHash("#unknown")).toBe("home");
  });

  it("keeps pre-refactor hashes working as redirects", () => {
    expect(tabFromHash("#today")).toBe("home");
    expect(tabFromHash("#managers")).toBe("toolbox");
    expect(tabFromHash("#strategy")).toBe("toolbox");
    expect(tabFromHash("#more")).toBe("toolbox");
  });

  it("deep-links legacy hashes to the matching toolbox view", () => {
    expect(toolboxViewFromHash("#managers")).toBe("crew");
    expect(toolboxViewFromHash("#strategy")).toBe("plays");
    expect(toolboxViewFromHash("#more")).toBe("data");
    expect(toolboxViewFromHash("#toolbox")).toBeNull();
    expect(toolboxViewFromHash("#home")).toBeNull();
  });
});
