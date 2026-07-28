import { Redis } from "@upstash/redis";
import { checkAdmin, rejectUnauthorized } from "./_auth.js";

/*
 * Fish counts are the one thing the PUBLIC needs to write, so they can't
 * sit behind the admin token. That makes this endpoint the most exposed
 * surface on the site, so it's deliberately narrow:
 *
 * - It can only INCREMENT a counter by one. There's no way to set an
 *   arbitrary value, so nobody can zero out an artist's count or write
 *   junk data through it.
 * - Ids are validated against a strict pattern before being used in a
 *   key, so nobody can craft an id that reads or clobbers other keys.
 * - INCR is atomic, so two people tossing a fish at the same moment
 *   both count. (The old approach — rewriting one JSON blob of all
 *   counts — would have silently lost one of them.)
 *
 * Not solved here: someone scripting thousands of increments. Rate
 * limiting by IP would be the next step if that ever actually happens;
 * it's not worth the complexity before then, since the blast radius is
 * a wrong number next to a fish icon.
 */
const redis = Redis.fromEnv();
const PREFIX = "hg:fish:";
const VALID_ID = /^[A-Za-z0-9_-]{1,40}$/;

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const keys = await redis.keys(`${PREFIX}*`);
      if (!keys.length) return res.status(200).json({ fish: {} });

      const values = await redis.mget(...keys);
      const fish = {};
      keys.forEach((k, i) => {
        const n = Number(values[i]);
        if (!Number.isNaN(n)) fish[k.slice(PREFIX.length)] = n;
      });
      return res.status(200).json({ fish });
    }

    if (req.method === "POST") {
      const { id } = req.body || {};
      if (!id || typeof id !== "string" || !VALID_ID.test(id)) {
        return res.status(400).json({ error: "invalid id" });
      }
      const count = await redis.incr(`${PREFIX}${id}`);
      return res.status(200).json({ id, count });
    }

    // Wiping every count is destructive, so unlike incrementing it's
    // admin-only.
    if (req.method === "DELETE") {
      const auth = checkAdmin(req);
      if (!auth.ok) return rejectUnauthorized(res, auth);

      const keys = await redis.keys(`${PREFIX}*`);
      if (keys.length) await redis.del(...keys);
      return res.status(200).json({ cleared: keys.length });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("fish error", err);
    return res.status(500).json({ error: "fish error", message: err.message });
  }
}
