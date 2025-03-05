/**
 * Scheduled jobs for Codeforces POTD backend
 * This file sets up cron jobs to run various maintenance tasks
 */
const cron = require('node-cron');
const mongoose = require('mongoose');
const Models = require('../models/models');
const User = mongoose.model('User', Models.userSchema);
const filteredProblemSetService = require('../services/filteredProblemSetService');
const globalProblemSetService = require('../services/globalProblemSetService');
const userService = require('../services/userService');

console.log('Initializing scheduled jobs...');

/**
 * Update global problem set daily at 5:11 AM
 * This job fetches new problems from Codeforces API and updates the database
 */
cron.schedule('11 5 * * *', async () => {
  try {
    console.log('[CRON] Running scheduled global problem set update');
    const stats = await globalProblemSetService.updateGlobalProblemSet();
    console.log('[CRON] Global problem set update completed:', stats);
  } catch (error) {
    console.error('[CRON] Error in scheduled global problem set update:', error);
  }
},
{
  scheduled: true,
  timezone: "Asia/Kolkata"  // Explicitly set to IST
});

// problem will change around 00:00 GMT
cron.schedule('17 5 * * *', async () => {
  try {
    console.log('[CRON] Running daily problem set generation/update');
    const stats = await filteredProblemSetService.generateFilteredProblemSets();
    console.log('[CRON] Daily problem set generation completed:', stats);
  } catch (error) {
    console.error('[CRON] Error in daily problem set generation:', error);
  }
},
{
  scheduled: true,
  timezone: "Asia/Kolkata"  // Explicitly set to IST
});

/**
 * Clean up old streak data weekly on Sunday at 6:07 AM
 * This job removes streak data older than 3 months to keep the database efficient
 */
cron.schedule('07 6 * * 0', async () => {
  try {
    console.log('[CRON] Running scheduled streak data cleanup');
    
    // Get all users
    const users = await User.find({});
    console.log(`[CRON] Found ${users.length} users for streak cleanup`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each user
    for (const user of users) {
      try {
        if (user.userID) {
          await userService.cleanupOldStreakDays(user.userID);
          successCount++;
        }
      } catch (userError) {
        console.error(`[CRON] Error cleaning up streak data for user ${user.userID}:`, userError);
        errorCount++;
      }
    }
    
    console.log(`[CRON] Streak data cleanup completed. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('[CRON] Error in scheduled streak data cleanup:', error);
  }
},
{
  scheduled: true,
  timezone: "Asia/Kolkata"  // Explicitly set to IST
});


// Keep the server alive with a self-ping every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    console.log('[CRON] Self-ping to keep service alive');
    // This doesn't make an actual request, just logs to keep the instance active
  } catch (error) {
    console.error('[CRON] Error in keep-alive ping:', error);
  }
},
{
  scheduled: true,
  timezone: "Asia/Kolkata"  // Explicitly set to IST
});

// Log that cron jobs are initialized
console.log('Scheduled jobs initialized successfully');