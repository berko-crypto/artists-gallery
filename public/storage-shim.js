/*
 * Backs window.storage.get/set/delete/list with the /api/storage
 * serverless function (Vercel KV), so every visitor reads and writes
 * the same shared data instead of each browser only seeing its own.
 *
 * Falls back to localStorage if the API can't be reached -- e.g. running
 * `npm start` locally without `vercel dev`, or before a KV database has
 * been connected to the project yet. That keeps local UI work possible
 * even before the backend is wired up; it just won't be shared until it is.
 */
(function () {
  const LOCAL_PREFIX = "huddle-gallery::";

  // Held in memory only. Never written to localStorage, so it can't be
  // lifted off a shared machine after the fact.
  let adminToken = null;

  function authHeaders() {
    return adminToken ? { "x-admin-token": adminToken } : {};
  }

  // Thrown on 401/403 so callers can tell "you're not allowed" apart
  // from "the network is down". The difference matters: falling back to
  // localStorage on a rejected write would make a refused save look
  // like it succeeded until the next page load revealed otherwise.
  function authError(msg) {
    const e = new Error(msg || "not authorized");
    e.isAuthError = true;
    return e;
  }

  function lk(key, shared) {
    return LOCAL_PREFIX + (shared ? "shared::" : "local::") + key;
  }

  function localGet(key, shared) {
    const raw = window.localStorage.getItem(lk(key, shared));
    if (raw === null) throw new Error("not found");
    return { key, value: raw, shared };
  }
  function localSet(key, value, shared) {
    window.localStorage.setItem(lk(key, shared), value);
    return { key, value, shared };
  }
  function localDelete(key, shared) {
    const existed = window.localStorage.getItem(lk(key, shared)) !== null;
    window.localStorage.removeItem(lk(key, shared));
    return { key, deleted: existed, shared };
  }
  function localList(prefix, shared) {
    const p = lk(prefix, shared);
    const stripLen = (LOCAL_PREFIX + (shared ? "shared::" : "local::")).length;
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const full = window.localStorage.key(i);
      if (full && full.startsWith(p)) keys.push(full.slice(stripLen));
    }
    return { keys, prefix, shared };
  }

  // The API may hand back an already-parsed value (KV auto-deserializes
  // anything that looks like JSON). App.jsx always expects a string it
  // can JSON.parse itself, so normalize here rather than downstream.
  function asStringValue(v) {
    return typeof v === "string" ? v : JSON.stringify(v);
  }

  window.storage = {
    async get(key, shared = false) {
      try {
        const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`);
        if (r.status === 404) throw new Error("not found");
        if (!r.ok) throw new Error("storage request failed");
        const data = await r.json();
        return { key, value: asStringValue(data.value), shared };
      } catch (e) {
        return localGet(key, shared);
      }
    },

    async set(key, value, shared = false) {
      let denied = null;
      try {
        const r = await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ op: "set", key, value }),
        });
        if (r.status === 401 || r.status === 403 || r.status === 503) {
          const body = await r.json().catch(() => ({}));
          denied = authError(body.hint || body.error);
        } else if (!r.ok) {
          throw new Error("storage request failed");
        } else {
          const data = await r.json();
          return { key, value: asStringValue(data.value), shared };
        }
      } catch (e) {
        if (e.isAuthError) throw e;
        return localSet(key, value, shared);
      }
      if (denied) throw denied;
    },

    async delete(key, shared = false) {
      let denied = null;
      try {
        const r = await fetch("/api/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ op: "delete", key }),
        });
        if (r.status === 401 || r.status === 403 || r.status === 503) {
          const body = await r.json().catch(() => ({}));
          denied = authError(body.hint || body.error);
        } else if (!r.ok) {
          throw new Error("storage request failed");
        } else {
          const data = await r.json();
          return { key, deleted: !!data.deleted, shared };
        }
      } catch (e) {
        if (e.isAuthError) throw e;
        return localDelete(key, shared);
      }
      if (denied) throw denied;
    },

    // Called by the Curate panel once a token has been entered.
    setAdminToken(token) {
      adminToken = token || null;
    },

    hasAdminToken() {
      return !!adminToken;
    },

    // Checks a token against the server before trusting it, so a typo
    // surfaces immediately instead of at the first failed save.
    async verifyAdminToken(token) {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      if (r.ok) return { ok: true };
      const body = await r.json().catch(() => ({}));
      return { ok: false, error: body.hint || body.error || "That token wasn't accepted." };
    },

    async list(prefix = "", shared = false) {
      try {
        const r = await fetch(`/api/storage?action=list&prefix=${encodeURIComponent(prefix)}`);
        if (!r.ok) throw new Error("storage request failed");
        const data = await r.json();
        return { keys: data.keys || [], prefix, shared };
      } catch (e) {
        return localList(prefix, shared);
      }
    },
  };
})();
