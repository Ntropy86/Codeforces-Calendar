# Testing Guide - Codeforces Calendar

Comprehensive testing procedures for both backend and frontend components.

## Table of Contents

- [Backend Testing](#backend-testing)
- [Extension Testing](#extension-testing)
- [Integration Testing](#integration-testing)
- [Manual Test Scenarios](#manual-test-scenarios)
- [Performance Testing](#performance-testing)
- [Cross-Browser Testing](#cross-browser-testing)

---

## Backend Testing

### Setup

```bash
# Start backend with Docker
docker-compose up -d

# Or run locally
cd src/backend
npm run dev
```

Backend will be available at: http://localhost:4000

### Testing with Postman

#### 1. Import Collection

Save this as `Codeforces-Calendar.postman_collection.json`:

```json
{
  "info": {
    "name": "Codeforces Calendar API",
    "description": "API endpoints for Codeforces Calendar extension",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:4000"
    }
  ],
  "item": [
    {
      "name": "User Management",
      "item": [
        {
          "name": "Create User",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"userID\": \"tourist\"}"
            },
            "url": "{{baseUrl}}/users"
          }
        },
        {
          "name": "Get User",
          "request": {
            "method": "GET",
            "url": {
              "raw": "{{baseUrl}}/users?userID=tourist",
              "host": ["{{baseUrl}}"],
              "path": ["users"],
              "query": [{"key": "userID", "value": "tourist"}]
            }
          }
        },
        {
          "name": "Update User Streak",
          "request": {
            "method": "PUT",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"userID\": \"tourist\", \"last_streak_count\": 7, \"updateDate\": true}"
            },
            "url": "{{baseUrl}}/users"
          }
        }
      ]
    },
    {
      "name": "Problem Sets",
      "item": [
        {
          "name": "Get Monthly Problems",
          "request": {
            "method": "GET",
            "url": {
              "raw": "{{baseUrl}}/problemset/monthly?month=12&year=2024&rating=1600",
              "host": ["{{baseUrl}}"],
              "path": ["problemset", "monthly"],
              "query": [
                {"key": "month", "value": "12"},
                {"key": "year", "value": "2024"},
                {"key": "rating", "value": "1600"}
              ]
            }
          }
        },
        {
          "name": "Get Daily Problem",
          "request": {
            "method": "GET",
            "url": {
              "raw": "{{baseUrl}}/problemset/daily?day=15&month=12&year=2024&rating=1600",
              "host": ["{{baseUrl}}"],
              "path": ["problemset", "daily"],
              "query": [
                {"key": "day", "value": "15"},
                {"key": "month", "value": "12"},
                {"key": "year", "value": "2024"},
                {"key": "rating", "value": "1600"}
              ]
            }
          }
        }
      ]
    },
    {
      "name": "Cron Test Endpoints",
      "item": [
        {
          "name": "Update Global Problem Set",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/test/cron/update-global-problem-set"
          }
        },
        {
          "name": "Generate Filtered Problems",
          "request": {
            "method": "POST",
            "url": "{{baseUrl}}/test/cron/generate-filtered-problem-sets"
          }
        },
        {
          "name": "Cleanup Streak Data",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"userID\": \"tourist\"}"
            },
            "url": "{{baseUrl}}/test/cron/cleanup-streak-data"
          }
        }
      ]
    }
  ]
}
```

Import in Postman: File → Import → Select file

#### 2. Test Sequence

Execute requests in this order:

1. **Create User** → Should return user with rating from Codeforces API
2. **Get User** → Verify user data stored correctly
3. **Update Global Problem Set** → Populate problems database
4. **Generate Filtered Problems** → Create daily problems for all ratings
5. **Get Monthly Problems** → Verify problems generated for specific rating
6. **Get Daily Problem** → Verify specific day's problem
7. **Update User Streak** → Test streak update
8. **Cleanup Streak Data** → Test old data removal

### Testing with cURL

```bash
# Create user
curl -X POST http://localhost:4000/users \
  -H "Content-Type: application/json" \
  -d '{"userID": "tourist"}'

# Get user
curl "http://localhost:4000/users?userID=tourist"

# Trigger problem set generation
curl -X POST http://localhost:4000/test/cron/update-global-problem-set
curl -X POST http://localhost:4000/test/cron/generate-filtered-problem-sets

# Get monthly problems
curl "http://localhost:4000/problemset/monthly?month=12&year=2024&rating=1600"
```

### Database Verification

```bash
# Connect to MongoDB
mongosh

# Switch to database
use codeforces-calendar

# Verify user created
db.users.find({userID: "tourist"}).pretty()

# Check problem sets
db.filteredproblemsets.find().limit(1).pretty()
db.globalproblemsets.find().limit(1).pretty()
```

---

## Extension Testing

### Setup

```bash
cd src/extension
npm install
npm run dev  # Opens Chrome with extension loaded
```

### Manual Testing Checklist

#### First-Time User Flow

- [ ] Open Codeforces.com
- [ ] Calendar should show setup form (no popup)
- [ ] Enter valid Codeforces handle
- [ ] Click submit
- [ ] Verify:
  - [ ] Loading state shows
  - [ ] Success message appears
  - [ ] Calendar populates with problems
  - [ ] User rating displays correctly
  - [ ] Streak shows as 0

#### Calendar Display

- [ ] Calendar appears in Codeforces sidebar
- [ ] Current month/year displays correctly
- [ ] Days of week headers visible
- [ ] Current day highlighted
- [ ] Past days have problem links
- [ ] Future days show day number only
- [ ] Solved days show checkmark ✔

#### Settings Panel

- [ ] Click gear icon opens settings
- [ ] Username displays correctly
- [ ] Rating displays correctly
- [ ] Theme toggle works (Light/Dark/Auto)
- [ ] Save button works
- [ ] Cancel button closes panel
- [ ] Right-click menu shows settings option

#### Extension Icon

- [ ] Click extension icon shows tooltip
- [ ] Tooltip shows:
  - [ ] Current streak
  - [ ] Today's problem status
  - [ ] User rating
  - [ ] Quick link to Codeforces

#### Streak Functionality

- [ ] Solve today's problem on Codeforces
- [ ] Wait for auto-check (runs every hour)
- [ ] Or manually refresh
- [ ] Verify:
  - [ ] Checkmark appears on today
  - [ ] Streak counter increments
  - [ ] Calendar cell marked as solved
  - [ ] Backend updated

#### Problem Interactions

- [ ] Click problem link opens in new tab
- [ ] Hover shows problem preview (if implemented)
- [ ] Right-click shows context menu

### Browser Console Testing

#### Content Script Logs

1. Open Codeforces page
2. Right-click → Inspect → Console
3. Check for errors
4. Verify calendar initialization logs

#### Background Worker Logs

1. Go to `chrome://extensions/`
2. Find "Codeforces POTD"
3. Click "service worker" link
4. Check console for:
   - Periodic task logs
   - API call logs
   - Error messages

### Chrome Storage Inspection

```javascript
// Run in console on Codeforces page
chrome.storage.local.get(null, (data) => {
  console.log('Storage contents:', data);
});

// Check specific keys
chrome.storage.local.get(['userData', 'userInfo', 'problemData'], (data) => {
  console.log('User Data:', data.userData);
  console.log('User Info:', data.userInfo);
  console.log('Problem Data:', data.problemData);
});
```

---

## Integration Testing

### End-to-End Test Scenarios

#### Scenario 1: New User Registration

1. Clear extension storage:
   ```javascript
   chrome.storage.local.clear();
   ```
2. Reload Codeforces page
3. Enter username in setup form
4. Verify backend receives POST /users request
5. Verify user created in MongoDB
6. Verify problems fetched
7. Verify calendar displays correctly

#### Scenario 2: Returning User

1. Open Codeforces with existing user data
2. Verify calendar loads immediately
3. Verify no setup form shown
4. Check that data is from cache (fast load)

#### Scenario 3: Solve Problem & Update Streak

1. Note current problem for today
2. Go to problem page on Codeforces
3. Submit a solution
4. Mark as OK (accepted)
5. Wait for hourly check or trigger manually
6. Verify:
   - Backend `/users` PUT request
   - MongoDB user streak updated
   - Extension storage updated
   - Calendar UI updates

#### Scenario 4: Month Transition

1. Test near end of month
2. Verify problems available for next month
3. Test on first day of new month
4. Verify calendar switches to new month
5. Verify old month data preserved

---

## Manual Test Scenarios

### Critical Path Tests

#### ✅ User Registration
- Valid username → Success
- Invalid username → Error message
- Already registered → Load existing data
- API down → Graceful error handling

#### ✅ Calendar Display
- Correct month/year
- All days rendered
- Problem links work
- Solved days marked
- Current day highlighted

#### ✅ Streak Management
- Increment on solve
- Reset after gap
- Persist across sessions
- Sync with backend

#### ✅ Rating Updates
**THIS IS THE CRITICAL BUG TO FIX**
- Initial rating correct
- Rating updates when improved on CF
- Refresh button updates rating
- Daily cron updates rating

### Edge Cases

#### Date/Time Edge Cases
- [ ] Test at midnight UTC
- [ ] Test in different timezones
- [ ] Test month boundaries (30th, 31st, Feb 28/29)
- [ ] Test year boundaries (Dec 31 → Jan 1)

#### Data Edge Cases
- [ ] User with 0 problems solved
- [ ] User with very long streak (>100 days)
- [ ] User with no rating (unrated)
- [ ] Non-existent Codeforces user
- [ ] Network errors during fetch

#### UI Edge Cases
- [ ] Very long username (display correctly?)
- [ ] Very high rating (display correctly?)
- [ ] No problems available for rating
- [ ] Slow network (loading states)

---

## Performance Testing

### Backend Performance

```bash
# Use Apache Bench
ab -n 1000 -c 100 http://localhost:4000/users?userID=tourist

# Or use Artillery
npm install -g artillery
artillery quick --count 100 --num 10 http://localhost:4000/users?userID=tourist
```

**Metrics to track:**
- Response time < 200ms for GET requests
- Response time < 500ms for POST requests
- Handle 100 concurrent requests
- No memory leaks over time

### Extension Performance

**Metrics to track:**
- Calendar render time < 100ms
- Storage operations < 50ms
- API calls < 1s (network dependent)
- No memory leaks in background worker

**Chrome DevTools:**
1. Performance tab
2. Record while interacting with calendar
3. Check for:
   - Long tasks (>50ms)
   - Excessive reflows
   - Memory leaks

---

## Cross-Browser Testing

### Browsers to Test

- [x] Chrome (primary)
- [ ] Edge (Chromium-based, should work)
- [ ] Firefox (needs adjustments)
- [ ] Brave (Chromium-based, should work)

### Known Issues

**Firefox:**
- `chrome` API → needs `browser` API
- Service worker differences
- Storage API differences

---

## Automated Testing (Future)

### Unit Tests (Jest)

```javascript
// Example test structure
describe('Streak Service', () => {
  test('calculates streak correctly', () => {
    // Test implementation
  });
  
  test('resets streak after gap', () => {
    // Test implementation
  });
});
```

### E2E Tests (Playwright)

```javascript
// Example E2E test
test('user can register and see calendar', async ({ page }) => {
  await page.goto('https://codeforces.com');
  // Test implementation
});
```

---

## Reporting Issues

When reporting bugs, include:

1. **Environment:**
   - Browser version
   - Extension version
   - OS

2. **Steps to reproduce:**
   - Detailed sequence
   - Expected vs actual behavior

3. **Logs:**
   - Browser console errors
   - Backend logs
   - Network tab (failed requests)

4. **Screenshots/Videos:**
   - Visual bugs
   - UI issues

---

## Test Coverage Goals

- [ ] Backend: >80% code coverage
- [ ] Extension: >70% code coverage (utils/services)
- [ ] All critical paths tested
- [ ] All edge cases documented
- [ ] Performance benchmarks established

---

## Quick Test Commands

```bash
# Backend
cd src/backend
npm run dev        # Start development server
npm test           # Run tests (when implemented)

# Extension
cd src/extension
npm run dev        # Open Chrome with extension
npm run lint       # Lint code
npm run watch      # Watch mode with hot-reload

# Docker
docker-compose up -d              # Start all services
docker-compose logs -f backend    # View backend logs
docker-compose down -v            # Clean slate
```

---

## Next Steps

1. Implement automated tests (Jest for backend, Playwright for E2E)
2. Set up CI/CD pipeline for automated testing
3. Add test coverage reporting
4. Create performance benchmarks
5. Document browser compatibility matrix

Happy testing! 🧪

