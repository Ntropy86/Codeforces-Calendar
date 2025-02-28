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

module.exports = router;