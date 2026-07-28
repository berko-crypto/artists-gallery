# Huddle Gallery

A community art showcase. Public to browse, locked to edit. Starts
empty -- add artists and art through the Curate panel once it's live.

## Deploy without touching a terminal

**1. Get the code onto GitHub**
1. Unzip this file on your computer (double-click / "Extract All").
2. github.com -> New repository -> name it -> Create.
3. On the empty repo page, click "uploading an existing file."
4. Drag the *contents* of the unzipped folder in. Commit.

**2. Import into Vercel**
1. vercel.com -> log in with GitHub -> Add New -> Project.
2. Pick the repo -> Import. Vercel reads `vercel.json` on its own.
3. Deploy.

## Then set these three things up (once)

### a. Redis -- stores config, picks, fish counts

Project -> Storage -> Marketplace -> **Upstash for Redis** -> Add
Integration -> connect it to this project.

Pick "Upstash for Redis" specifically, not the "Redis / Official Redis
for Vercel" listing -- the code uses `@upstash/redis`, which talks over
Upstash's REST API and expects Upstash's environment variables.
(Vercel's own native "KV" product was discontinued in Dec 2024, which
is why there's no KV button.)

### b. Blob -- stores uploaded artwork and avatars

Same Storage tab -> Create Database -> **Blob** -> connect to project.
Blob is still a first-party Vercel product; only KV went away.

### c. ADMIN_TOKEN -- the thing that makes editing private

Without this, nobody can save anything (writes fail closed on purpose,
rather than defaulting to wide open).

1. Generate a long random string. Any password generator works. Make it
   40-ish characters of letters and numbers -- e.g.
   `0UnGzpjYpMQ1W5LgHft93KzxQe7iUWAmd8c80BGh` (don't use that one, make
   your own). Avoid a memorable word: the check has no rate limiting
   behind it, so length is what protects you.
2. Project -> Settings -> Environment Variables -> Add.
   Name: `ADMIN_TOKEN`   Value: your string.
   Leave it applied to all environments.
3. Save.

### Finally: redeploy

Deployments tab -> "..." on the latest -> Redeploy. Connecting
integrations and adding env vars does NOT restart what's already
running, so this step is required for any of the above to take effect.

## How the permissions actually work

- **Anyone** can load the page, see the art, and toss fish.
- **Only someone with the token** can open the Curate panel and change
  anything, or upload files.
- The gate is enforced **server-side**, in `api/`. Hiding the Curate
  button alone would be meaningless -- anyone could call the API
  directly from browser devtools. So every write endpoint checks the
  token before doing anything.
- The token is compared with `timingSafeEqual`, not `===`, so it can't
  be guessed a character at a time by timing the responses.
- Your token is held in `sessionStorage` -- it survives a refresh while
  you're curating, and dies when you close the tab. There's a sign-out
  button in the panel header too.
- Fish counts are the one public write. That endpoint can *only*
  increment a counter by one: it can't set a value, and ids are
  pattern-validated so nobody can craft one that reaches other data.
  Increments are atomic, so simultaneous tosses don't overwrite each
  other.

Not covered: rate limiting. Someone determined could script thousands
of fish. Worth adding if it ever actually happens; the blast radius is
a wrong number next to a fish icon.

## Local dev

    npm install
    npm run build
    npm start       # :3000

`/api/*` doesn't exist under plain Express, so the storage layer falls
back to `localStorage` and uploads won't work. The Curate panel will
accept any token locally, since there's no server to check against and
nothing shared to protect. Test real auth against the deployed URL.
