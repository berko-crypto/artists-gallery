import crypto from "node:crypto";

/*
 * Verifies the shared admin token on write requests.
 *
 * Deliberate choices:
 * - Compared with timingSafeEqual rather than ===, so a wrong token
 *   can't be guessed a character at a time by measuring response times.
 * - If ADMIN_TOKEN isn't set on the server, writes are REJECTED rather
 *   than allowed. A misconfigured deploy should be locked, not wide open.
 * - Reads never call this. The gallery is meant to be public; only
 *   changes need gating.
 */
export function checkAdmin(req) {
  const expected = process.env.ADMIN_TOKEN;

  if (!expected) {
    return {
      ok: false,
      code: 503,
      error: "not configured",
      hint: "Set an ADMIN_TOKEN environment variable in the Vercel project, then redeploy.",
    };
  }

  const given = req.headers["x-admin-token"];
  if (!given || typeof given !== "string") {
    return { ok: false, code: 401, error: "admin token required" };
  }

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, code: 401, error: "invalid admin token" };
  }
  if (!crypto.timingSafeEqual(a, b)) {
    return { ok: false, code: 401, error: "invalid admin token" };
  }

  return { ok: true };
}

export function rejectUnauthorized(res, check) {
  return res.status(check.code).json(
    check.hint ? { error: check.error, hint: check.hint } : { error: check.error }
  );
}
