const { toISODate, fromISODate, startOfISOWeek, daysBetween, addDays } = require("../../lib/dates");

describe("lib/dates", () => {
  describe("toISODate", () => {
    it("formats a Date into YYYY-MM-DD in UTC", () => {
      expect(toISODate(new Date(Date.UTC(2026, 0, 5, 23, 59)))).toBe("2026-01-05");
    });

    it("zero-pads single-digit month and day", () => {
      expect(toISODate(new Date(Date.UTC(2026, 2, 9)))).toBe("2026-03-09");
    });

    it("accepts a string and normalizes it", () => {
      expect(toISODate("2026-04-18T10:00:00Z")).toBe("2026-04-18");
    });
  });

  describe("fromISODate", () => {
    it("parses YYYY-MM-DD as UTC midnight", () => {
      const d = fromISODate("2026-04-18");
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(3);
      expect(d.getUTCDate()).toBe(18);
      expect(d.getUTCHours()).toBe(0);
    });

    it("throws on malformed input", () => {
      expect(() => fromISODate("2026/04/18")).toThrow(/Invalid ISO date/);
      expect(() => fromISODate("")).toThrow();
    });
  });

  describe("startOfISOWeek", () => {
    // 2026-04-13 is a Monday; 2026-04-18 is a Saturday.
    it("returns Monday for a mid-week date", () => {
      expect(startOfISOWeek("2026-04-18")).toBe("2026-04-13");
    });

    it("returns Monday itself when given a Monday", () => {
      expect(startOfISOWeek("2026-04-13")).toBe("2026-04-13");
    });

    it("rolls Sunday back to the previous Monday (ISO week convention)", () => {
      // 2026-04-19 is Sunday → previous Monday is 2026-04-13.
      expect(startOfISOWeek("2026-04-19")).toBe("2026-04-13");
    });

    it("handles month boundaries", () => {
      // 2026-05-01 is a Friday → Monday 2026-04-27.
      expect(startOfISOWeek("2026-05-01")).toBe("2026-04-27");
    });
  });

  describe("daysBetween", () => {
    it("returns positive count when b > a", () => {
      expect(daysBetween("2026-04-13", "2026-04-18")).toBe(5);
    });

    it("returns zero for equal dates", () => {
      expect(daysBetween("2026-04-18", "2026-04-18")).toBe(0);
    });

    it("returns negative for reversed order", () => {
      expect(daysBetween("2026-04-18", "2026-04-13")).toBe(-5);
    });
  });

  describe("addDays", () => {
    it("advances within a month", () => {
      expect(addDays("2026-04-18", 3)).toBe("2026-04-21");
    });

    it("handles negative offsets", () => {
      expect(addDays("2026-04-18", -1)).toBe("2026-04-17");
    });

    it("crosses month boundaries", () => {
      expect(addDays("2026-04-30", 2)).toBe("2026-05-02");
    });

    it("crosses year boundaries", () => {
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    });
  });
});
