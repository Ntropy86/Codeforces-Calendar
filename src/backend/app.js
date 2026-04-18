require("dotenv").config();
require("./config/database").connect();

const express = require("express");
const cors = require("cors");

const app = express();

// CORS is driven by CORS_ORIGIN env var (falls back to "*" only for local dev).
// Example values:
//   development: "*"
//   production:  "chrome-extension://kdpcekneldcnkajbmabmfgdpcdjdmcfd"
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core routes
app.use("/users", require("./routes/userRoutes"));
app.use("/problemset", require("./routes/globalProblemSetRoutes"));
app.use("/problemset", require("./routes/filteredProblemSetRoutes"));

// Test / cron-trigger routes are only exposed outside of production so they
// can never be invoked against a live deployment.
if (process.env.NODE_ENV !== "production") {
  app.use("/test", require("./routes/testRoutes"));
  app.use("/test/cron", require("./routes/testCronRoutes"));
}

// Health check
app.get("/welcome", (_req, res) => res.status(200).send("Welcome 🙌"));

// Scheduled jobs (only when explicitly enabled — lets tests/one-off scripts
// run the app without triggering cron).
if (process.env.ENABLE_CRON === "true") {
  require("./cron/scheduledJobs");
}

module.exports = app;
