# Codeforces Calendar Backend - Development Guide

## Quick Start

### Option 1: Docker Compose (Recommended)

Easiest way to get started with all dependencies.

```bash
# From project root
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

**Services:**
- Backend API: http://localhost:4000
- MongoDB: localhost:27017
- Mongo Express (DB Admin): http://localhost:8081
  - Username: `admin`
  - Password: `admin123`

### Option 2: Local Development (Manual Setup)

#### 1. Install MongoDB

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Ubuntu/Debian:**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Windows:**
Download from https://www.mongodb.com/try/download/community

#### 2. Configure Environment

```bash
cd src/backend
cp .env.example .env
# Edit .env with your settings
```

#### 3. Install Dependencies

```bash
npm install
```

#### 4. Run Development Server

```bash
npm run dev
```

Server will start at http://localhost:4000 with auto-reload on file changes.

## Project Structure

```
src/backend/
├── config/
│   └── database.js         # MongoDB connection
├── controllers/            # Request handlers
│   ├── userController.js
│   ├── globalProblemSetController.js
│   └── filteredProblemSetController.js
├── models/                 # Database schemas
│   └── models.js
├── routes/                 # API route definitions
│   ├── userRoutes.js
│   ├── globalProblemSetRoutes.js
│   ├── filteredProblemSetRoutes.js
│   └── testRoutes.js
├── services/              # Business logic
│   ├── userService.js
│   ├── globalProblemSetService.js
│   └── filteredProblemSetService.js
├── cron/                  # Scheduled jobs
│   └── scheduledJobs.js
├── utils/                 # Utility functions
├── app.js                 # Express app setup
├── index.js               # Entry point
├── package.json
├── Dockerfile
└── README.dev.md         # This file
```

## API Endpoints

### User Endpoints

```http
# Get user by ID
GET /users?userID=tourist

# Create new user
POST /users
Content-Type: application/json
{
  "userID": "tourist"
}

# Update user streak
PUT /users
Content-Type: application/json
{
  "userID": "tourist",
  "last_streak_count": 7,
  "updateDate": true
}
```

### Problem Set Endpoints

```http
# Update global problem set
POST /problemset/all

# Generate filtered problem sets
POST /problemset/filtered

# Get daily problem
GET /problemset/daily?day=15&month=12&year=2024&rating=1600

# Get monthly problems
GET /problemset/monthly?month=12&year=2024&rating=1600
```

### Test Endpoints

```http
# Trigger global problem set update
POST /test/cron/update-global-problem-set

# Trigger filtered problem set generation
POST /test/cron/generate-filtered-problem-sets

# Trigger streak data cleanup
POST /test/cron/cleanup-streak-data
{
  "userID": "tourist"  // optional
}
```

## Testing with Postman

### 1. Import Collection

Create a new Postman collection with the endpoints above, or use the provided collection:

**Import this JSON:**
```json
{
  "info": {
    "name": "Codeforces Calendar API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Users",
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
            "url": {
              "raw": "http://localhost:4000/users",
              "protocol": "http",
              "host": ["localhost"],
              "port": "4000",
              "path": ["users"]
            }
          }
        }
      ]
    }
  ]
}
```

### 2. Set Environment Variables

Create a Postman environment:
- Variable: `baseUrl`
- Value: `http://localhost:4000`

Use `{{baseUrl}}` in requests.

### 3. Test Flow

1. **Create a user:**
   ```
   POST /users
   Body: {"userID": "tourist"}
   ```

2. **Get user info:**
   ```
   GET /users?userID=tourist
   ```

3. **Trigger problem set generation:**
   ```
   POST /test/cron/generate-filtered-problem-sets
   ```

4. **Get monthly problems:**
   ```
   GET /problemset/monthly?month=12&year=2024&rating=1600
   ```

## Testing with cURL

```bash
# Create user
curl -X POST http://localhost:4000/users \
  -H "Content-Type: application/json" \
  -d '{"userID": "tourist"}'

# Get user
curl "http://localhost:4000/users?userID=tourist"

# Get monthly problems
curl "http://localhost:4000/problemset/monthly?month=12&year=2024&rating=1600"

# Test cron jobs
curl -X POST http://localhost:4000/test/cron/update-global-problem-set
```

## Database Access

### MongoDB Shell

```bash
# Connect to MongoDB
mongosh

# Switch to database
use codeforces-calendar

# View collections
show collections

# Query users
db.users.find().pretty()

# Query problem sets
db.filteredproblemsets.find().pretty()

# Count documents
db.users.countDocuments()
```

### Mongo Express (Docker only)

Navigate to http://localhost:8081 and login with:
- Username: `admin`
- Password: `admin123`

## Debugging

### Enable Debug Logs

In `.env`:
```
LOG_LEVEL=debug
NODE_ENV=development
```

### Common Issues

**Port 4000 already in use:**
```bash
# Find process using port
lsof -i :4000

# Kill process
kill -9 <PID>

# Or change port in .env
API_PORT=4001
```

**MongoDB connection failed:**
```bash
# Check if MongoDB is running
brew services list  # macOS
sudo systemctl status mongod  # Linux

# Check connection string in .env
MONGO_URL=mongodb://localhost:27017/codeforces-calendar
```

**Cron jobs not running:**
```bash
# Check ENABLE_CRON in .env
ENABLE_CRON=true

# Manually trigger via test endpoint
curl -X POST http://localhost:4000/test/cron/update-global-problem-set
```

## Cron Job Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| Global Problem Set Update | Daily at 1:00 AM | Fetches new problems from Codeforces API |
| Filtered Problem Set Generation | Daily at 2:00 AM | Generates daily problems for all ratings |
| Streak Data Cleanup | Weekly on Sunday at 3:00 AM | Removes old streak data (>3 months) |

See [../../cron.md](../../cron.md) for detailed documentation.

## npm Scripts

```json
{
  "dev": "nodemon index.js",           // Development with auto-reload
  "start": "node index.js",             // Production start
  "test": "jest",                       // Run tests (to be added)
  "test:watch": "jest --watch",         // Watch mode
  "lint": "eslint .",                   // Lint code (to be added)
  "format": "prettier --write ."        // Format code (to be added)
}
```

## Next Steps

After setup:
1. Read [../../ARCHITECTURE.md](../../ARCHITECTURE.md) for system overview
2. Review [../../cron.md](../../cron.md) for cron job details
3. Check [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines

Happy coding! 🚀


