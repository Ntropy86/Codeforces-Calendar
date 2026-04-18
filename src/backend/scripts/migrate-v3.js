/**
 * One-shot V2 → V3 migration.
 *
 * Transforms legacy collections into the new V3 shape:
 *   globalproblemsets  → problems          (rename + field rewrite)
 *   filteredproblemsets → (dropped)         no longer needed; selector is pure
 *   users (V2 streak)  → users (slim) + submissions (derived from streak_days)
 *
 * Design goals:
 *   - Idempotent: re-running does nothing destructive if V3 is already populated.
 *   - Non-destructive by default: old collections are kept until --drop-legacy.
 *   - Readable log so you can sanity-check counts before cutting over.
 *
 * Usage:
 *   node scripts/migrate-v3.js              # dry-run summary
 *   node scripts/migrate-v3.js --apply      # write V3 collections
 *   node scripts/migrate-v3.js --apply --drop-legacy
 *
 * Run inside the container (has the MongoDB connection string):
 *   docker compose exec backend node scripts/migrate-v3.js --apply
 */
const mongoose = require("mongoose");
const database = require("../config/database");
const Problem = require("../models/Problem");
const User = require("../models/User");
const Submission = require("../models/Submission");

const APPLY = process.argv.includes("--apply");
const DROP_LEGACY = process.argv.includes("--drop-legacy");

async function main() {
  await database.connect();
  // Wait for the initial connection if database.connect() returns before open.
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once("open", resolve);
      mongoose.connection.once("error", reject);
    });
  }

  const db = mongoose.connection.db;
  const summary = { problems: 0, users: 0, submissions: 0, skippedLegacyProblems: 0 };

  console.log(`[migrate] mode=${APPLY ? "APPLY" : "DRY-RUN"} dropLegacy=${DROP_LEGACY}`);

  // ---- problems ----
  const legacyProblems = await db.collection("globalproblemsets").find({}).toArray();
  console.log(`[migrate] legacy globalproblemsets: ${legacyProblems.length}`);

  if (APPLY && legacyProblems.length) {
    const alreadyByCfId = new Map(
      (await Problem.find({}, { cfId: 1 }).lean()).map((p) => [p.cfId, true])
    );

    const toInsert = [];
    for (const p of legacyProblems) {
      if (!p.problemID || !p.problemRating) {
        summary.skippedLegacyProblems++;
        continue;
      }
      if (alreadyByCfId.has(p.problemID)) continue;

      const { contestId, index } = parseCfId(p.problemID);
      if (!contestId) {
        summary.skippedLegacyProblems++;
        continue;
      }
      toInsert.push({
        cfId: p.problemID,
        contestId,
        index,
        name: p.problemID, // name not stored in V2; best-effort placeholder
        rating: p.problemRating,
        tags: [],
        addedAt: new Date(0) // backfilled: treat as eligible-from-forever
      });
    }
    if (toInsert.length) {
      await Problem.insertMany(toInsert, { ordered: false });
      summary.problems = toInsert.length;
    }
  }

  // ---- users + submissions ----
  const legacyUsers = await db.collection("users").find({ "streak.streak_days": { $exists: true } }).toArray();
  console.log(`[migrate] legacy users with streak_days: ${legacyUsers.length}`);

  if (APPLY) {
    for (const u of legacyUsers) {
      // Slim user (overwrite in place — strip streak subdoc).
      await User.updateOne(
        { userID: u.userID },
        {
          $set: {
            userID: u.userID,
            rating: u.rating ?? 800,
            ratingUpdatedAt: new Date(),
            createdAt: u._id?.getTimestamp?.() ?? new Date()
          },
          $unset: { streak: "" }
        },
        { upsert: true }
      );

      // streak_days Map → submissions rows (only `true` entries).
      const days = u.streak?.streak_days || {};
      const entries = days instanceof Map ? [...days.entries()] : Object.entries(days);

      const submissionDocs = entries
        .filter(([, solved]) => !!solved)
        .map(([key]) => ({
          userID: u.userID,
          dateISO: toCanonicalISODate(key),
          problemCfId: null,
          verdict: "OK",
          source: "migrated"
        }))
        .filter((d) => !!d.dateISO);

      if (submissionDocs.length) {
        // insertMany with ordered:false so unique-index collisions on re-run
        // silently skip already-migrated days.
        try {
          await Submission.insertMany(submissionDocs, { ordered: false });
          summary.submissions += submissionDocs.length;
        } catch (err) {
          if (err.code !== 11000) throw err;
          summary.submissions += submissionDocs.length - (err.writeErrors?.length || 0);
        }
      }
      summary.users++;
    }
  }

  // ---- drop legacy ----
  if (APPLY && DROP_LEGACY) {
    const dropIfExists = async (name) => {
      const existing = await db.listCollections({ name }).toArray();
      if (existing.length) {
        await db.dropCollection(name);
        console.log(`[migrate] dropped legacy collection: ${name}`);
      }
    };
    await dropIfExists("filteredproblemsets");
    await dropIfExists("globalproblemsets");
  }

  console.log("[migrate] summary:", summary);
  await mongoose.disconnect();
}

/** Parse a V2 problemID like "1234A" or "1234A1" into { contestId, index }. */
function parseCfId(cfId) {
  const m = String(cfId).match(/^(\d+)([A-Z].*)$/);
  if (!m) return { contestId: null, index: null };
  return { contestId: Number(m[1]), index: m[2] };
}

/** V2 used "YYYY-M-D" with no zero padding. V3 stores "YYYY-MM-DD". */
function toCanonicalISODate(key) {
  const m = String(key).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
