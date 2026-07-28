import { Redis } from "@upstash/redis";

/*
 * Backs window.storage.get/set/delete/list with Upstash Redis, connected
 * through Vercel's Marketplace integration (Vercel's own native "KV"
 * product was sunset in Dec 2024 — this is the current replacement).
 *
 * Redis.fromEnv() reads whichever env vars the integration set —
 * UPSTASH_REDIS_REST_URL/TOKEN for a fresh Marketplace install, or the
 * older KV_REST_API_URL/TOKEN names as a fallback — so this works
 * either way without extra configuration.
 *
 * There's no user-account system on this site, so the "shared" flag
 * from the original artifact API doesn't map to anything meaningful
 * server-side — everything here is one global namespace, which is
 * exactly what makes curator edits visible to every visitor instead of
 * stuck in one browser.
 *
 * All keys are prefixed so this database can be reused safely if you
 * ever point another project at the same store.
 */
const kv = Redis.fromEnv();
const NS = "hg:";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { action, key, prefix } = req.query;

      if (action === "list") {
        const keys = await kv.keys(`${NS}${prefix || ""}*`);
        return res.status(200).json({
          keys: keys.map((k) => k.slice(NS.length)),
          prefix: prefix || "",
        });
      }

      if (!key) return res.status(400).json({ error: "key is required" });
      const value = await kv.get(`${NS}${key}`);
      if (value === null || value === undefined) {
        return res.status(404).json({ error: "not found" });
      }
      return res.status(200).json({ key, value });
    }

    if (req.method === "POST") {
      const { op, key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: "key is required" });

      if (op === "delete") {
        const existed = (await kv.get(`${NS}${key}`)) !== null;
        await kv.del(`${NS}${key}`);
        return res.status(200).json({ key, deleted: existed });
      }

      await kv.set(`${NS}${key}`, value);
      return res.status(200).json({ key, value });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (err) {
    console.error("storage error", err);
    return res.status(500).json({
      error: "storage error",
      message: err.message,
      hint: "Is a KV database connected to this project under Storage in the Vercel dashboard?",
    });
  }
}
