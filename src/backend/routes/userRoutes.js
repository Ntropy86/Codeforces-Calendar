const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * @route GET /users
 * @desc Get user by ID
 * @access Public
 */
router.get('/', userController.getUser);

/**
 * @route POST /users
 * @desc Create a new user
 * @access Public
 */
router.post('/', userController.createUser);

/**
 * @route PUT /users
 * @desc Update user streak
 * @access Public
 */
router.put('/', userController.updateUserStreak);

/**
 * @route PUT /users/streak-day
 * @desc Update a specific day in user's streak
 * @access Public
 */
router.put('/streak-day', userController.updateUserStreakDay);

/**
 * @route PUT /users/reset-streak-days
 * @desc Reset all streak days for a user
 * @access Public
 */
router.put('/reset-streak-days', userController.resetUserStreakDays);

/**
 * @route PUT /users/cleanup-streak-days
 * @desc Clean up old streak days (older than 3 months)
 * @access Public
 */
router.put('/cleanup-streak-days', userController.cleanupOldStreakDays);

/**
 * @route PUT /users/streak-date
 * @desc Update only the last_streak_date for a user
 * @access Public
 */
router.put('/streak-date', userController.updateUserStreakDate);

module.exports = router;