# Scheduled Jobs (Backend)

All background automation for the Codeforces POTD project lives on the backend.
The extension no longer runs periodic alarms — it reconciles with the backend
on every page load (see `syncUserInBackground` in `content.js`).

## Backend Cron Jobs

Scheduled with `node-cron` in `src/backend/cron/scheduledJobs.js`, timezone is
`Asia/Kolkata`. Cron only runs when `ENABLE_CRON=true` in the loaded `.env`.

| Job                             | Schedule (IST)          | Description                                                                                  |
| ------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `update-global-problem-set`     | Daily at 05:11          | Pulls new problems from the Codeforces API and appends them to `GlobalProblemSet`.           |
| `generate-filtered-problem-sets`| Daily at 05:17          | Populates per-rating daily problems in `FilteredProblemSet`; pre-fills next month from day 28. |
| `cleanup-old-streak-days`       | Weekly, Sunday 06:07    | Trims `User.streak.streak_days` entries older than 3 months to keep user docs compact.       |

Day-to-day problem rotation relies on `update-global-problem-set` running
before `generate-filtered-problem-sets` on the same morning, which is why they
are staggered by a few minutes.

## Manual Triggers (dev only)

Available when `NODE_ENV !== "production"`. All routes are mounted at
`/test/cron` and return the same `{ success, stats }` shape the scheduler logs.

| Route                                           | Method | Description                                                      |
| ----------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `/test/cron/update-global-problem-set`          | POST   | Run the global problem-set update immediately.                   |
| `/test/cron/generate-filtered-problem-sets`     | POST   | Run the filtered problem-set generation immediately.             |
| `/test/cron/cleanup-streak-data`                | POST   | Run streak cleanup (optional `userID` body param for one user).  |

```bash
curl -X POST http://localhost:4000/test/cron/update-global-problem-set
curl -X POST http://localhost:4000/test/cron/generate-filtered-problem-sets
curl -X POST http://localhost:4000/test/cron/cleanup-streak-data
```

## Operational Notes

- **Timezone**: schedules assume IST. If you deploy to a region with a different
  wall-clock, adjust `TIMEZONE` in `scheduledJobs.js` or migrate the schedule
  to an external scheduler (see "Future Direction").
- **Failures are local**: a single failed job logs the error and the scheduler
  keeps running. There is no retry queue — the next day's run will catch up
  because jobs are idempotent.
- **Problem rotation is daily**: `generate-filtered-problem-sets` only adds
  problems for days that haven't been assigned yet, so re-running it on the
  same day is a no-op (safe to trigger manually).

## Future Direction

In-process `node-cron` works for the current single-instance deployment but
has two weaknesses: it scales down to zero instances poorly (no triggers fire),
and the schedule is coupled to the API runtime. We're evaluating moving the
jobs out of the process — see the team discussion for the full options list.
