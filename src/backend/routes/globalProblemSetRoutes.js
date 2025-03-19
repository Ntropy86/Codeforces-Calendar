const express = require('express');
const router = express.Router();
const globalProblemSetController = require('../controllers/globalProblemSetController');

/**
 * @route POST /problemset/all
 * @desc Update global problem set with new problems from Codeforces
 * @access Public
 */
router.post('/all', globalProblemSetController.updateGlobalProblemSet);

module.exports = router;