/**
 * Tiny HTTP helpers for controllers — keeps the controller layer focused on
 * parameter validation and delegation, not boilerplate.
 */

/**
 * Wrap an async route handler so any throw becomes a tidy JSON error instead
 * of Express's default stack-trace page. Honors `err.statusCode` if set.
 */
function handle(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent && result !== undefined) res.json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      if (status >= 500) console.error(`[api] ${req.method} ${req.originalUrl}`, err);
      res.status(status).json({ error: err.message || "Internal error" });
    }
  };
}

/** Extract and trim a required string param from req. Throws 400 if missing. */
function required(value, name) {
  const v = typeof value === "string" ? value.trim() : value;
  if (v === undefined || v === null || v === "") {
    const err = new Error(`Missing required parameter: ${name}`);
    err.statusCode = 400;
    throw err;
  }
  return v;
}

/** Parse and validate a rating query param into a positive integer. */
function parseRating(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 4000) {
    const err = new Error(`Invalid rating: ${raw}`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

module.exports = { handle, required, parseRating };
