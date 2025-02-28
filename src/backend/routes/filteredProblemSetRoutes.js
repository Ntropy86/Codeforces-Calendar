const express = require('express');
const router = express.Router();
const filteredProblemSetController = require('../controllers/filteredProblemSetController');

/**
 * @route POST /problemset/filtered
 * @desc Generate filtered problem sets for each rating
 * @access Public
 */
router.post('/filtered', filteredProblemSetController.generateFilteredProblemSets);

/**
 * @route GET /problemset/monthly
 * @desc Get problems for a specific month, year and optionally rating
 * @query month - Month (0-11, default: current month)
 * @query year - Year (default: current year)
 * @query rating - Optional rating to filter by
 * @access Public
 */
router.get('/monthly', filteredProblemSetController.getMonthlyProblems);

module.exports = router;