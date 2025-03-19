require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bp = require("body-parser");
const cors = require("cors"); // Add this for CORS support
const app = express();

// === Set up CORS middleware ===
app.use(cors({
  origin: "*", // Allow all origins for now
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// === Import routes ===
const userRoutes = require('./routes/userRoutes');
const globalProblemSetRoutes = require('./routes/globalProblemSetRoutes');
const filteredProblemSetRoutes = require('./routes/filteredProblemSetRoutes');
const testRoutes = require('./routes/testRoutes');
const testCronRoutes = require('./routes/testCronRoutes');

// === Initialize scheduled jobs ===
require('./cron/scheduledJobs');

// === Middleware ===
app.use(express.json());
app.use(bp.json());
app.use(bp.urlencoded({ extended: true }));

// === Test/Welcome/Status Check route ===
app.get("/welcome", (req, res) => {
	res.status(200).send("Welcome 🙌 ");
});

// === Routes ===
app.use("/users", userRoutes);
app.use("/problemset", globalProblemSetRoutes);
app.use("/problemset", filteredProblemSetRoutes);

// === Test routes ===
app.use("/test", testRoutes);
app.use("/test/cron", testCronRoutes);

// POST /test/cron/update-global-problem-set
// POST /test/cron/generate-filtered-problem-sets
// POST /test/cron/cleanup-streak-data

module.exports = app;