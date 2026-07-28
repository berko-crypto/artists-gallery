# Huddle Gallery

A community art showcase, backed by a shared database instead of each
visitor's own browser. Starts empty -- add artists and art through the
Curate panel once it's live.

## Deploy without touching a terminal

Everything below happens in a browser: GitHub's upload page and
Vercel's dashboard. No CLI, no install.

**1. Get the code onto GitHub**
1. Unzip this file on your computer -- just to get a folder, no
   commands needed (double-click it, or your OS's "Extract All").
2. Go to github.com -> New repository. Name it, leave everything
   else default, click Create.
3. On the empty repo's page, click "uploading an existing file."
4. Drag the *contents* of the unzipped folder in (src, public, api,
   README.md, package.json, vercel.json, build.mjs, server.js,
   railway.json, .gitignore -- everything except node_modules, which
   doesn't exist yet anyway). Commit.

**2. Import it into Vercel**
1. vercel.com -> log in with GitHub -> Add New -> Project.
2. Pick the repo you just created -> Import.
3. Vercel reads `vercel.json` on its own (build command, output
   folder). Don't change anything. Click Deploy.
4. A minute or two later you have a live `*.vercel.app` URL.

## Connect the shared storage (do this once, right after the first deploy)

The site ships with real backend code (`api/storage.js`,
`api/upload.js`) but needs two Vercel add-ons switched on before
curator edits become visible to everyone instead of just the browser
that made them. Both are in the dashboard, no keys to copy by hand:

1. Project -> Storage tab -> Create Database -> **KV** -> Connect to
   this project.
2. Same tab -> Create Database -> **Blob** -> Connect to this
   project.
3. Deployments tab -> "..." on the latest deploy -> Redeploy, so the
   new environment variables actually reach the running functions.

That's it. Open the live URL, click Curate, and start adding real
artists and real art -- uploads now go to Vercel Blob and picks/config
go to Vercel KV, so what you add is what everyone sees.

## If you ever do want to deploy from a terminal

    npm install -g vercel
    cd huddle-gallery
    vercel

Only needed if you want faster iteration later (redeploys in seconds
without a GitHub round-trip). Not required for the steps above.

## Local dev (optional, only if you want to preview changes yourself)

    npm install
    npm run build   # bundles src/ into dist/
    npm start       # serves dist/ on :3000 via Express

Locally, `/api/*` isn't wired up (that's Vercel-only routing), so
`public/storage-shim.js` falls back to `localStorage` automatically,
and uploads won't work until you're on the real deployed URL.

## What's in here right now

- **No seed data.** The artists list starts empty on purpose --
  everything gets added through the Curate panel once it's live.
- **Storage is shared**, not per-browser, once KV + Blob are connected.
  `api/storage.js` reads/writes KV; `public/storage-shim.js` calls it
  over `fetch` using the same `get/set/delete/list` shape the
  component was already written against.
- **Uploads go to Vercel Blob**, not a base64 string embedded in the
  config. `api/upload.js` returns a real hosted URL.
