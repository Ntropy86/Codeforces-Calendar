# Codeforces POTD System Documentation

## Automated Background Tasks

The system includes several automated background jobs that keep the application running smoothly without manual intervention.

### Backend Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Global Problem Set Update | Daily at 1:00 AM | Fetches new problems from Codeforces API and updates the database. |
| Filtered Problem Set Generation | Daily at 2:00 AM | Ensures problems are populated for the current day and prepares problems for the next month when approaching month-end. |
| Streak Data Cleanup | Weekly on Sunday at 3:00 AM | Removes streak data older than 3 months to keep the database efficient. |

### Extension Periodic Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| Streak Status Check | Every 6 hours | Checks if a user's streak should be reset due to inactivity and performs cleanup on the first day of the month. |
| Submission Check | Every hour | Verifies if the user has submitted a solution for today's problem and updates their streak accordingly. |

## Testing Endpoints

The system provides several endpoints to manually trigger and test the automated jobs.

### Backend Test Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/test/cron/update-global-problem-set` | POST | Manually triggers the global problem set update job. |
| `/test/cron/generate-filtered-problem-sets` | POST | Manually triggers the filtered problem set generation job. |
| `/test/cron/cleanup-streak-data` | POST | Manually triggers the streak data cleanup job. Can target a specific user if `userID` is provided in the request body. |

### Extension Debug Functions

The following functions are available in the extension's background page console via `window.debugExtension`:

| Function | Description |
|----------|-------------|
| `triggerStreakCheck()` | Manually triggers the streak status check. |
| `triggerSubmissionCheck()` | Manually triggers the submission check. |
| `checkAlarmStatus()` | Retrieves and logs the current active alarms. |
| `resetAlarms()` | Clears all alarms and sets them up again. |

## Implementation Details

### Backend Cron Jobs (scheduledJobs.js)

The backend cron jobs are implemented using the `node-cron` package. The implementation is located in `src/backend/cron/scheduledJobs.js`.

Key features:
- Detailed logging with timestamps
- Comprehensive error handling
- Individual user processing for streak cleanup

### Extension Periodic Tasks (background.js)

The extension periodic tasks are implemented using Chrome's alarm API. The implementation is located in `extension/background.js`.

Key features:
- Script injection to ensure functions run in the proper context
- Robust error handling
- Detailed logging for debugging

## Testing Instructions

### Testing Backend Cron Jobs

1. Start your backend server
2. Send a POST request to the desired test endpoint:
```bash
curl -X POST http://localhost:4000/test/cron/update-global-problem-set
curl -X POST http://localhost:4000/test/cron/generate-filtered-problem-sets
curl -X POST http://localhost:4000/test/cron/cleanup-streak-data
```

3. Check the server logs for execution details

### Testing Extension Periodic Tasks

1. Open your extension in Chrome
2. Navigate to a Codeforces page
3. Open the background page console (right-click on extension → Inspect views: service worker)
4. Run one of the debug functions:
```js
window.debugExtension.triggerStreakCheck();
window.debugExtension.triggerSubmissionCheck();
window.debugExtension.checkAlarmStatus();
window.debugExtension.resetAlarms();
```
5. Check console logs for execution
