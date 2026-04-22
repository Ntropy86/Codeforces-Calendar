const express = require("express");
const problems = require("../controllers/problemController");

const router = express.Router();

router.get("/daily", problems.getDaily);
router.get("/stats", problems.getStats);
router.get("/", problems.getRange);

module.exports = router;
