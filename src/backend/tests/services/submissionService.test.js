const { connect, clear, close } = require("../setup/mongoMemory");
const {
  recordSubmission,
  listSubmissions,
  pruneOldSubmissions
} = require("../../services/submissionService");
const Submission = require("../../models/Submission");

beforeAll(connect);
afterEach(clear);
afterAll(close);

describe("submissionService", () => {
  describe("recordSubmission", () => {
    it("persists a new solve with the provided fields", async () => {
      const doc = await recordSubmission({
        userID: "alice",
        problemCfId: "1A",
        dateISO: "2026-04-18"
      });

      expect(doc.userID).toBe("alice");
      expect(doc.dateISO).toBe("2026-04-18");
      expect(doc.problemCfId).toBe("1A");
      expect(doc.verdict).toBe("OK");
      expect(doc.source).toBe("live");
    });

    it("defaults dateISO to today (UTC) when omitted", async () => {
      const doc = await recordSubmission({ userID: "alice", problemCfId: "2B" });
      const todayISO = new Date().toISOString().slice(0, 10);
      expect(doc.dateISO).toBe(todayISO);
    });

    it("is idempotent for the same (user, date, problem) triple", async () => {
      const first = await recordSubmission({
        userID: "alice",
        problemCfId: "1A",
        dateISO: "2026-04-18"
      });
      const second = await recordSubmission({
        userID: "alice",
        problemCfId: "1A",
        dateISO: "2026-04-18"
      });

      expect(String(second._id)).toBe(String(first._id));
      expect(await Submission.countDocuments({})).toBe(1);
    });

    it("allows multiple distinct problems on the same day", async () => {
      await recordSubmission({ userID: "alice", problemCfId: "1A", dateISO: "2026-04-18" });
      await recordSubmission({ userID: "alice", problemCfId: "2B", dateISO: "2026-04-18" });
      expect(await Submission.countDocuments({ userID: "alice" })).toBe(2);
    });
  });

  describe("listSubmissions", () => {
    beforeEach(async () => {
      await Submission.insertMany([
        { userID: "alice", dateISO: "2026-04-15", problemCfId: "a" },
        { userID: "alice", dateISO: "2026-04-16", problemCfId: "b" },
        { userID: "alice", dateISO: "2026-04-18", problemCfId: "c" },
        { userID: "bob", dateISO: "2026-04-17", problemCfId: "d" }
      ]);
    });

    it("filters by userID", async () => {
      const rows = await listSubmissions("alice");
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.userID === "alice")).toBe(true);
    });

    it("filters by inclusive date range", async () => {
      const rows = await listSubmissions("alice", "2026-04-16", "2026-04-17");
      expect(rows.map((r) => r.dateISO)).toEqual(["2026-04-16"]);
    });

    it("returns results sorted ascending by date", async () => {
      const rows = await listSubmissions("alice");
      const dates = rows.map((r) => r.dateISO);
      expect(dates).toEqual([...dates].sort());
    });

    it("omits the _id field for lighter payloads", async () => {
      const [first] = await listSubmissions("alice");
      expect(first).not.toHaveProperty("_id");
    });
  });

  describe("pruneOldSubmissions", () => {
    it("deletes docs strictly older than cutoff", async () => {
      await Submission.insertMany([
        { userID: "a", dateISO: "2025-01-01", problemCfId: "old" },
        { userID: "a", dateISO: "2026-04-01", problemCfId: "cutoff" },
        { userID: "a", dateISO: "2026-04-18", problemCfId: "recent" }
      ]);

      const result = await pruneOldSubmissions("2026-04-01");
      expect(result.deleted).toBe(1);
      expect(await Submission.countDocuments({})).toBe(2);
    });
  });
});
