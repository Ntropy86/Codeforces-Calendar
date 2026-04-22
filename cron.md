# Scheduled Jobs (Backend)

All background automation for the Codeforces POTD project lives on the
backend. The extension never runs its own timers — it reconciles with the
backend on every page load (`syncWithBackend` in `src/extension/content.js`),
throttled by `SYNC_THROTTLE_MS`.

## Design Shift in V3

The day's problem is **not** produced by a scheduled job anymore. It's a
pure function of `(rating, date, problemPool)` computed on read — see
`src/backend/lib/dailyProblem.js`. That means:

- Two users at the same rating, on the same UTC day, always get the same
  problem. No "generate the feed at 05:00" race, no per-rating batch to
  backfill.
- A missed cron tick can't break today's feed. The worst thing a skipped
  run causes is a slightly stale pool until the next refresh lands.

So the only cron tasks that remain are **data-freshness** chores.

## Jobs

Registered by `src/backend/cron/scheduledJobs.js`, opt-in via
`ENABLE_CRON=true` in the loaded `.env`. Timezone defaults to UTC and can
be overridden with `CRON_TIMEZONE`.

| Job                       | Schedule (UTC)        | Purpose                                                                 |
| ------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `refresh-global-problems` | Sunday 05:11          | Pull new problems from the CF problemset API into the `problems` pool.  |
| `prune-submissions`       | Sunday 06:07          | Delete `submissions` docs older than 90 days to keep the collection small. |

Weekly is deliberate. The selector freezes each rating bucket's candidate
pool at the start of its ISO week, so any problem added during the week
wouldn't be eligible until the next Monday anyway — there's nothing a
more frequent refresh would buy.

## Manual Triggers (dev only)

Routes are mounted at `/test/cron` and gated on `NODE_ENV !== "production"`
in `src/backend/app.js`. They return `{ success, stats }` exactly like
the scheduler does — handy for smoke tests and migrations.

| Route                              | Method | What it does                                                 |
| ---------------------------------- | ------ | ------------------------------------------------------------ |
| `/test/cron/refresh-global-problems` | POST   | Pull the latest CF problems into the pool right now.         |
| `/test/cron/prune-submissions`       | POST   | Prune old submissions (body can override `cutoffISO`).       |

```bash
curl -X POST http://localhost:4000/test/cron/refresh-global-problems
curl -X POST http://localhost:4000/test/cron/prune-submissions
```

## Operational Notes

- **Idempotent**: both jobs are safe to run repeatedly. `refresh-global-problems`
  inserts only new `cfId`s and patches ratings on existing docs;
  `prune-submissions` is a bounded `deleteMany`.
- **Failure is local**: a throw inside a job is logged and the scheduler
  keeps running. There's no retry queue.
- **Single-instance**: `node-cron` runs in-process, so multi-instance
  deployments would double-schedule. If you ever scale horizontally, move
  these two jobs to an external scheduler (GCP Cloud Scheduler, k8s
  CronJob, etc.) and hit the same `/test/cron/*` handlers behind a
  shared-secret header.
