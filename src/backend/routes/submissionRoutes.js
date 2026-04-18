const express = require("express");
const submissions = require("../controllers/submissionController");

const router = express.Router();

router.post("/", submissions.record);
router.get("/", submissions.list);

module.exports = router;
