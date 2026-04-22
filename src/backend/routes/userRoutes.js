const express = require("express");
const users = require("../controllers/userController");

const router = express.Router();

router.post("/", users.createOrLogin);
router.get("/:userID", users.getUser);
router.post("/:userID/refresh-rating", users.refreshRating);

module.exports = router;
