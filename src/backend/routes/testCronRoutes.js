// Add to a new file: src/backend/routes/cronTestRoutes.js
const express = require('express');
const router = express.Router();
const filteredProblemSetService = require('../services/filteredProblemSetService');
const globalProblemSetService = require('../services/globalProblemSetService');
const userService = require('../services/userService');
const mongoose = require('mongoose');
const Models = require('../models/models');
const User = mongoose.model('User', Models.userSchema);

// Test endpoint for global problem set update
router.post('/update-global-problem-set', async (req, res) => {
  try {
    console.log('Manual trigger: global problem set update');
    const stats = await globalProblemSetService.updateGlobalProblemSet();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for filtered problem set generation
router.post('/generate-filtered-problem-sets', async (req, res) => {
  try {
    console.log('Manual trigger: filtered problem set generation');
    const stats = await filteredProblemSetService.generateFilteredProblemSets();
    res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for streak data cleanup
router.post('/cleanup-streak-data', async (req, res) => {
  try {
    console.log('Manual trigger: streak data cleanup');
    // Get all users or a subset
    const userID = req.body.userID; // Optional: target specific user
    
    if (userID) {
      // Clean up for specific user
      const result = await userService.cleanupOldStreakDays(userID);
      res.status(200).json({ success: true, user: result });
    } else {
      // Clean up for all users (with limit for safety)
      const users = await User.find({}).limit(10);
      const results = [];
      
      for (const user of users) {
        if (user.userID) {
          const result = await userService.cleanupOldStreakDays(user.userID);
          results.push({ userID: user.userID, success: !!result });
        }
      }
      
      res.status(200).json({ success: true, results });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;