import { put } from "@vercel/blob";

/*
 * Accepts a raw image body (the browser already resized it before
 * sending) and stores it in Vercel Blob, returning a public URL.
 *
 * Body parsing is turned off so this works for any content type —
 * Vercel's default JSON/text parsing doesn't apply to image bytes.
 */
export const config = {
  api: { bodyParser: false },
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const MAX_BYTES = 5 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const buffer = await readBody(req);
    if (!buffer.length) return res.status(400).json({ error: "empty upload" });
    if (buffer.length > MAX_BYTES) {
      return res.status(413).json({ error: "file too large (5MB limit)" });
    }

    const rawName = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
    const safeName = (rawName || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    const contentType = req.headers["content-type"] || "application/octet-stream";

    const blob = await put(`huddle/${safeName}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("upload error", err);
    return res.status(500).json({
      error: "upload failed",
      message: err.message,
      hint: "Is Blob storage connected to this project under Storage in the Vercel dashboard?",
    });
  }
}
