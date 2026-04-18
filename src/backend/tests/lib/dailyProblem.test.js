const { dailyProblem, seedFor } = require("../../lib/dailyProblem");

/** Build a tiny pool of problems all added before the test week. */
function makePool(rating, ids) {
  const addedAt = new Date("2026-01-01T00:00:00Z");
  return ids.map((cfId) => ({ cfId, rating, addedAt }));
}

describe("lib/dailyProblem", () => {
  const rating = 1200;
  // 2026-04-18 is a Saturday; 2026-04-13 Monday is the week start.
  const weekDates = [
    "2026-04-13", // Mon
    "2026-04-14", // Tue
    "2026-04-15", // Wed
    "2026-04-16", // Thu
    "2026-04-17", // Fri
    "2026-04-18", // Sat
    "2026-04-19" // Sun
  ];

  describe("contract: (rating, date, pool) → same pick", () => {
    it("is deterministic across calls", () => {
      const pool = makePool(rating, ["1A", "2B", "3C", "4D", "5E"]);
      const a = dailyProblem(rating, "2026-04-18", pool);
      const b = dailyProblem(rating, "2026-04-18", pool);
      expect(a).toEqual(b);
    });

    it("is independent of pool insertion order", () => {
      const forward = makePool(rating, ["1A", "2B", "3C", "4D", "5E"]);
      const reversed = makePool(rating, ["5E", "4D", "3C", "2B", "1A"]);
      expect(dailyProblem(rating, "2026-04-18", forward).cfId).toBe(
        dailyProblem(rating, "2026-04-18", reversed).cfId
      );
    });

    it("gives the same pool the same pick for every user of that rating", () => {
      // Two callers with identical rating and date see the same problem.
      const pool = makePool(rating, ["1A", "2B", "3C", "4D", "5E"]);
      const pickForUserX = dailyProblem(rating, "2026-04-18", pool);
      const pickForUserY = dailyProblem(rating, "2026-04-18", pool);
      expect(pickForUserX.cfId).toBe(pickForUserY.cfId);
    });
  });

  describe("week-stability", () => {
    it("ignores problems added during the current week", () => {
      const pool = [
        ...makePool(rating, ["A1", "A2", "A3"]),
        // Added Tuesday of the test week — must not be visible until next week.
        { cfId: "LATE", rating, addedAt: new Date("2026-04-14T00:00:00Z") }
      ];
      for (const d of weekDates) {
        expect(dailyProblem(rating, d, pool).cfId).not.toBe("LATE");
      }
    });

    it("includes problems added before or at week-start", () => {
      const pool = [
        { cfId: "OLD", rating, addedAt: new Date("2025-12-01T00:00:00Z") },
        // Exactly on the week-start boundary — inclusive.
        { cfId: "BOUNDARY", rating, addedAt: new Date("2026-04-13T00:00:00Z") }
      ];
      const picked = dailyProblem(rating, "2026-04-18", pool);
      expect(["OLD", "BOUNDARY"]).toContain(picked.cfId);
    });
  });

  describe("day-of-week rotation within a week", () => {
    it("cycles through the pool as the day advances", () => {
      // Pool size 7 guarantees a distinct pick for each day of the week
      // since the index formula is (seed + dow) % 7 → all 7 indices hit.
      const pool = makePool(rating, ["1", "2", "3", "4", "5", "6", "7"]);
      const picks = weekDates.map((d) => dailyProblem(rating, d, pool).cfId);
      expect(new Set(picks).size).toBe(7);
    });

    it("keeps today's pick constant all day", () => {
      // `dateISO` is day-granularity; same day = same pick regardless of time.
      const pool = makePool(rating, ["1", "2", "3", "4", "5"]);
      expect(dailyProblem(rating, "2026-04-18", pool).cfId).toBe(
        dailyProblem(rating, "2026-04-18", pool).cfId
      );
    });
  });

  describe("empty / invalid inputs", () => {
    it("returns null when pool is empty", () => {
      expect(dailyProblem(rating, "2026-04-18", [])).toBeNull();
    });

    it("returns null when no problem matches the rating", () => {
      const pool = makePool(1500, ["1", "2", "3"]);
      expect(dailyProblem(1200, "2026-04-18", pool)).toBeNull();
    });

    it("returns null when every candidate was added after week-start", () => {
      const pool = [{ cfId: "LATE", rating, addedAt: new Date("2026-04-14T00:00:00Z") }];
      expect(dailyProblem(rating, "2026-04-13", pool)).toBeNull();
    });

    it("returns null for non-array pool", () => {
      expect(dailyProblem(rating, "2026-04-18", null)).toBeNull();
      expect(dailyProblem(rating, "2026-04-18", undefined)).toBeNull();
    });
  });

  describe("seedFor", () => {
    it("produces 32-bit unsigned integers", () => {
      const s = seedFor(1200, "2026-04-13");
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 32);
    });

    it("changes when rating changes", () => {
      expect(seedFor(1200, "2026-04-13")).not.toBe(seedFor(1300, "2026-04-13"));
    });

    it("changes when week changes", () => {
      expect(seedFor(1200, "2026-04-13")).not.toBe(seedFor(1200, "2026-04-20"));
    });
  });
});
