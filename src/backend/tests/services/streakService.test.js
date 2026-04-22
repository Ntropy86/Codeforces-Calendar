const { connect, clear, close } = require("../setup/mongoMemory");
const { getCurrentStreak, getSolvedDays } = require("../../services/streakService");
const Submission = require("../../models/Submission");

beforeAll(connect);
afterEach(clear);
afterAll(close);

const TODAY = new Date("2026-04-18T12:00:00Z"); // Saturday

async function seed(dates, { userID = "alice", verdict = "OK" } = {}) {
  await Submission.insertMany(
    dates.map((dateISO, i) => ({
      userID,
      dateISO,
      problemCfId: `p-${i}`,
      verdict
    }))
  );
}

describe("streakService.getCurrentStreak", () => {
  it("returns zero when the user has no submissions", async () => {
    const streak = await getCurrentStreak("ghost", { now: TODAY });
    expect(streak).toEqual({ length: 0, lastSolvedDate: null, includesToday: false });
  });

  it("counts a single solve today as a streak of 1", async () => {
    await seed(["2026-04-18"]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak).toEqual({ length: 1, lastSolvedDate: "2026-04-18", includesToday: true });
  });

  it("counts consecutive prior days ending today", async () => {
    await seed(["2026-04-15", "2026-04-16", "2026-04-17", "2026-04-18"]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak).toEqual({ length: 4, lastSolvedDate: "2026-04-18", includesToday: true });
  });

  it("uses yesterday as anchor when today is not yet solved", async () => {
    // Users shouldn't lose their streak at 00:00 UTC just because they
    // haven't solved today's problem yet.
    await seed(["2026-04-15", "2026-04-16", "2026-04-17"]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak).toEqual({ length: 3, lastSolvedDate: "2026-04-17", includesToday: false });
  });

  it("breaks the streak on a gap", async () => {
    // Gap at 2026-04-16 → only 17 & 18 count.
    await seed(["2026-04-14", "2026-04-15", "2026-04-17", "2026-04-18"]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak.length).toBe(2);
    expect(streak.lastSolvedDate).toBe("2026-04-18");
  });

  it("resets to zero if neither today nor yesterday is solved", async () => {
    await seed(["2026-04-15", "2026-04-16"]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak.length).toBe(0);
    expect(streak.includesToday).toBe(false);
    expect(streak.lastSolvedDate).toBe("2026-04-16");
  });

  it("ignores submissions older than the lookback window", async () => {
    // 500 days ago — outside the 400-day default window.
    await seed(["2024-12-01"]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak.length).toBe(0);
  });

  it("ignores non-OK verdicts", async () => {
    await seed(["2026-04-18"], { verdict: "WRONG_ANSWER" });
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak.length).toBe(0);
  });

  it("collapses multiple solves on the same day into one streak day", async () => {
    await Submission.insertMany([
      { userID: "alice", dateISO: "2026-04-17", problemCfId: "x", verdict: "OK" },
      { userID: "alice", dateISO: "2026-04-17", problemCfId: "y", verdict: "OK" },
      { userID: "alice", dateISO: "2026-04-18", problemCfId: "z", verdict: "OK" }
    ]);
    const streak = await getCurrentStreak("alice", { now: TODAY });
    expect(streak.length).toBe(2);
  });
});

describe("streakService.getSolvedDays", () => {
  it("returns { iso: true } for solved days in the range", async () => {
    await seed(["2026-04-10", "2026-04-15", "2026-04-18"]);
    const map = await getSolvedDays("alice", "2026-04-12", "2026-04-18");
    expect(map).toEqual({ "2026-04-15": true, "2026-04-18": true });
  });

  it("is empty for users with no submissions in range", async () => {
    const map = await getSolvedDays("alice", "2026-04-01", "2026-04-30");
    expect(map).toEqual({});
  });
});
