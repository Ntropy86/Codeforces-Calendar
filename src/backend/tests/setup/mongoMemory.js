/**
 * Shared test harness: spin up an in-memory MongoDB, connect mongoose to it,
 * and tear it down between tests.
 *
 * Each test file imports { connect, clear, close } and calls them from its
 * own before/after hooks. Keeping this out of globalSetup lets individual
 * files decide whether they need DB isolation per-test (via `clear`) or not.
 */

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { connect, clear, close };
