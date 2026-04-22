const { connect, clear, close } = require("../setup/mongoMemory");
const {
  getDailyProblem,
  getProblemsInRange,
  snapRating
} = require("../../services/problemService");
const Problem = require("../../models/Problem");

beforeAll(connect);
afterEach(clear);
afterAll(close);

/** Seed a few problems for a rating bucket, all added well before the test week. */
async function seedBucket(rating, ids, addedAt = new Date("2026-01-01T00:00:00Z")) {
  await Problem.insertMany(
    ids.map((cfId, i) => ({
      cfId,
      contestId: 1000 + i,
      index: cfId,
      name: `Problem ${cfId}`,
      rating,
      tags: [],
      addedAt
    }))
  );
}

describe("problemService.snapRating", () => {
  it("snaps to the nearest 100", () => {
    expect(snapRating(1204)).toBe(1200);
    expect(snapRating(1249)).toBe(1200);
    expect(snapRating(1250)).toBe(1300);
    expect(snapRating(1299)).toBe(1300);
  });

  it("clamps to the CF rating range [800, 3500]", () => {
    expect(snapRating(500)).toBe(800);
    expect(snapRating(800)).toBe(800);
    expect(snapRating(5000)).toBe(3500);
  });
});

describe("problemService.getDailyProblem", () => {
  it("returns null when the rating bucket is empty", async () => {
    const picked = await getDailyProblem(1200, "2026-04-18");
    expect(picked).toBeNull();
  });

  it("returns a problem from the correct bucket after snapping", async () => {
    // User rating 1204 should snap to 1200 and pick from that bucket.
    await seedBucket(1200, ["A1", "B2", "C3"]);
    await seedBucket(1300, ["SHOULD_NOT_PICK"]);

    const picked = await getDailyProblem(1204, "2026-04-18");
    expect(picked).not.toBeNull();
    expect(["A1", "B2", "C3"]).toContain(picked.cfId);
    expect(picked.rating).toBe(1200);
  });

  it("attaches a codeforces.com URL to the result", async () => {
    await seedBucket(1200, ["A1"]);
    const picked = await getDailyProblem(1200, "2026-04-18");
    expect(picked.url).toBe("https://codeforces.com/problemset/problem/1000/A1");
  });

  it("produces the same pick for equal-rated users on the same day", async () => {
    await seedBucket(1200, ["A", "B", "C", "D", "E"]);
    const p1 = await getDailyProblem(1201, "2026-04-18"); // snaps to 1200
    const p2 = await getDailyProblem(1249, "2026-04-18"); // also snaps to 1200
    expect(p1.cfId).toBe(p2.cfId);
  });
});

describe("problemService.getProblemsInRange", () => {
  it("returns one entry per day in the inclusive range", async () => {
    await seedBucket(1200, ["A", "B", "C", "D", "E"]);
    const rows = await getProblemsInRange(1200, "2026-04-13", "2026-04-18");
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.dateISO)).toEqual([
      "2026-04-13",
      "2026-04-14",
      "2026-04-15",
      "2026-04-16",
      "2026-04-17",
      "2026-04-18"
    ]);
  });

  it("returns null problem slots when the bucket is empty", async () => {
    const rows = await getProblemsInRange(1200, "2026-04-13", "2026-04-15");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.problem === null)).toBe(true);
  });

  it("rejects ranges longer than one year", async () => {
    await expect(getProblemsInRange(1200, "2025-01-01", "2026-04-01")).rejects.toThrow(
      /Invalid date range/
    );
  });

  it("rejects inverted ranges", async () => {
    await expect(getProblemsInRange(1200, "2026-04-18", "2026-04-13")).rejects.toThrow(
      /Invalid date range/
    );
  });

  it("admits a mid-range problem into later weeks but not earlier ones", async () => {
    // Week 1: 2026-04-13..04-19 (Mon..Sun). Week 2: 2026-04-20..04-26.
    // Seed one problem well before the range, and one added in week 1 —
    // the late one must be invisible to week 1 but live in week 2 (regression
    // test for the pool-filter bug where the range used the earliest week's
    // snapshot for every day and silently hid mid-range additions).
    await Problem.insertMany([
      {
        cfId: "OLD",
        contestId: 1,
        index: "A",
        name: "old",
        rating: 1200,
        addedAt: new Date("2026-01-01T00:00:00Z")
      },
      {
        cfId: "MIDWEEK",
        contestId: 2,
        index: "B",
        name: "mid",
        rating: 1200,
        addedAt: new Date("2026-04-15T00:00:00Z")
      }
    ]);

    const rows = await getProblemsInRange(1200, "2026-04-13", "2026-04-26");
    const week1 = rows.slice(0, 7).map((r) => r.problem?.cfId);
    const week2 = rows.slice(7).map((r) => r.problem?.cfId);

    expect(week1).not.toContain("MIDWEEK");
    expect(week2).toContain("MIDWEEK");
  });
});
