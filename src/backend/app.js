
require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bp = require("body-parser");
const app = express();

// === Import routes ===
const userRoutes = require('./routes/userRoutes');
const globalProblemSetRoutes = require('./routes/globalProblemSetRoutes');
const filteredProblemSetRoutes = require('./routes/filteredProblemSetRoutes');

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

module.exports = app;