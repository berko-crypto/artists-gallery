import { checkAdmin, rejectUnauthorized } from "./_auth.js";

/*
 * Lets the Curate panel check a token the moment it's entered, instead
 * of accepting it optimistically and only discovering it's wrong when
 * the first save silently fails.
 *
 * Returns nothing sensitive either way — just whether it matched.
 */
export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const auth = checkAdmin(req);
  if (!auth.ok) return rejectUnauthorized(res, auth);

  return res.status(200).json({ ok: true });
}
