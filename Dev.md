# Codeforces POTD Backend Dev Documentation

## Project Structure

This project follows a modular architecture with separation of concerns:

```
project-root/
├── config/             # Configuration files
│   └── database.js     # Database connection setup
├── controllers/        # Request handlers
│   ├── userController.js
│   ├── globalProblemSetController.js
│   └── filteredProblemSetController.js
├── models/             # Database schemas
│   └── models.js
├── routes/             # API route definitions
│   ├── userRoutes.js
│   ├── globalProblemSetRoutes.js
│   └── filteredProblemSetRoutes.js
├── services/           # Business logic
│   ├── userService.js
│   ├── globalProblemSetService.js
│   └── filteredProblemSetService.js
├── app.js              # Express application setup
└── index.js            # Application entry point
```

## Architectural Pattern

The application follows a layered architecture:

1. **Routes Layer** - Defines API endpoints
2. **Controllers Layer** - Handles HTTP requests and responses
3. **Services Layer** - Contains business logic
4. **Data Access Layer** - Interacts with the database (embedded in services)

## API Endpoints

### User Endpoints

- `GET /users` - Get user by ID
- `POST /users` - Create a new user
- `PUT /users` - Update user streak

### Global Problem Set Endpoints

- `POST /problemset/all` - Update global problem set with problems from Codeforces

### Filtered Problem Set Endpoints

- `POST /problemset/filtered` - Generate filtered problem sets
- `GET /problemset/daily` - Get problem for a specific day and rating
- `GET /problemset/monthly` - Get problems for the entire month


## Cron Documentation
All the cron jobs that are running can be found here: [Cronjobs documentation](./cron.md)

## Running the Application

1. Install dependencies: `npm install`
2. Set up environment variables in `.env` file
3. Start the server: `npm start`

## Features

- Fetches and stores Codeforces problems
- Manages user accounts and streaks
- Creates daily problem sets filtered by rating
- Automatically updates problem sets
- Provides monthly problem overview