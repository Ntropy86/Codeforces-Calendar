/**
 * Developer-only routes. Mounted at `/test` and gated on NODE_ENV
 * !== "production" in app.js — never reachable in production.
 *
 * Currently empty — the historical /submissions mock endpoint was
 * dropped in favour of hitting Codeforces directly from the client.
 * Kept as a stub so new dev-only endpoints have a landing spot.
 */
const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => res.status(200).json({ ok: true, env: process.env.NODE_ENV }));

module.exports = router;
