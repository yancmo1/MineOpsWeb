// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchCaptureStatus } from "./capture";

const pocketbaseMocks = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock("./pocketbase", () => pocketbaseMocks);

const records = [
  "5.59.0_96449_20260716T143539Z",
  "5.59.0_96449_20260716T143539Z.lossless-v2",
  "5.60.0_96765_20260814T121627Z",
  "5.63.0_97356_20260914T134142Z",
].map((version) => ({ version, source: "ubuntumac/0.1.0", recordCount: "0" }));

describe("capture bridge status", () => {
  it("finds the newest release even when the API page is truncated and has no created field", async () => {
    const catalog = {
      getList: vi.fn(async () => ({ totalItems: records.length, items: records.slice(0, 3) })),
      getFullList: vi.fn(async () => records),
    };
    const client = {
      authStore: { isValid: false },
      collection: vi.fn(() => catalog),
    };
    pocketbaseMocks.getClient.mockReturnValue(client);

    const status = await fetchCaptureStatus();

    expect(status.lastReleaseId).toBe("5.63.0_97356_20260914T134142Z");
    expect(status.recentReleases?.[0].releaseId).toBe("5.63.0_97356_20260914T134142Z");
  });
});
