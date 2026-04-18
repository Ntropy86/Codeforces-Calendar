require("dotenv").config();
require("./config/database").connect();

const express = require("express");
const cors = require("cors");

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// V3 API surface
app.use("/users", require("./routes/userRoutes"));
app.use("/problems", require("./routes/problemRoutes"));
app.use("/submissions", require("./routes/submissionRoutes"));

// Dev-only utility routes (cron triggers, health probes).
if (process.env.NODE_ENV !== "production") {
  app.use("/test", require("./routes/testRoutes"));
  app.use("/test/cron", require("./routes/testCronRoutes"));
}

app.get("/welcome", (_req, res) => res.status(200).send("Welcome 🙌"));

// In-process cron is opt-in. GCP Cloud Scheduler hits /test/cron in production.
if (process.env.ENABLE_CRON === "true") {
  require("./cron/scheduledJobs");
}

module.exports = app;
