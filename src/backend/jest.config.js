/** Jest config — unit + integration tests live under `tests/`. */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  collectCoverageFrom: ["lib/**/*.js", "services/**/*.js", "controllers/**/*.js"],
  coverageDirectory: "coverage",
  // Integration tests spin up mongodb-memory-server; keep them serial.
  maxWorkers: 1,
  testTimeout: 30000,
  verbose: true
};
