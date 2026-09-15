import { describe, expect, it } from "vitest";
import { hashForTab, tabFromHash } from "./navigation";

describe("navigation hash routes", () => {
  it("maps each workspace to a readable hash route", () => {
    expect(hashForTab("overview")).toBe("#today");
    expect(hashForTab("managers")).toBe("#managers");
    expect(hashForTab("strategy")).toBe("#strategy");
    expect(hashForTab("more")).toBe("#more");
  });

  it("restores the workspace from hash routes and tolerates slash form", () => {
    expect(tabFromHash("#today")).toBe("overview");
    expect(tabFromHash("#strategy")).toBe("strategy");
    expect(tabFromHash("#/strategy")).toBe("strategy");
    expect(tabFromHash("#unknown")).toBe("overview");
  });
});
