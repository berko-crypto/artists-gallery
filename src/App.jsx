import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import {
  Settings2, X, Plus, Trash2, CopyPlus, ArrowUp, ArrowDown, Star,
  RotateCcw, ChevronDown, ChevronLeft, ChevronRight, Check, Shuffle,
  Maximize2, Palette, Sun, Moon, Fish, Dices, CircleUser, Square,
  Download, Upload, ClipboardCopy
} from "lucide-react";

/* ================================================================== */
/*  BRAND NOTES                                                        */
/*  Pudgy uses TT Trailers (heavy condensed caps) + Menco (rounded     */
/*  sans). Closest free stand-ins: Anton / Fredoka + Nunito.           */
/*  Devices borrowed from pudgypenguins.com + Pudgy Media:             */
/*  scrolling marquee, falling snow, chunky toy shadows, pill buttons, */
/*  "MVP of the week" spotlight, Huddle language.                      */
/* ================================================================== */

const FONT_SETS = {
  trailer: { label: "Trailer", display: "'Anton', Impact, sans-serif", body: "'Nunito', system-ui, sans-serif", caps: 1 },
  toybox: { label: "Toybox", display: "'Fredoka', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif", caps: 0 },
  arcade: { label: "Arcade", display: "'Space Grotesk', system-ui, sans-serif", body: "'Space Grotesk', system-ui, sans-serif", caps: 0 },
};

const ART_STYLES = ["sticker", "pixel", "ink", "glitch", "blob"];

/* Shapes a work can be hung at. "auto" measures a real uploaded image;
   the named ones drive layout before anything has loaded. */
const SHAPES = {
  auto: { label: "Auto (measure image)", ar: null },
  square: { label: "Square 1:1", ar: 1 },
  classic: { label: "Classic 4:3", ar: 1.3333 },
  landscape: { label: "Landscape 3:2", ar: 1.5 },
  wide: { label: "Wide 16:9", ar: 1.7778 },
  pano: { label: "Panorama 21:9", ar: 2.3333 },
  banner: { label: "Banner 3:1", ar: 3 },
  portrait: { label: "Portrait 2:3", ar: 0.6667 },
  tall: { label: "Tall 4:5", ar: 0.8 },
  story: { label: "Story 9:16", ar: 0.5625 },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const clone = (o) => JSON.parse(JSON.stringify(o));

const tweet = (url, text, date) => ({ id: uid(), url, text, date });

const piece = (title, year, style, palette, featured = false, shape = "square", src = "") => ({
  id: uid(), title, year, style, palette, featured, shape, src,
});

/* Resizes an upload client-side before it ever leaves the browser, so
   a 12MB phone photo doesn't get uploaded whole. Produces a Blob (for
   /api/upload) plus the true aspect ratio for the carousel layout. */
async function shrinkImage(file, max = 1100, quality = 0.82) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That file isn't an image we can read."));
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);

  const toBlob = (type) => new Promise((res) => c.toBlob(res, type, quality));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  return { blob, ar: w / h };
}

/* Sends a resized image to Vercel Blob via our own API route and
   returns the hosted URL. Throws with a message worth showing the
   curator directly if Blob storage isn't connected yet. */
async function uploadToBlob(blob, filename) {
  const safeName = (filename || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
  const r = await fetch(`/api/upload?name=${encodeURIComponent(safeName)}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.hint || body.error || "Upload failed.");
  }
  const data = await r.json();
  return data.url;
}

const DEFAULT = {
  site: {
    wordmark: "Huddle Gallery",
    marquee: "community art, hung properly · new work every friday · tag a curator to get hung · always warm in the huddle",
    eyebrow: "Community art, hung properly",
    title: "Made by the huddle",
    subtitle:
      "Every piece here was made by somebody in the community. Add yours through the curator panel.",
    carouselHeading: "This week's picks",
    gridHeading: "The artists",
    gridNote: "Sorted by nobody's favourite. Hit shake if you think we're playing favourites.",
    stripHeading: "The whole huddle",
    bandHeading: "Got a penguin on a canvas?",
    bandBody: "Post it in #fan-art and tag a curator. We hang new work every Friday, no follower count required.",
    bandCta: "Submit your work",
    footer: "Built with ♥ for the huddle. Every work belongs to whoever made it.",
    hangDay: 5,
    hangHour: 18,
    hangLabel: "Next hang",
  },
  theme: {
    sky: "#8FD9FF",
    snow: "#EFF9FF",
    card: "#FFFFFF",
    ink: "#0E2A5C",
    sun: "#FFC13C",
    bubblegum: "#FF7FB4",
    night: {
      sky: "#123A6E",
      snow: "#0A1B34",
      card: "#15305C",
      ink: "#DCEEFF",
      sun: "#FFC13C",
      bubblegum: "#FF7FB4",
    },
    radius: 28,
    depth: 8,
    snowfall: true,
    marqueeOn: true,
    fontSet: "trailer",
  },
  fun: {
    fish: true,
    waddler: true,
    nightToggle: true,
    countdown: true,
    tilt: true,
    spin: true,
    blizzard: true,
  },
  layout: {
    columns: 3,
    crop: "square",
    maxPicks: 5,
    hoverExpand: true,
    order: "curated",
    showHero: false,
    showCounts: false,
    showCarousel: true,
    showFilters: false,
    showShuffle: true,
    showGrid: true,
    showStrip: true,
    showBand: true,
    autoplay: true,
    autoplaySec: 6,
  },
  artists: [],
};

/* The carousel order is its own list, not a by-product of which stars
   happen to be lit. That's what makes reordering picks possible. */
DEFAULT.picks = DEFAULT.artists.flatMap((a) => a.pieces.filter((p) => p.featured).map((p) => p.id));

const STORE_KEY = "huddlegallery:v1";
const FISH_KEY = "huddlegallery:fish:v1";
const IMG_KEY = "huddlegallery:images:v1";
const AVATAR_KEY = "huddlegallery:avatars:v1";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ================================================================== */
/*  ARTWORK                                                            */
/* ================================================================== */

const PIXELS = [
  "....BBBB....", "...BBBBBB...", "..BBBBBBBB..", "..BBWBBWBB..",
  "..BBWBBWBB..", "..BBBOOBBB..", ".BBBWWWWBBB.", ".BBWWWWWWBB.",
  "BBBWWWWWWBBB", "BBBWWWWWWBBB", ".BBWWWWWWBB.", "..BBBWWBBB..",
  "...OO..OO...",
];

function Artwork({ palette, style, seed = 0, src, onMeasure }) {
  if (src) {
    return (
      <img
        className="hg-art hg-art-img"
        src={src}
        alt=""
        loading="lazy"
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w && h && onMeasure) onMeasure(w / h);
        }}
      />
    );
  }
  const [c1, c2, c3] = palette;
  const cream = "#FFFFFF";
  const beak = "#FFA51F";
  const gid = `ag${seed}`;

  const body = (
    <>
      <ellipse cx="50" cy="60" rx="27" ry="30" />
      <ellipse cx="50" cy="37" rx="21" ry="20" />
      <ellipse cx="21" cy="58" rx="7" ry="17" />
      <ellipse cx="79" cy="58" rx="7" ry="17" />
    </>
  );

  const face = (
    <>
      <ellipse cx="50" cy="64" rx="16" ry="23" fill={cream} />
      <ellipse cx="42" cy="36" rx="6.5" ry="7.5" fill={cream} />
      <ellipse cx="58" cy="36" rx="6.5" ry="7.5" fill={cream} />
      <circle cx="43.5" cy="37.5" r="2.6" fill="#0E1A2C" />
      <circle cx="56.5" cy="37.5" r="2.6" fill="#0E1A2C" />
      <path d="M50 42 L57 48 L43 48 Z" fill={beak} />
      <ellipse cx="40" cy="90" rx="8" ry="3.5" fill={beak} />
      <ellipse cx="60" cy="90" rx="8" ry="3.5" fill={beak} />
    </>
  );

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="hg-art" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${gid})`} />

      {style === "blob" && (
        <g>
          <circle cx={34 + (seed % 5)} cy="42" r="24" fill={c3} opacity="0.88" />
          <circle cx="66" cy={54 + (seed % 7)} r="27" fill={cream} opacity="0.45" />
          <circle cx="52" cy="70" r="20" fill={beak} opacity="0.8" />
          <circle cx="28" cy="74" r="13" fill={c3} opacity="0.55" />
          <circle cx="74" cy="26" r="9" fill={cream} opacity="0.7" />
        </g>
      )}

      {style === "pixel" &&
        PIXELS.map((row, y) =>
          row.split("").map((ch, x) => {
            if (ch === ".") return null;
            const fill = ch === "B" ? c3 : ch === "W" ? cream : beak;
            return <rect key={`${x}-${y}`} x={20 + x * 5} y={14 + y * 5} width="5" height="5" fill={fill} />;
          })
        )}

      {style === "ink" && (
        <g fill="none" stroke={c3} strokeWidth="2.4" strokeLinejoin="round">
          {body}
          <ellipse cx="50" cy="64" rx="16" ry="23" />
          <ellipse cx="42" cy="36" rx="6.5" ry="7.5" />
          <ellipse cx="58" cy="36" rx="6.5" ry="7.5" />
          <path d="M50 42 L57 48 L43 48 Z" />
          <g strokeWidth="1.1" opacity="0.45">
            <path d="M26 74 L40 60" /><path d="M30 80 L46 62" />
            <path d="M70 74 L58 62" /><path d="M74 80 L60 64" />
          </g>
        </g>
      )}

      {style === "glitch" && (
        <>
          <g fill="#00E5FF" opacity="0.6" transform="translate(-3,1)">{body}</g>
          <g fill={c3} opacity="0.6" transform="translate(3,-1)">{body}</g>
          <g fill={c3}>{body}</g>
          {face}
          <rect x="0" y="38" width="100" height="4" fill={cream} opacity="0.5" />
          <rect x="0" y="66" width="100" height="2" fill={beak} opacity="0.7" />
        </>
      )}

      {style === "sticker" && (
        <>
          <g fill="none" stroke={cream} strokeWidth="7" strokeLinejoin="round">{body}</g>
          <g fill={c3}>{body}</g>
          {face}
        </>
      )}
    </svg>
  );
}

/* ================================================================== */
/*  BITS                                                               */
/* ================================================================== */

function Snow({ on, blizzard }) {
  const n = blizzard ? 90 : 18;
  const flakes = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        left: `${(i * 5.7 + (i % 7) * 3.3) % 100}%`,
        size: 4 + ((i * 7) % 10),
        dur: (blizzard ? 2.4 : 11) + ((i * 3) % (blizzard ? 3 : 12)),
        delay: -((i * 1.7) % 14),
        op: 0.35 + ((i % 5) * 0.11),
      })),
    [n, blizzard]
  );
  if (!on && !blizzard) return null;
  return (
    <div className={`hg-snow ${blizzard ? "is-blizzard" : ""}`} aria-hidden="true">
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: f.left, width: f.size, height: f.size,
            animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, opacity: f.op,
          }}
        />
      ))}
    </div>
  );
}

/* the ambient penguin that waddles past every so often */
function Waddler({ on }) {
  if (!on) return null;
  return (
    <div className="hg-waddler" aria-hidden="true">
      <svg viewBox="0 0 40 44" width="40" height="44">
        <ellipse cx="20" cy="26" rx="13" ry="15" fill="var(--ink)" />
        <ellipse cx="20" cy="13" rx="10" ry="9.5" fill="var(--ink)" />
        <ellipse cx="20" cy="28" rx="7.5" ry="11" fill="var(--card)" />
        <circle cx="16.5" cy="12" r="1.8" fill="var(--card)" />
        <circle cx="23.5" cy="12" r="1.8" fill="var(--card)" />
        <path d="M20 15 L23.5 19 L16.5 19 Z" fill="var(--sun)" />
        <ellipse className="hg-foot-l" cx="15" cy="41" rx="5" ry="2.4" fill="var(--sun)" />
        <ellipse className="hg-foot-r" cx="25" cy="41" rx="5" ry="2.4" fill="var(--sun)" />
      </svg>
    </div>
  );
}

function useCountdown(day, hour) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const d = new Date(now);
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  let delta = (day - d.getDay() + 7) % 7;
  if (delta === 0 && target.getTime() <= now) delta = 7;
  target.setDate(target.getDate() + delta);
  const ms = target.getTime() - now;
  const days = Math.floor(ms / 86400000);
  const hrs = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

/* Falls back to a little mascot bust on the artist's own palette when
   nobody's uploaded a real avatar photo yet. */
function AvatarArt({ palette, seed = 0 }) {
  const [c1, c2] = palette;
  const gid = `avg${seed}`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="hg-avatar-art" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gid})`} />
      <g fill="#FFFFFF" opacity="0.94">
        <ellipse cx="50" cy="64" rx="30" ry="34" />
        <ellipse cx="50" cy="36" rx="23" ry="22" />
      </g>
      <g fill="var(--ink)">
        <ellipse cx="50" cy="66" rx="17" ry="24" />
        <ellipse cx="41" cy="35" rx="7" ry="8" />
        <ellipse cx="59" cy="35" rx="7" ry="8" />
      </g>
      <ellipse cx="50" cy="68" rx="12" ry="18" fill="#FFFFFF" />
      <circle cx="42.5" cy="36.5" r="2.8" fill="#0E1A2C" />
      <circle cx="57.5" cy="36.5" r="2.8" fill="#0E1A2C" />
      <path d="M50 42 L58 49 L42 49 Z" fill="#FFA51F" />
    </svg>
  );
}

const XLogo = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L5.9 22H2.8l7.5-8.6L2.4 2h6.6l4.5 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
  </svg>
);

/* A rendered post card rather than a live X embed: X's widget script
   is blocked in this sandbox, and this keeps the page working offline
   and off their tracker. Swap in react-tweet for production. */
function TweetCard({ artist, tw, compact }) {
  return (
    <a className={`hg-tweet ${compact ? "is-compact" : ""}`} href={tw.url} target="_blank" rel="noreferrer">
      <div className="hg-tweet-top">
        <span
          className="hg-tweet-avatar"
          style={{
            background: `linear-gradient(135deg, ${artist.pieces[0].palette[0]}, ${artist.pieces[0].palette[1]})`,
          }}
        >
          {artist.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <div className="hg-tweet-who">
          <b>{artist.name}</b>
          <span>@{artist.x || artist.handle}</span>
        </div>
        <XLogo size={14} />
      </div>
      <p className="hg-tweet-text">{tw.text}</p>
      <p className="hg-tweet-date">{tw.date}</p>
    </a>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="hg-field">
      <span className="hg-field-label">{label}</span>
      {children}
      {hint && <span className="hg-field-hint">{hint}</span>}
    </label>
  );
}

const TextIn = (p) => <input className="hg-input" type="text" {...p} />;
const AreaIn = (p) => <textarea className="hg-input hg-area" rows={3} {...p} />;

function SelectIn({ value, onChange, options }) {
  return (
    <div className="hg-select-wrap">
      <select className="hg-input hg-select" value={value} onChange={onChange}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="hg-select-icon" />
    </div>
  );
}

function ColorIn({ value, onChange }) {
  return (
    <div className="hg-color">
      <input type="color" value={value} onChange={onChange} aria-label="Colour" />
      <input className="hg-input hg-color-text" type="text" value={value} onChange={onChange} />
    </div>
  );
}

function RangeIn({ value, onChange, min, max, step = 1, suffix = "" }) {
  return (
    <div className="hg-range">
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} />
      <span className="hg-range-val">{value}{suffix}</span>
    </div>
  );
}

function Toggle({ on, onClick, label }) {
  return (
    <button type="button" className={`hg-toggle ${on ? "is-on" : ""}`} onClick={onClick}>
      <span className="hg-toggle-box">{on && <Check size={11} strokeWidth={3} />}</span>
      {label}
    </button>
  );
}

/* ================================================================== */
/*  MAIN                                                               */
/* ================================================================== */

export default function HuddleGallery() {
  const [cfg, setCfg] = useState(() => clone(DEFAULT));
  const [ready, setReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [tab, setTab] = useState("picks");
  const [openArtist, setOpenArtist] = useState(null);
  const [slide, setSlide] = useState(0);
  const [filter, setFilter] = useState("All");
  const [detail, setDetail] = useState(null);
  const [seed, setSeed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState("day");
  const [fish, setFish] = useState({});
  const [pops, setPops] = useState([]);
  const [blizzard, setBlizzard] = useState(false);
  const [toast, setToast] = useState(null);
  const [shake, setShake] = useState(false);
  const [pfp, setPfp] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [measured, setMeasured] = useState({});
  const [images, setImages] = useState({});
  const [avatars, setAvatars] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [importText, setImportText] = useState("");
  const [withImages, setWithImages] = useState(false);
  const [tx, setTx] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, dx: 0, moved: false });
  const logoClicks = useRef(0);
  const trackRef = useRef(null);
  const viewRef = useRef(null);
  const slideEls = useRef([]);

  /* ---- persistence ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await window.storage.get(STORE_KEY, false);
        const saved = r && r.value ? JSON.parse(r.value) : null;
        if (alive && saved && saved.artists) {
          setCfg({
            site: { ...DEFAULT.site, ...saved.site },
            theme: { ...DEFAULT.theme, ...saved.theme, night: { ...DEFAULT.theme.night, ...(saved.theme || {}).night } },
            layout: { ...DEFAULT.layout, ...saved.layout },
            fun: { ...DEFAULT.fun, ...saved.fun },
            picks:
              saved.picks ||
              saved.artists.flatMap((a) => (a.pieces || []).filter((p) => p.featured).map((p) => p.id)),
            artists: saved.artists,
          });
        }
      } catch (e) { /* first visit */ }
      finally { if (alive) setReady(true); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try { window.storage.set(STORE_KEY, JSON.stringify(cfg), false); } catch (e) {}
    }, 400);
    return () => clearTimeout(t);
  }, [cfg, ready]);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(FISH_KEY, false);
        if (r && r.value) setFish(JSON.parse(r.value));
      } catch (e) { /* nobody has tossed a fish yet */ }
      try {
        const r = await window.storage.get(IMG_KEY, false);
        if (r && r.value) setImages(JSON.parse(r.value));
      } catch (e) { /* no uploads yet */ }
      try {
        const r = await window.storage.get(AVATAR_KEY, false);
        if (r && r.value) setAvatars(JSON.parse(r.value));
      } catch (e) { /* no avatars yet */ }
    })();
  }, []);

  const say = (msg, ms = 2600) => {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  };

  const uploadImage = async (pieceId, file) => {
    if (!file) return;
    try {
      const { blob, ar } = await shrinkImage(file);
      const url = await uploadToBlob(blob, file.name);
      const next = { ...images, [pieceId]: url };
      setImages(next);
      setMeasured((m) => ({ ...m, [pieceId]: ar }));
      try { await window.storage.set(IMG_KEY, JSON.stringify(next), false); } catch (e) {}
      say("Uploaded.");
    } catch (err) {
      say(err.message || "That upload didn't work.");
    }
  };

  const removeImage = (pieceId) => {
    const next = { ...images };
    delete next[pieceId];
    setImages(next);
    setMeasured((m) => {
      const n = { ...m };
      delete n[pieceId];
      return n;
    });
    try { window.storage.set(IMG_KEY, JSON.stringify(next), false); } catch (e) {}
  };

  const srcOf = (p) => (p ? images[p.id] || p.src || "" : "");

  const uploadAvatar = async (artistId, file) => {
    if (!file) return;
    try {
      const { blob } = await shrinkImage(file, 500, 0.85);
      const url = await uploadToBlob(blob, file.name);
      const next = { ...avatars, [artistId]: url };
      setAvatars(next);
      try { await window.storage.set(AVATAR_KEY, JSON.stringify(next), false); } catch (e) {}
      say("Avatar uploaded.");
    } catch (err) {
      say(err.message || "That upload didn't work.");
    }
  };

  const removeAvatar = (artistId) => {
    const next = { ...avatars };
    delete next[artistId];
    setAvatars(next);
    try { window.storage.set(AVATAR_KEY, JSON.stringify(next), false); } catch (e) {}
  };

  const avatarOf = (a) => (a ? avatars[a.id] || "" : "");

  /* Opens the profile modal with a given work moved to the front, so
     clicking a specific thumbnail shows that piece rather than always
     whichever one happens to be first in the array. */
  const openProfile = (a, focusPieceId) => {
    if (!focusPieceId || a.pieces[0].id === focusPieceId) {
      setDetail(a);
      return;
    }
    const rest = a.pieces.filter((p) => p.id !== focusPieceId);
    const focus = a.pieces.find((p) => p.id === focusPieceId);
    setDetail({ ...a, pieces: [focus, ...rest] });
  };

  const setTweet = (aid, tid, key, value) =>
    setCfg((c) => ({
      ...c,
      artists: c.artists.map((a) =>
        a.id !== aid ? a : { ...a, tweets: (a.tweets || []).map((w) => (w.id === tid ? { ...w, [key]: value } : w)) }
      ),
    }));

  const addTweet = (aid) =>
    setCfg((c) => ({
      ...c,
      artists: c.artists.map((a) =>
        a.id !== aid ? a : { ...a, tweets: [...(a.tweets || []), tweet("https://x.com/", "Paste the post text here.", "Today")] }
      ),
    }));

  const delTweet = (aid, tid) =>
    setCfg((c) => ({
      ...c,
      artists: c.artists.map((a) =>
        a.id !== aid ? a : { ...a, tweets: (a.tweets || []).filter((w) => w.id !== tid) }
      ),
    }));

  const tossFish = (id, e) => {
    const next = { ...fish, [id]: (fish[id] || 0) + 1 };
    setFish(next);
    try { window.storage.set(FISH_KEY, JSON.stringify(next), false); } catch (err) {}
    const rect = e.currentTarget.getBoundingClientRect();
    const pid = uid();
    setPops((p) => [...p, { id: pid, x: rect.left + rect.width / 2, y: rect.top }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== pid)), 950);
  };

  const bumpLogo = () => {
    logoClicks.current += 1;
    if (logoClicks.current >= 5 && cfg.fun.blizzard) {
      logoClicks.current = 0;
      setBlizzard(true);
      setToast("❄ BLIZZARD ❄ everybody inside");
      setTimeout(() => setBlizzard(false), 9000);
      setTimeout(() => setToast(null), 3200);
    }
  };

  const shakeGlobe = () => {
    setSeed((s) => s + 1);
    setShake(true);
    setTimeout(() => setShake(false), 620);
  };

  const spinHuddle = () => {
    if (!live.length) return;
    const pick = live[Math.floor(Math.random() * live.length)];
    setDetail(pick);
  };

  const exportJson = (withImgs) =>
    JSON.stringify(withImgs ? { ...cfg, _images: images } : cfg, null, 2);

  const exportText = useMemo(
    () => JSON.stringify(withImages ? { ...cfg, _images: images, _avatars: avatars } : cfg, null, 2),
    [cfg, images, avatars, withImages]
  );

  const downloadJson = (withImages) => {
    try {
      const blob = new Blob([exportJson(withImages)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `huddle-gallery-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      say("Downloaded.");
    } catch (e) {
      say("Download blocked here — copy the text instead.");
    }
  };

  const copyJson = async (withImages) => {
    const text = exportJson(withImages);
    try {
      await navigator.clipboard.writeText(text);
      say(`Copied ${Math.round(text.length / 1024)}KB.`);
    } catch (e) {
      say("Clipboard blocked — select the text and copy.");
    }
  };

  const applyJson = (text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      say("That isn't valid JSON.");
      return;
    }
    if (!parsed || !Array.isArray(parsed.artists)) {
      say("No artists array in there — wrong file?");
      return;
    }
    const incoming = parsed._images;
    const incomingAvatars = parsed._avatars;
    delete parsed._images;
    delete parsed._avatars;
    setCfg({
      site: { ...DEFAULT.site, ...parsed.site },
      theme: { ...DEFAULT.theme, ...parsed.theme, night: { ...DEFAULT.theme.night, ...(parsed.theme || {}).night } },
      layout: { ...DEFAULT.layout, ...parsed.layout },
      fun: { ...DEFAULT.fun, ...parsed.fun },
      picks: parsed.picks || [],
      artists: parsed.artists,
    });
    if (incoming && typeof incoming === "object") {
      setImages(incoming);
      try { window.storage.set(IMG_KEY, JSON.stringify(incoming), false); } catch (e) {}
    }
    if (incomingAvatars && typeof incomingAvatars === "object") {
      setAvatars(incomingAvatars);
      try { window.storage.set(AVATAR_KEY, JSON.stringify(incomingAvatars), false); } catch (e) {}
    }
    setImportText("");
    say(`Loaded ${parsed.artists.length} collections.`);
  };

  const onTilt = (e) => {
    if (!cfg.fun.tilt || drag.current.active) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((e.clientY - r.top) / r.height - 0.5) * -9,
      y: ((e.clientX - r.left) / r.width - 0.5) * 9,
    });
  };

  /* Swipe. A carousel that ignores a thumb reads as broken. */
  const onDragStart = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { active: true, startX: e.clientX, dx: 0, moved: false };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const onDragMove = (e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.dx = dx;
    if (Math.abs(dx) > 8) drag.current.moved = true;
    setDragDx(dx);
  };

  const onDragEnd = () => {
    if (!drag.current.active) return;
    const { dx } = drag.current;
    drag.current.active = false;
    setDragging(false);
    setDragDx(0);
    if (dx < -45) go(1);
    else if (dx > 45) go(-1);
    /* let the click that follows a swipe die quietly */
    setTimeout(() => { drag.current.moved = false; }, 60);
  };

  const onCarouselKey = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };

  /* ---- setters ---- */
  const set = (path, value) =>
    setCfg((c) => {
      const n = clone(c);
      const [a, b] = path.split(".");
      n[a][b] = value;
      return n;
    });

  const setPal = (key, value) =>
    setCfg((c) => {
      const n = clone(c);
      if (mode === "night") n.theme.night[key] = value;
      else n.theme[key] = value;
      return n;
    });

  const setArtist = (id, key, value) =>
    setCfg((c) => ({ ...c, artists: c.artists.map((a) => (a.id === id ? { ...a, [key]: value } : a)) }));

  const setPiece = (aid, pid, key, value) =>
    setCfg((c) => ({
      ...c,
      artists: c.artists.map((a) =>
        a.id !== aid ? a : { ...a, pieces: a.pieces.map((p) => (p.id === pid ? { ...p, [key]: value } : p)) }
      ),
    }));

  const addPiece = (aid) =>
    setCfg((c) => ({
      ...c,
      artists: c.artists.map((a) =>
        a.id !== aid ? a : { ...a, pieces: [...a.pieces, piece("Untitled", "2026", "sticker", ["#8FD9FF", "#EFF9FF", "#0E2A5C"])] }
      ),
    }));

  const delPiece = (aid, pid) =>
    setCfg((c) => ({
      ...c,
      picks: (c.picks || []).filter((x) => x !== pid),
      artists: c.artists.map((a) =>
        a.id !== aid ? a : { ...a, pieces: a.pieces.length > 1 ? a.pieces.filter((p) => p.id !== pid) : a.pieces }
      ),
    }));

  const moveArtist = (i, dir) =>
    setCfg((c) => {
      const arr = [...c.artists];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, artists: arr };
    });

  const addArtist = () => {
    const id = uid();
    setCfg((c) => ({
      ...c,
      artists: [...c.artists, {
        id, name: "New artist", handle: "handle", x: "handle",
        blurb: "One line about what they make.",
        tags: ["Medium"], commissions: false, shown: true,
        pieces: [piece("Untitled", "2026", "sticker", ["#8FD9FF", "#EFF9FF", "#0E2A5C"], true)],
      }],
    }));
    setOpenArtist(id);
    setTab("artists");
  };

  const dupArtist = (a) => {
    const id = uid();
    const copy = clone(a);
    copy.id = id;
    copy.name = a.name + " (copy)";
    copy.pieces = copy.pieces.map((p) => ({ ...p, id: uid() }));
    setCfg((c) => ({ ...c, artists: [...c.artists, copy] }));
    setOpenArtist(id);
  };

  const delArtist = (id) =>
    setCfg((c) => {
      const gone = (c.artists.find((a) => a.id === id) || { pieces: [] }).pieces.map((p) => p.id);
      return {
        ...c,
        picks: (c.picks || []).filter((x) => !gone.includes(x)),
        artists: c.artists.filter((a) => a.id !== id),
      };
    });

  /* ---- derived ---- */
  const t = cfg.theme;
  const L = cfg.layout;
  const fonts = FONT_SETS[t.fontSet] || FONT_SETS.trailer;
  const live = cfg.artists.filter((a) => a.shown && a.pieces.length);

  const allWorks = useMemo(() => {
    const out = [];
    cfg.artists.forEach((a) => a.pieces.forEach((p) => out.push({ artist: a, p })));
    return out;
  }, [cfg.artists]);

  const pickList = useMemo(
    () => (cfg.picks || []).map((id) => allWorks.find((w) => w.p.id === id)).filter(Boolean),
    [cfg.picks, allWorks]
  );

  const cap = Math.max(1, cfg.layout.maxPicks || 5);
  const visiblePicks = pickList.filter((w) => w.artist.shown);
  const overCap = Math.max(0, visiblePicks.length - cap);
  const autoFilled = visiblePicks.length === 0;

  const highlights = useMemo(() => {
    if (visiblePicks.length) return visiblePicks.slice(0, cap);
    return live.slice(0, cap).map((a) => ({ artist: a, p: a.pieces[0] }));
  }, [visiblePicks, live, cap]);

  const isPicked = (id) => (cfg.picks || []).includes(id);

  const togglePick = (id) =>
    setCfg((c) => {
      const cur = c.picks || [];
      return { ...c, picks: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });

  const movePick = (i, dir) =>
    setCfg((c) => {
      const arr = [...(c.picks || [])];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, picks: arr };
    });

  const fillPicks = () =>
    setCfg((c) => {
      const cur = [...(c.picks || [])];
      const pool = [];
      c.artists.forEach((a) => a.shown && a.pieces.forEach((p) => !cur.includes(p.id) && pool.push(p.id)));
      while (cur.length < cap && pool.length) {
        cur.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      return { ...c, picks: cur };
    });

  const allTags = useMemo(() => {
    const s = new Set();
    live.forEach((a) => a.tags.forEach((x) => s.add(x)));
    return ["All", ...Array.from(s).sort()];
  }, [live]);

  const roster = useMemo(() => {
    let list = live.filter((a) => filter === "All" || !L.showFilters || a.tags.includes(filter));
    if (L.order === "alpha") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (L.order === "shuffle" || seed > 0) {
      list = [...list].sort(
        (a, b) =>
          ((a.id + seed).split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) % 97) -
          ((b.id + seed).split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) % 97)
      );
    }
    return list;
  }, [live, filter, L.order, L.showFilters, seed]);

  useEffect(() => {
    if (slide > highlights.length - 1) setSlide(0);
  }, [highlights.length, slide]);

  const go = useCallback((d) => {
    setSlide((s) => (highlights.length ? (s + d + highlights.length) % highlights.length : 0));
  }, [highlights.length]);

  useEffect(() => {
    if (!L.autoplay || paused || detail || adminOpen || highlights.length < 2) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => go(1), Math.max(2, L.autoplaySec) * 1000);
    return () => clearInterval(id);
  }, [L.autoplay, L.autoplaySec, paused, detail, adminOpen, highlights.length, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setDetail(null); setAdminOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pal = mode === "night" ? { ...t, ...(t.night || {}) } : t;
  const countdown = useCountdown(cfg.site.hangDay, cfg.site.hangHour);

  /* A work's aspect ratio: a measured upload wins, then the chosen shape,
     then square. This is what lets a landscape sit next to a portrait. */
  const arOf = (p) => {
    if (!p) return 1;
    if (measured[p.id]) return measured[p.id];
    const s = SHAPES[p.shape || "square"];
    return (s && s.ar) || 1;
  };

  const measure = (id, ar) =>
    setMeasured((m) => (Math.abs((m[id] || 0) - ar) < 0.01 ? m : { ...m, [id]: ar }));

  /* Slides are different widths now, so centring has to be measured
     rather than multiplied out from a fixed slide width. */
  useLayoutEffect(() => {
    const recentre = () => {
      const vp = viewRef.current;
      const track = trackRef.current;
      const el = slideEls.current[slide];
      if (!vp || !track || !el) return;
      const tRect = track.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const centreInTrack = eRect.left - tRect.left + eRect.width / 2;
      setTx(vp.clientWidth / 2 - centreInTrack);
    };
    recentre();
    const late = setTimeout(recentre, 160);
    window.addEventListener("resize", recentre);
    return () => {
      clearTimeout(late);
      window.removeEventListener("resize", recentre);
    };
  }, [slide, highlights, measured, cfg.theme.radius, cfg.layout.showCarousel, cfg.theme.fontSet]);

  const vars = {
    "--sky": pal.sky, "--snow": pal.snow, "--card": pal.card, "--ink": pal.ink,
    "--sun": pal.sun, "--gum": pal.bubblegum,
    "--r": `${t.radius}px`, "--depth": `${t.depth}px`,
    "--cols": L.columns, "--fd": fonts.display, "--fb": fonts.body,
    "--dcase": fonts.caps ? "uppercase" : "none",
    "--dsp": fonts.caps ? "0.005em" : "-0.02em",
  };

  const initials = (n) => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className={`hg-root ${mode === "night" ? "is-night" : ""} ${shake ? "is-shaking" : ""} ${L.showHero ? "" : "no-hero"}`} style={vars}>
      <style>{CSS}</style>
      <Snow on={t.snowfall} blizzard={blizzard} />
      <Waddler on={cfg.fun.waddler} />

      {toast && <div className="hg-toast">{toast}</div>}

      {pops.map((p) => (
        <span key={p.id} className="hg-fishpop" style={{ left: p.x, top: p.y }} aria-hidden="true">🐟</span>
      ))}

      {/* NAV */}
      <header className="hg-nav">
        <button type="button" className="hg-wordmark" onClick={bumpLogo} title="Do not click me five times">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <ellipse cx="12" cy="14.5" rx="7.5" ry="8" fill="var(--ink)" />
            <ellipse cx="12" cy="8" rx="5.8" ry="5.4" fill="var(--ink)" />
            <ellipse cx="12" cy="15.5" rx="4.2" ry="6" fill="#fff" />
            <circle cx="10" cy="7.6" r="1" fill="#fff" />
            <circle cx="14" cy="7.6" r="1" fill="#fff" />
            <path d="M12 9.2 L13.8 11.6 L10.2 11.6 Z" fill="var(--sun)" />
          </svg>
          {cfg.site.wordmark}
        </button>
        <nav className="hg-nav-links">
          <a href="#artists">Artists</a>
          <a href="#submit">Submit</a>
          {cfg.fun.nightToggle && (
            <button
              type="button"
              className="hg-round hg-round-sm"
              onClick={() => setMode(mode === "day" ? "night" : "day")}
              aria-label={mode === "day" ? "Switch to night" : "Switch to day"}
            >
              {mode === "day" ? <Moon size={15} strokeWidth={2.6} /> : <Sun size={15} strokeWidth={2.6} />}
            </button>
          )}
          <button type="button" className="hg-btn hg-btn-ghost" onClick={() => setAdminOpen(true)}>
            <Settings2 size={14} /> Curate
          </button>
        </nav>
      </header>

      {/* MARQUEE */}
      {t.marqueeOn && (
        <div className="hg-marquee" aria-hidden="true">
          <div className="hg-marquee-track">
            {[0, 1, 2, 3].map((k) => <span key={k}>{cfg.site.marquee} ❆ </span>)}
          </div>
        </div>
      )}

      {/* HERO */}
      {L.showHero && (
        <section className="hg-hero">
          <p className="hg-eyebrow">{cfg.site.eyebrow}</p>
          <h1 className="hg-h1">{cfg.site.title}</h1>
          <p className="hg-sub">{cfg.site.subtitle}</p>
          {L.showCounts && (
            <div className="hg-counts">
              <span><b>{live.length}</b> artists</span>
              <span><b>{live.reduce((n, a) => n + a.pieces.length, 0)}</b> works</span>
              <span className={live.some((a) => a.needsCredit) ? "hg-count-warn" : ""}>
                <b>{live.filter((a) => a.needsCredit).reduce((n, a) => n + a.pieces.length, 0)}</b> need credit
              </span>
              {cfg.fun.fish && (
                <span><b>{Object.values(fish).reduce((n, v) => n + v, 0)}</b> fish tossed</span>
              )}
              {cfg.fun.countdown && (
                <span className="hg-count-live">
                  <i className="hg-blip" /> {cfg.site.hangLabel} in <b>{countdown}</b>
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* CAROUSEL */}
      {L.showCarousel && highlights.length > 0 && (
        <section
          className="hg-carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="hg-carousel-head">
            <h2 className="hg-h2">{cfg.site.carouselHeading}</h2>
            <div className="hg-carousel-nav">
              <button type="button" className="hg-round" onClick={() => go(-1)} aria-label="Previous work">
                <ChevronLeft size={18} strokeWidth={2.6} />
              </button>
              <button type="button" className="hg-round" onClick={() => go(1)} aria-label="Next work">
                <ChevronRight size={18} strokeWidth={2.6} />
              </button>
            </div>
          </div>

          <div
            className="hg-viewport"
            ref={viewRef}
            tabIndex={0}
            role="group"
            aria-roledescription="carousel"
            aria-label={`${cfg.site.carouselHeading} — ${highlights.length} works`}
            onKeyDown={onCarouselKey}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div
              className={`hg-track ${dragging ? "is-dragging" : ""}`}
              ref={trackRef}
              style={{ transform: `translateX(${tx + dragDx}px)` }}
            >
              {highlights.map((h, i) => (
                <article
                  key={h.p.id}
                  ref={(el) => { slideEls.current[i] = el; }}
                  className={`hg-slide ${i === slide ? "is-active" : ""} ${i % 2 ? "tilt-b" : "tilt-a"}`}
                  aria-hidden={i !== slide}
                  onMouseMove={i === slide ? onTilt : undefined}
                  onMouseLeave={() => setTilt({ x: 0, y: 0 })}
                  style={{
                    "--ar": arOf(h.p),
                    ...(i === slide && cfg.fun.tilt
                      ? { "--rx": `${tilt.x}deg`, "--ry": `${tilt.y}deg` }
                      : {}),
                  }}
                >
                  <button
                    type="button"
                    className="hg-slide-art"
                    onClick={() => {
                      if (drag.current.moved) return;
                      if (i === slide) setDetail(h.artist);
                      else setSlide(i);
                    }}
                  >
                    <Artwork
                      palette={h.p.palette}
                      style={h.p.style}
                      seed={i + 3}
                      src={srcOf(h.p)}
                      onMeasure={(ar) => measure(h.p.id, ar)}
                    />
                  </button>
                  <div className="hg-slide-bar">
                    <div className="hg-slide-meta">
                      <p className="hg-slide-title">{h.p.title}</p>
                      <p className="hg-slide-by">
                        {h.artist.name} <span>@{h.artist.handle}</span> · {h.p.year}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="hg-btn hg-btn-sun"
                      onClick={() => setDetail(h.artist)}
                      tabIndex={i === slide ? 0 : -1}
                    >
                      <Maximize2 size={13} /> Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="hg-dots">
            {highlights.map((h, i) => (
              <button
                key={h.p.id}
                type="button"
                className={`hg-dot ${i === slide ? "is-on" : ""}`}
                onClick={() => setSlide(i)}
                aria-label={`Show ${h.p.title}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* ARTIST GRID */}
      {L.showGrid && (
        <section className="hg-section" id="artists">
          <div className="hg-section-head">
            <div>
              <h2 className="hg-h2">{cfg.site.gridHeading}</h2>
              <p className="hg-note">{cfg.site.gridNote}</p>
            </div>
            <div className="hg-head-actions">
              {cfg.fun.spin && (
                <button type="button" className="hg-btn hg-btn-sun" onClick={spinHuddle}>
                  <Dices size={14} /> Surprise me
                </button>
              )}
              {L.showShuffle && (
                <button type="button" className="hg-btn hg-btn-ink" onClick={shakeGlobe}>
                  <Shuffle size={14} /> Shake the globe
                </button>
              )}
            </div>
          </div>

          {L.showFilters && (
            <div className="hg-filters">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`hg-chip ${filter === tag ? "is-on" : ""}`}
                  onClick={() => setFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {roster.length === 0 ? (
            <p className="hg-empty">
              Nobody here yet. Open Curate and add an artist, or clear the filter.
            </p>
          ) : (
            <div className={`hg-grid ${L.crop === "natural" ? "is-pinboard" : ""}`}>
              {roster.map((a, i) => {
                const shownWorks = a.pieces.slice(0, 3);
                const moreCount = a.pieces.length - shownWorks.length;
                return (
                  <article
                    key={a.id}
                    className={`hg-card ${expanded === a.id ? "is-open" : ""}`}
                    style={{ "--ar": arOf(a.pieces[0]) }}
                    onMouseEnter={() => L.hoverExpand && setExpanded(a.id)}
                    onMouseLeave={() => L.hoverExpand && setExpanded((e) => (e === a.id ? null : e))}
                  >
                    <button type="button" className="hg-avatar" onClick={() => openProfile(a)}>
                      {avatarOf(a) ? (
                        <img className="hg-avatar-img" src={avatarOf(a)} alt="" />
                      ) : (
                        <AvatarArt palette={a.pieces[0].palette} seed={i + 40} />
                      )}
                      {a.commissions && <span className="hg-badge">Open for commissions</span>}
                      {a.needsCredit && <span className="hg-badge hg-badge-warn">Needs credit</span>}
                    </button>

                    <div className="hg-card-body">
                      <a
                        className="hg-card-name"
                        href={`https://x.com/${a.x || a.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        title={`@${a.x || a.handle} on X`}
                      >
                        {a.name}
                        <XLogo size={13} />
                      </a>
                      <button
                        type="button"
                        className="hg-chev"
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        aria-expanded={expanded === a.id}
                        aria-label={`${expanded === a.id ? "Hide" : "Show"} details for ${a.name}`}
                      >
                        <ChevronDown size={16} strokeWidth={3} />
                      </button>
                    </div>

                    <div className="hg-workstrip">
                      {shownWorks.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="hg-workslot"
                          onClick={() => openProfile(a, p.id)}
                          title={p.title}
                        >
                          <Artwork
                            palette={p.palette}
                            style={p.style}
                            seed={i + 60}
                            src={srcOf(p)}
                            onMeasure={(ar) => measure(p.id, ar)}
                          />
                        </button>
                      ))}
                      {moreCount > 0 && (
                        <button type="button" className="hg-workslot hg-workslot-more" onClick={() => openProfile(a)}>
                          +{moreCount}
                        </button>
                      )}
                    </div>

                    {/* the bit that drops down on hover, or on tap where there's no pointer */}
                    <div className="hg-drawer">
                      <div className="hg-drawer-inner">
                        <p className="hg-drawer-blurb">{a.blurb}</p>
                        <div className="hg-card-tags">
                          {a.tags.map((tag) => <span key={tag} className="hg-tag">{tag}</span>)}
                        </div>
                        {(a.tweets || []).length > 0 ? (
                          <>
                            <p className="hg-drawer-label">Latest from @{a.x || a.handle}</p>
                            {(a.tweets || []).slice(0, 1).map((tw) => (
                              <TweetCard key={tw.id} artist={a} tw={tw} compact />
                            ))}
                          </>
                        ) : (
                          <p className="hg-drawer-label">No posts linked yet.</p>
                        )}
                        <div className="hg-drawer-foot">
                          {cfg.fun.fish && (
                            <button
                              type="button"
                              className={`hg-fish ${fish[a.id] ? "is-fed" : ""}`}
                              onClick={(e) => tossFish(a.id, e)}
                              title="Toss a fish"
                            >
                              <Fish size={14} /> {fish[a.id] || 0}
                            </button>
                          )}
                          <button type="button" className="hg-btn hg-btn-sun hg-btn-sm" onClick={() => openProfile(a)}>
                            Open full profile
                          </button>
                          {(a.tweets || []).length > 1 && (
                            <span className="hg-drawer-more">+{a.tweets.length - 1} more</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* HUDDLE STRIP */}
      {L.showStrip && live.length > 0 && (
        <section className="hg-section hg-strip-wrap">
          <h2 className="hg-h3">{cfg.site.stripHeading}</h2>
          <div className="hg-strip">
            {live.map((a) => (
              <button
                key={a.id}
                type="button"
                className="hg-pip"
                onClick={() => setDetail(a)}
                title={a.name}
                style={{
                  background: `linear-gradient(135deg, ${a.pieces[0].palette[0]}, ${a.pieces[0].palette[1]})`,
                }}
              >
                {initials(a.name)}
              </button>
            ))}
            <span className="hg-pip hg-pip-you">+ you</span>
          </div>
        </section>
      )}

      {/* BAND */}
      {L.showBand && (
        <section className="hg-band" id="submit">
          <div>
            <h2 className="hg-band-h">{cfg.site.bandHeading}</h2>
            <p className="hg-band-b">{cfg.site.bandBody}</p>
          </div>
          <button type="button" className="hg-btn hg-btn-ink hg-btn-lg">{cfg.site.bandCta}</button>
        </section>
      )}

      <footer className="hg-footer">{cfg.site.footer}</footer>

      {/* DETAIL MODAL */}
      {detail && (
        <div className="hg-modal-scrim" onClick={() => setDetail(null)}>
          <div className="hg-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="hg-modal-x" onClick={() => setDetail(null)} aria-label="Close">
              <X size={18} strokeWidth={2.6} />
            </button>
            <div className="hg-modal-grid">
              <div>
                <div className={`hg-modal-art ${pfp ? "is-pfp" : ""}`} style={{ "--ar": arOf(detail.pieces[0]) }}>
                  <Artwork
                    palette={detail.pieces[0].palette}
                    style={detail.pieces[0].style}
                    seed={7}
                    src={srcOf(detail.pieces[0])}
                    onMeasure={(ar) => measure(detail.pieces[0].id, ar)}
                  />
                </div>
                <button type="button" className="hg-pfp-btn" onClick={() => setPfp(!pfp)}>
                  {pfp ? <Square size={13} /> : <CircleUser size={13} />}
                  {pfp ? "Back to square" : "Try it as a PFP"}
                </button>
              </div>
              <div>
                {detail.commissions && <span className="hg-badge hg-badge-static">Open for commissions</span>}
                {detail.needsCredit && <span className="hg-badge hg-badge-static hg-badge-warn">Needs credit</span>}
                <h3 className="hg-modal-name">{detail.name}</h3>
                <p className="hg-modal-handle">@{detail.handle}</p>
                <p className="hg-modal-blurb">{detail.blurb}</p>
                <div className="hg-card-tags">
                  {detail.tags.map((tag) => <span key={tag} className="hg-tag">{tag}</span>)}
                </div>
                <p className="hg-modal-label">Works</p>
                <ul className="hg-works">
                  {detail.pieces.map((p) => (
                    <li key={p.id}>
                      <span className="hg-work-swatch" style={{ background: p.palette[0] }} />
                      <span className="hg-work-title">{p.title}</span>
                      <span className="hg-work-year">{p.year}</span>
                    </li>
                  ))}
                </ul>
                {(detail.tweets || []).length > 0 && (
                  <>
                    <p className="hg-modal-label">From X</p>
                    <div className="hg-tweets">
                      {detail.tweets.map((tw) => (
                        <TweetCard key={tw.id} artist={detail} tw={tw} />
                      ))}
                    </div>
                  </>
                )}
                <a
                  className="hg-btn hg-btn-ink"
                  href={`https://x.com/${detail.x || detail.handle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Follow on X
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN */}
      {adminOpen && <div className="hg-scrim" onClick={() => setAdminOpen(false)} />}
      <aside className={`hg-admin ${adminOpen ? "is-open" : ""}`} aria-hidden={!adminOpen}>
        <div className="hg-admin-top">
          <div>
            <p className="hg-admin-kicker">Curator</p>
            <p className="hg-admin-title">Everything on this page</p>
          </div>
          <button type="button" className="hg-icon-btn" onClick={() => setAdminOpen(false)} aria-label="Close curator panel">
            <X size={16} />
          </button>
        </div>

        <div className="hg-tabs">
          {["picks", "content", "look", "layout", "artists"].map((k) => (
            <button key={k} type="button" className={`hg-tab ${tab === k ? "is-active" : ""}`} onClick={() => setTab(k)}>
              {k}
            </button>
          ))}
        </div>

        <div className="hg-admin-body">
          {tab === "picks" && (
            <>
              <div className="hg-slots">
                <span className={overCap ? "is-over" : ""}>
                  {visiblePicks.length} of {cap} slots
                </span>
                {overCap > 0 && <span className="hg-slots-note">{overCap} queued</span>}
                {autoFilled && <span className="hg-slots-note">auto</span>}
              </div>
              {autoFilled && (
                <p className="hg-field-hint" style={{ marginBottom: 12 }}>
                  Nothing picked, so the carousel is showing the first {cap} works. Add one below to take over.
                </p>
              )}

              {pickList.map((w, i) => {
                const over = i >= cap || !w.artist.shown;
                return (
                  <div key={w.p.id} className={`hg-pick ${over ? "is-over" : ""}`}>
                    <span className="hg-pick-n">{over ? "—" : i + 1}</span>
                    <span
                      className="hg-pick-thumb"
                      style={{
                        backgroundImage: srcOf(w.p) ? `url(${srcOf(w.p)})` : "none",
                        background: srcOf(w.p)
                          ? undefined
                          : `linear-gradient(135deg, ${w.p.palette[0]}, ${w.p.palette[1]})`,
                      }}
                    />
                    <span className="hg-pick-meta">
                      <b>{w.p.title}</b>
                      <em>
                        {w.artist.name}
                        {!w.artist.shown && " · hidden"}
                        {over && w.artist.shown && " · over the limit"}
                      </em>
                    </span>
                    <span className="hg-pick-tools">
                      <button type="button" onClick={() => movePick(i, -1)} aria-label="Move up"><ArrowUp size={12} /></button>
                      <button type="button" onClick={() => movePick(i, 1)} aria-label="Move down"><ArrowDown size={12} /></button>
                      <button type="button" onClick={() => togglePick(w.p.id)} aria-label="Remove pick"><X size={12} /></button>
                    </span>
                  </div>
                );
              })}

              <p className="hg-group-label">Add a work</p>
              <div className="hg-select-wrap">
                <select
                  className="hg-input hg-select"
                  value=""
                  onChange={(e) => e.target.value && togglePick(e.target.value)}
                >
                  <option value="">Pick from the collections…</option>
                  {cfg.artists.map((a) => {
                    const free = a.pieces.filter((p) => !isPicked(p.id));
                    if (!free.length) return null;
                    return (
                      <optgroup key={a.id} label={a.name}>
                        {free.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <ChevronDown size={13} className="hg-select-icon" />
              </div>

              <div className="hg-pick-actions">
                <button type="button" className="hg-add hg-add-sm" onClick={fillPicks} style={{ margin: 0 }}>
                  <Dices size={12} /> Fill empty slots
                </button>
                <button
                  type="button"
                  className="hg-danger"
                  onClick={() => setCfg((c) => ({ ...c, picks: [] }))}
                >
                  Clear
                </button>
              </div>

              <div className="hg-divider" />
              <Field label="Slots" hint="How many works the carousel shows.">
                <RangeIn value={cfg.layout.maxPicks} min={3} max={8}
                  onChange={(e) => set("layout.maxPicks", Number(e.target.value))} />
              </Field>
              <Field label="Carousel heading">
                <TextIn value={cfg.site.carouselHeading} onChange={(e) => set("site.carouselHeading", e.target.value)} />
              </Field>
              <Toggle on={L.autoplay} label="Auto-advance" onClick={() => set("layout.autoplay", !L.autoplay)} />
              <Field label="Seconds per slide">
                <RangeIn value={L.autoplaySec} min={2} max={14} suffix="s"
                  onChange={(e) => set("layout.autoplaySec", Number(e.target.value))} />
              </Field>
            </>
          )}
          {tab === "content" && (
            <>
              <Field label="Wordmark"><TextIn value={cfg.site.wordmark} onChange={(e) => set("site.wordmark", e.target.value)} /></Field>
              <Field label="Marquee text" hint="Repeats across the ticker."><AreaIn value={cfg.site.marquee} onChange={(e) => set("site.marquee", e.target.value)} /></Field>
              <Field label="Eyebrow"><TextIn value={cfg.site.eyebrow} onChange={(e) => set("site.eyebrow", e.target.value)} /></Field>
              <Field label="Headline"><TextIn value={cfg.site.title} onChange={(e) => set("site.title", e.target.value)} /></Field>
              <Field label="Subtitle"><AreaIn value={cfg.site.subtitle} onChange={(e) => set("site.subtitle", e.target.value)} /></Field>
              <div className="hg-divider" />
              <Field label="Carousel heading"><TextIn value={cfg.site.carouselHeading} onChange={(e) => set("site.carouselHeading", e.target.value)} /></Field>
              <Field label="Artists heading"><TextIn value={cfg.site.gridHeading} onChange={(e) => set("site.gridHeading", e.target.value)} /></Field>
              <Field label="Artists note"><AreaIn value={cfg.site.gridNote} onChange={(e) => set("site.gridNote", e.target.value)} /></Field>
              <Field label="Huddle strip heading"><TextIn value={cfg.site.stripHeading} onChange={(e) => set("site.stripHeading", e.target.value)} /></Field>
              <div className="hg-divider" />
              <Field label="Submit heading"><TextIn value={cfg.site.bandHeading} onChange={(e) => set("site.bandHeading", e.target.value)} /></Field>
              <Field label="Submit body"><AreaIn value={cfg.site.bandBody} onChange={(e) => set("site.bandBody", e.target.value)} /></Field>
              <Field label="Button label"><TextIn value={cfg.site.bandCta} onChange={(e) => set("site.bandCta", e.target.value)} /></Field>
              <Field label="Footer"><TextIn value={cfg.site.footer} onChange={(e) => set("site.footer", e.target.value)} /></Field>
            </>
          )}

          {tab === "look" && (
            <>
              <div className="hg-modeswitch">
                {["day", "night"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={mode === m ? "is-on" : ""}
                    onClick={() => setMode(m)}
                  >
                    {m === "day" ? <Sun size={13} /> : <Moon size={13} />} {m}
                  </button>
                ))}
              </div>
              <p className="hg-field-hint" style={{ marginBottom: 14 }}>
                Editing the {mode} palette. Flip the switch to paint the other one.
              </p>
              <Field label="Sky"><ColorIn value={pal.sky} onChange={(e) => setPal("sky", e.target.value)} /></Field>
              <Field label="Page"><ColorIn value={pal.snow} onChange={(e) => setPal("snow", e.target.value)} /></Field>
              <Field label="Cards"><ColorIn value={pal.card} onChange={(e) => setPal("card", e.target.value)} /></Field>
              <Field label="Ink"><ColorIn value={pal.ink} onChange={(e) => setPal("ink", e.target.value)} /></Field>
              <Field label="Sun"><ColorIn value={pal.sun} onChange={(e) => setPal("sun", e.target.value)} /></Field>
              <Field label="Bubblegum"><ColorIn value={pal.bubblegum} onChange={(e) => setPal("bubblegum", e.target.value)} /></Field>
              <div className="hg-divider" />
              <Field label="Typeface pairing" hint="Stand-ins for TT Trailers + Menco.">
                <SelectIn
                  value={t.fontSet}
                  onChange={(e) => set("theme.fontSet", e.target.value)}
                  options={Object.entries(FONT_SETS).map(([v, f]) => ({ value: v, label: f.label }))}
                />
              </Field>
              <Field label="Corner radius">
                <RangeIn value={t.radius} min={0} max={44} suffix="px" onChange={(e) => set("theme.radius", Number(e.target.value))} />
              </Field>
              <Field label="Shadow depth" hint="The chunky toy drop under every card.">
                <RangeIn value={t.depth} min={0} max={18} suffix="px" onChange={(e) => set("theme.depth", Number(e.target.value))} />
              </Field>
              <Toggle on={t.snowfall} label="Falling snow" onClick={() => set("theme.snowfall", !t.snowfall)} />
              <Toggle on={t.marqueeOn} label="Marquee ticker" onClick={() => set("theme.marqueeOn", !t.marqueeOn)} />
            </>
          )}

          {tab === "layout" && (
            <>
              <Field label="Grid columns">
                <RangeIn value={L.columns} min={2} max={5} onChange={(e) => set("layout.columns", Number(e.target.value))} />
              </Field>
              <Field label="Thumbnail shape" hint="Pinboard keeps each work's real proportions.">
                <SelectIn
                  value={L.crop}
                  onChange={(e) => set("layout.crop", e.target.value)}
                  options={[
                    { value: "square", label: "Square crop (tidy)" },
                    { value: "natural", label: "Pinboard (natural)" },
                  ]}
                />
              </Field>
              <Field label="Default order">
                <SelectIn
                  value={L.order}
                  onChange={(e) => set("layout.order", e.target.value)}
                  options={[
                    { value: "curated", label: "Curated (manual)" },
                    { value: "alpha", label: "A–Z" },
                    { value: "shuffle", label: "Shuffle every visit" },
                  ]}
                />
              </Field>
              <div className="hg-divider" />
              <p className="hg-group-label">Sections</p>
              <div className="hg-toggles">
                <Toggle on={L.showHero} label="Hero headline" onClick={() => set("layout.showHero", !L.showHero)} />
                <Toggle on={L.showCounts} label="Counter pills" onClick={() => set("layout.showCounts", !L.showCounts)} />
                <Toggle on={L.showCarousel} label="Highlights carousel" onClick={() => set("layout.showCarousel", !L.showCarousel)} />
                <Toggle on={L.showGrid} label="Artist grid" onClick={() => set("layout.showGrid", !L.showGrid)} />
                <Toggle on={L.showFilters} label="Medium filters" onClick={() => set("layout.showFilters", !L.showFilters)} />
                <Toggle on={L.showShuffle} label="Shuffle button" onClick={() => set("layout.showShuffle", !L.showShuffle)} />
                <Toggle on={L.hoverExpand} label="Expand cards on hover" onClick={() => set("layout.hoverExpand", !L.hoverExpand)} />
                <Toggle on={L.showStrip} label="Whole-huddle strip" onClick={() => set("layout.showStrip", !L.showStrip)} />
                <Toggle on={L.showBand} label="Submission band" onClick={() => set("layout.showBand", !L.showBand)} />
              </div>
              <div className="hg-divider" />
              <p className="hg-group-label">Fun</p>
              <div className="hg-toggles">
                <Toggle on={cfg.fun.fish} label="Toss a fish reactions" onClick={() => set("fun.fish", !cfg.fun.fish)} />
                <Toggle on={cfg.fun.spin} label="Random artist button" onClick={() => set("fun.spin", !cfg.fun.spin)} />
                <Toggle on={cfg.fun.countdown} label="Next hang countdown" onClick={() => set("fun.countdown", !cfg.fun.countdown)} />
                <Toggle on={cfg.fun.nightToggle} label="Day / night switch" onClick={() => set("fun.nightToggle", !cfg.fun.nightToggle)} />
                <Toggle on={cfg.fun.waddler} label="Wandering penguin" onClick={() => set("fun.waddler", !cfg.fun.waddler)} />
                <Toggle on={cfg.fun.tilt} label="Carousel tilt" onClick={() => set("fun.tilt", !cfg.fun.tilt)} />
                <Toggle on={cfg.fun.blizzard} label="Blizzard easter egg" onClick={() => set("fun.blizzard", !cfg.fun.blizzard)} />
              </div>
              <div className="hg-two" style={{ marginTop: 12 }}>
                <Field label="Hang day">
                  <SelectIn
                    value={String(cfg.site.hangDay)}
                    onChange={(e) => set("site.hangDay", Number(e.target.value))}
                    options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
                  />
                </Field>
                <Field label="Hour">
                  <RangeIn value={cfg.site.hangHour} min={0} max={23} suffix=":00"
                    onChange={(e) => set("site.hangHour", Number(e.target.value))} />
                </Field>
              </div>
              <button
                type="button"
                className="hg-danger"
                style={{ marginBottom: 10 }}
                onClick={() => {
                  setFish({});
                  try { window.storage.set(FISH_KEY, "{}", false); } catch (e) {}
                }}
              >
                <Fish size={13} /> Clear all fish counts
              </button>
              <div className="hg-divider" />
              <p className="hg-group-label">Data</p>
              <Toggle
                on={withImages}
                label={`Include uploaded images${
                  Object.keys(images).length ? ` (${Object.keys(images).length})` : ""
                }`}
                onClick={() => setWithImages(!withImages)}
              />
              <div className="hg-data-row">
                <button type="button" className="hg-add hg-add-sm" style={{ margin: 0 }} onClick={() => downloadJson(withImages)}>
                  <Download size={12} /> Download
                </button>
                <button type="button" className="hg-add hg-add-sm" style={{ margin: 0 }} onClick={() => copyJson(withImages)}>
                  <ClipboardCopy size={12} /> Copy
                </button>
              </div>
              <textarea
                className="hg-input hg-area hg-json"
                readOnly
                rows={4}
                value={exportText}
                onFocus={(e) => e.target.select()}
              />
              <p className="hg-field-hint" style={{ marginBottom: 12 }}>
                {Math.round(exportText.length / 1024)}KB. Everything on this page, ready to hand over.
              </p>

              <Field label="Load a config" hint="Paste JSON, or pick a downloaded file.">
                <AreaIn
                  value={importText}
                  rows={3}
                  placeholder="Paste here…"
                  onChange={(e) => setImportText(e.target.value)}
                />
              </Field>
              <div className="hg-data-row">
                <label className="hg-upbtn" style={{ margin: 0 }}>
                  Open file
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      e.target.value = "";
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => applyJson(String(r.result));
                      r.onerror = () => say("Couldn't read that file.");
                      r.readAsText(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="hg-add hg-add-sm"
                  style={{ margin: 0, opacity: importText.trim() ? 1 : 0.4 }}
                  disabled={!importText.trim()}
                  onClick={() => applyJson(importText)}
                >
                  <Upload size={12} /> Apply
                </button>
              </div>

              <div className="hg-divider" />
              <button type="button" className="hg-danger" onClick={() => setCfg(clone(DEFAULT))}>
                <RotateCcw size={13} /> Reset everything
              </button>
            </>
          )}

          {tab === "artists" && (
            <>
              <button type="button" className="hg-add" onClick={addArtist}><Plus size={14} /> Add artist</button>
              {cfg.artists.map((a, i) => (
                <div key={a.id} className={`hg-row ${openArtist === a.id ? "is-open" : ""}`}>
                  <div className="hg-row-head">
                    <button
                      type="button"
                      className="hg-row-name"
                      onClick={() => setOpenArtist(openArtist === a.id ? null : a.id)}
                    >
                      <span style={{ opacity: a.shown ? 1 : 0.4 }}>{a.name}</span>
                      <em>@{a.handle} · {a.pieces.length} work{a.pieces.length > 1 ? "s" : ""}</em>
                    </button>
                    <div className="hg-row-tools">
                      <button type="button" onClick={() => moveArtist(i, -1)} aria-label="Move up"><ArrowUp size={12} /></button>
                      <button type="button" onClick={() => moveArtist(i, 1)} aria-label="Move down"><ArrowDown size={12} /></button>
                      <button type="button" onClick={() => dupArtist(a)} aria-label="Duplicate"><CopyPlus size={12} /></button>
                      <button type="button" onClick={() => delArtist(a.id)} aria-label="Remove"><Trash2 size={12} /></button>
                    </div>
                  </div>

                  {openArtist === a.id && (
                    <div className="hg-row-body">
                      <Field label="Name"><TextIn value={a.name} onChange={(e) => setArtist(a.id, "name", e.target.value)} /></Field>
                      <p className="hg-uplabel">Avatar</p>
                      <div className="hg-upload">
                        {avatarOf(a) ? (
                          <img className="hg-upthumb hg-upthumb-round" src={avatarOf(a)} alt="" />
                        ) : (
                          <span className="hg-upthumb hg-upthumb-round hg-upthumb-empty">Auto</span>
                        )}
                        <div className="hg-upload-actions">
                          <label className="hg-upbtn">
                            {avatars[a.id] ? "Replace" : "Upload"}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                uploadAvatar(a.id, e.target.files && e.target.files[0]);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {avatars[a.id] && (
                            <button type="button" className="hg-upclear" onClick={() => removeAvatar(a.id)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="hg-two">
                        <Field label="Handle"><TextIn value={a.handle} onChange={(e) => setArtist(a.id, "handle", e.target.value)} /></Field>
                        <Field label="X handle"><TextIn value={a.x} onChange={(e) => setArtist(a.id, "x", e.target.value)} /></Field>
                      </div>
                      <Field label="One line"><AreaIn value={a.blurb} onChange={(e) => setArtist(a.id, "blurb", e.target.value)} /></Field>
                      <Field label="Tags" hint="Comma separated. These become the filters.">
                        <TextIn
                          value={a.tags.join(", ")}
                          onChange={(e) => setArtist(a.id, "tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                        />
                      </Field>
                      <Toggle on={a.commissions} label="Open for commissions" onClick={() => setArtist(a.id, "commissions", !a.commissions)} />
                      <Toggle on={!!a.needsCredit} label="Needs credit" onClick={() => setArtist(a.id, "needsCredit", !a.needsCredit)} />
                      <Toggle on={a.shown} label="Show on the page" onClick={() => setArtist(a.id, "shown", !a.shown)} />

                      <p className="hg-group-label">Works</p>
                      {a.pieces.map((p, pi) => (
                        <div key={p.id} className="hg-piece">
                          <div className="hg-piece-head">
                            <button
                              type="button"
                              className={`hg-star ${isPicked(p.id) ? "is-on" : ""} ${
                                isPicked(p.id) && !highlights.some((h) => h.p.id === p.id) ? "is-queued" : ""
                              }`}
                              onClick={() => togglePick(p.id)}
                              title={
                                isPicked(p.id)
                                  ? highlights.some((h) => h.p.id === p.id)
                                    ? "In this week's picks"
                                    : "Queued — over the slot limit"
                                  : "Add to this week's picks"
                              }
                            >
                              <Star size={12} fill={isPicked(p.id) ? "currentColor" : "none"} />
                            </button>
                            <span className="hg-piece-n">{pi === 0 ? "Thumbnail" : `Work ${pi + 1}`}</span>
                            <button
                              type="button"
                              className="hg-piece-x"
                              onClick={() => delPiece(a.id, p.id)}
                              aria-label="Remove work"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                          <div className="hg-two">
                            <Field label="Title"><TextIn value={p.title} onChange={(e) => setPiece(a.id, p.id, "title", e.target.value)} /></Field>
                            <Field label="Year"><TextIn value={p.year} onChange={(e) => setPiece(a.id, p.id, "year", e.target.value)} /></Field>
                          </div>
                          <p className="hg-uplabel">Artwork file</p>
                          <div className="hg-upload">
                            {srcOf(p) ? (
                              <img className="hg-upthumb" src={srcOf(p)} alt="" />
                            ) : (
                              <span className="hg-upthumb hg-upthumb-empty">None</span>
                            )}
                            <div className="hg-upload-actions">
                              <label className="hg-upbtn">
                                {images[p.id] ? "Replace" : "Upload"}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    uploadImage(p.id, e.target.files && e.target.files[0]);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              {images[p.id] && (
                                <button type="button" className="hg-upclear" onClick={() => removeImage(p.id)}>
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                          <Field label="…or paste a URL" hint="Uploads win over URLs. Empty means placeholder art.">
                            <TextIn
                              value={p.src || ""}
                              placeholder="https://…"
                              onChange={(e) => setPiece(a.id, p.id, "src", e.target.value)}
                            />
                          </Field>
                          <Field
                            label="Shape"
                            hint={
                              measured[p.id]
                                ? `Measured ${measured[p.id].toFixed(2)}:1 from the image.`
                                : "Sets the hanging shape before the image loads."
                            }
                          >
                            <SelectIn
                              value={p.shape || "square"}
                              onChange={(e) => setPiece(a.id, p.id, "shape", e.target.value)}
                              options={Object.entries(SHAPES).map(([v, s]) => ({ value: v, label: s.label }))}
                            />
                          </Field>
                          <Field label="Treatment" hint="Only applies to placeholder art.">
                            <SelectIn
                              value={p.style}
                              onChange={(e) => setPiece(a.id, p.id, "style", e.target.value)}
                              options={ART_STYLES.map((s) => ({ value: s, label: s }))}
                            />
                          </Field>
                          <div className="hg-swatch-row">
                            <Palette size={13} />
                            {p.palette.map((c, ci) => (
                              <input
                                key={ci}
                                type="color"
                                value={c}
                                aria-label={`Colour ${ci + 1}`}
                                onChange={(e) => {
                                  const arr = [...p.palette];
                                  arr[ci] = e.target.value;
                                  setPiece(a.id, p.id, "palette", arr);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      <button type="button" className="hg-add hg-add-sm" onClick={() => addPiece(a.id)}>
                        <Plus size={12} /> Add work
                      </button>

                      <p className="hg-group-label">Posts from X</p>
                      {(a.tweets || []).length === 0 && (
                        <p className="hg-field-hint" style={{ marginBottom: 8 }}>
                          Nothing linked. These show in the hover drawer and the full profile.
                        </p>
                      )}
                      {(a.tweets || []).map((tw) => (
                        <div key={tw.id} className="hg-piece">
                          <div className="hg-piece-head">
                            <XLogo size={12} />
                            <span className="hg-piece-n">Post</span>
                            <button
                              type="button"
                              className="hg-piece-x"
                              onClick={() => delTweet(a.id, tw.id)}
                              aria-label="Remove post"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                          <Field label="Post URL">
                            <TextIn value={tw.url} onChange={(e) => setTweet(a.id, tw.id, "url", e.target.value)} />
                          </Field>
                          <Field label="Text">
                            <AreaIn value={tw.text} onChange={(e) => setTweet(a.id, tw.id, "text", e.target.value)} />
                          </Field>
                          <Field label="Date">
                            <TextIn value={tw.date} onChange={(e) => setTweet(a.id, tw.id, "date", e.target.value)} />
                          </Field>
                        </div>
                      ))}
                      <button type="button" className="hg-add hg-add-sm" onClick={() => addTweet(a.id)}>
                        <Plus size={12} /> Add post
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {!adminOpen && (
        <button type="button" className="hg-fab" onClick={() => setAdminOpen(true)}>
          <Settings2 size={15} /> Curate
        </button>
      )}
    </div>
  );
}

/* ================================================================== */
/*  CSS                                                                */
/* ================================================================== */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap');

.hg-root {
  position: relative;
  min-height: 100vh;
  font-family: var(--fb);
  color: var(--ink);
  background:
    linear-gradient(180deg, var(--sky) 0%, var(--snow) 46%, var(--snow) 100%);
  overflow-x: hidden;
  --edge: clamp(18px, 5vw, 76px);
  --slideH: clamp(230px, 40vh, 400px);
  --slideMax: min(86vw, 780px);
  --gap: clamp(16px, 2.6vw, 34px);
}
.hg-root *, .hg-root *::before, .hg-root *::after { box-sizing: border-box; }
.hg-root button { font: inherit; cursor: pointer; }
.hg-root :focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; border-radius: 6px; }

/* snow */
.hg-snow { position: fixed; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; }
.hg-snow span {
  position: absolute; top: -12px; border-radius: 50%; background: #fff;
  animation-name: hgFall; animation-timing-function: linear; animation-iteration-count: infinite;
}
@keyframes hgFall {
  0%   { transform: translate3d(0, -20px, 0); }
  100% { transform: translate3d(26px, 105vh, 0); }
}

/* buttons */
.hg-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  border: 2px solid var(--ink); border-radius: 999px;
  padding: 10px 18px; font-weight: 800; font-size: 13.5px;
  text-decoration: none; color: var(--ink); background: var(--card);
  box-shadow: 0 calc(var(--depth) * 0.4) 0 var(--ink);
  transition: transform 0.14s, box-shadow 0.14s;
}
.hg-btn:hover { transform: translateY(calc(var(--depth) * 0.25)); box-shadow: 0 calc(var(--depth) * 0.16) 0 var(--ink); }
.hg-btn-ink { background: var(--ink); color: var(--card); }
.hg-btn-sun { background: var(--sun); }
.hg-btn-ghost { background: transparent; box-shadow: none; padding: 8px 15px; }
.hg-btn-ghost:hover { background: var(--card); transform: none; box-shadow: none; }
.hg-btn-sm { padding: 7px 13px; font-size: 12px; }
.hg-btn-lg { padding: 15px 30px; font-size: 16px; }
.hg-round {
  display: grid; place-items: center; width: 46px; height: 46px;
  border-radius: 50%; border: 2px solid var(--ink); background: var(--card); color: var(--ink);
  box-shadow: 0 calc(var(--depth) * 0.4) 0 var(--ink);
  transition: transform 0.14s, box-shadow 0.14s;
}
.hg-round:hover { transform: translateY(calc(var(--depth) * 0.25)); box-shadow: 0 calc(var(--depth) * 0.16) 0 var(--ink); }

/* nav */
.hg-nav {
  position: relative; z-index: 5;
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 16px var(--edge);
}
.hg-wordmark {
  display: flex; align-items: center; gap: 10px;
  background: none; border: none; padding: 0; color: var(--ink);
  font-family: var(--fd); font-size: 21px; text-transform: var(--dcase);
  letter-spacing: var(--dsp);
}
.hg-wordmark:active { transform: scale(0.96); }
.hg-nav-links { display: flex; align-items: center; gap: 18px; }
.hg-nav-links a { font-weight: 800; font-size: 14px; color: var(--ink); text-decoration: none; }
.hg-nav-links a:hover { text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 4px; }

/* marquee */
.hg-marquee {
  position: relative; z-index: 4; overflow: hidden;
  background: var(--ink); color: var(--snow);
  padding: 9px 0; border-top: 2px solid var(--ink); border-bottom: 2px solid var(--ink);
}
.hg-marquee-track {
  display: inline-flex; white-space: nowrap;
  font-family: var(--fd); font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase;
  animation: hgSlide 34s linear infinite;
}
.hg-marquee-track span { padding-right: 40px; }
@keyframes hgSlide { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* hero */
.hg-hero { position: relative; z-index: 3; padding: clamp(34px, 6vw, 74px) var(--edge) clamp(18px, 3vw, 32px); max-width: 900px; }
.hg-eyebrow {
  margin: 0 0 12px; font-weight: 900; font-size: 12px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); opacity: 0.55;
}
.hg-h1 {
  margin: 0; font-family: var(--fd); font-weight: 400;
  font-size: clamp(44px, 10vw, 112px); line-height: 0.9;
  text-transform: var(--dcase); letter-spacing: var(--dsp);
  text-shadow: 0 calc(var(--depth) * 0.28) 0 rgba(255,255,255,0.65);
}
.hg-sub { margin: 20px 0 0; max-width: 44ch; font-size: clamp(15px, 1.7vw, 19px); line-height: 1.5; font-weight: 600; opacity: 0.8; }
.hg-counts { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.hg-counts span {
  background: var(--card); border: 2px solid var(--ink); border-radius: 999px;
  padding: 7px 15px; font-size: 13px; font-weight: 700;
  box-shadow: 0 calc(var(--depth) * 0.35) 0 var(--ink);
}
.hg-counts b { font-family: var(--fd); font-weight: 400; font-size: 16px; margin-right: 3px; }

/* headings */
.hg-h2 {
  margin: 0; font-family: var(--fd); font-weight: 400;
  font-size: clamp(26px, 4vw, 44px); line-height: 1;
  text-transform: var(--dcase); letter-spacing: var(--dsp);
}
.hg-h3 {
  margin: 0 0 18px; font-family: var(--fd); font-weight: 400;
  font-size: clamp(20px, 2.6vw, 28px);
  text-transform: var(--dcase); letter-spacing: var(--dsp);
}
.hg-note { margin: 8px 0 0; max-width: 46ch; font-size: 14.5px; font-weight: 600; opacity: 0.66; }

/* carousel */
.hg-carousel { position: relative; z-index: 3; padding: clamp(18px, 3vw, 34px) 0 clamp(28px, 4vw, 48px); }
.hg-carousel-head {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
  padding: 0 var(--edge) 22px;
}
.hg-carousel-nav { display: flex; gap: 10px; }
.hg-viewport {
  overflow: hidden; padding: 10px 0 calc(var(--depth) + 12px);
  touch-action: pan-y; cursor: grab; -webkit-user-select: none; user-select: none;
}
.hg-viewport:active { cursor: grabbing; }
.hg-track.is-dragging { transition: none; }
.hg-track {
  display: flex; gap: var(--gap); align-items: flex-end;
  will-change: transform;
  transition: transform 0.62s cubic-bezier(.22,.8,.24,1);
}
.hg-slide {
  flex: 0 0 auto;
  /* Height is the constant. Width follows each work's own ratio, so a
     panorama and a portrait can hang side by side on one baseline. */
  width: clamp(170px, calc(var(--slideH) * var(--ar, 1)), var(--slideMax));
  background: var(--card); border: 3px solid var(--ink); border-radius: var(--r);
  box-shadow: 0 var(--depth) 0 var(--ink);
  overflow: hidden; opacity: 0.5;
  transform: scale(0.9);
  transition: transform 0.5s cubic-bezier(.22,.8,.24,1), opacity 0.4s;
}
.hg-slide.tilt-a { transform: scale(0.9) rotate(-2deg); }
.hg-slide.tilt-b { transform: scale(0.9) rotate(2deg); }
.hg-slide.is-active {
  opacity: 1;
  transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) scale(1);
  transition: transform 0.16s ease-out, opacity 0.4s;
}
.hg-slide-art {
  display: block; width: 100%; height: var(--slideH);
  padding: 0; border: none; background: color-mix(in srgb, var(--ink) 8%, var(--card));
  overflow: hidden;
}
.hg-art { display: block; width: 100%; height: 100%; }
.hg-art-img { object-fit: cover; }
.hg-slide-bar {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 16px; border-top: 3px solid var(--ink); background: var(--card);
}
.hg-slide-meta { min-width: 0; flex: 1 1 110px; }
.hg-slide-title {
  margin: 0; font-family: var(--fd); font-weight: 400; font-size: 19px; line-height: 1.1;
  text-transform: var(--dcase); letter-spacing: var(--dsp);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hg-slide-by { margin: 3px 0 0; font-size: 12.5px; font-weight: 700; opacity: 0.62; }
.hg-slide-by span { color: var(--gum); opacity: 1; }
.hg-dots { display: flex; justify-content: center; gap: 8px; padding-top: 22px; }
.hg-dot {
  width: 10px; height: 10px; border-radius: 50%; padding: 0;
  border: 2px solid var(--ink); background: transparent;
}
.hg-dot.is-on { background: var(--ink); transform: scale(1.25); }

/* sections */
.hg-section { position: relative; z-index: 3; padding: clamp(30px, 5vw, 62px) var(--edge); }
.hg-section-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
.hg-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 26px 0 30px; }
.hg-chip {
  border: 2px solid var(--ink); background: transparent; color: var(--ink);
  border-radius: 999px; padding: 7px 15px; font-size: 13px; font-weight: 800;
}
.hg-chip.is-on { background: var(--ink); color: var(--card); }
.hg-empty { padding: 40px 0; font-weight: 700; opacity: 0.6; }

.hg-grid {
  display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  gap: clamp(18px, 2.4vw, 30px);
}
.hg-card {
  display: flex; flex-direction: column;
  background: var(--card); border: 3px solid var(--ink); border-radius: var(--r);
  box-shadow: 0 var(--depth) 0 var(--ink);
  transition: transform 0.18s, box-shadow 0.18s;
}
.hg-card:hover { transform: translateY(calc(var(--depth) * -0.5)); box-shadow: 0 calc(var(--depth) * 1.5) 0 var(--ink); }

/* avatar — the big identity block at the top of the card */
.hg-avatar {
  position: relative; display: block; width: 100%; padding: 0;
  border: none; border-bottom: 3px solid var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, var(--card));
  aspect-ratio: 4 / 5; overflow: hidden;
  border-radius: calc(var(--r) - 3px) calc(var(--r) - 3px) 0 0;
  /* a soft scalloped bottom edge, echoing the hand-drawn wavy cut */
  mask-image: radial-gradient(circle at 12px 100%, transparent 11px, #000 11.5px);
  mask-size: 24px 100%;
  mask-repeat: repeat-x;
  mask-position: bottom;
}
.hg-avatar-img { display: block; width: 100%; height: 100%; object-fit: cover; }
.hg-avatar-art { display: block; width: 100%; height: 100%; }
.hg-grid.is-pinboard { display: block; columns: var(--cols); column-gap: clamp(18px, 2.4vw, 30px); }
.hg-grid.is-pinboard .hg-card {
  display: block; break-inside: avoid; margin-bottom: clamp(18px, 2.4vw, 30px);
}
.hg-grid.is-pinboard .hg-avatar { aspect-ratio: var(--ar, 0.8); mask-image: none; }
.hg-badge {
  position: absolute; left: 10px; bottom: 14px;
  background: var(--sun); border: 2px solid var(--ink); border-radius: 999px;
  padding: 4px 10px; font-size: 10.5px; font-weight: 900;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.hg-badge-static { position: static; display: inline-block; margin-bottom: 12px; }
.hg-badge-static + .hg-badge-static { margin-left: 6px; }
.hg-badge-warn { background: var(--gum); }
.hg-badge + .hg-badge-warn, .hg-badge-warn + .hg-badge { left: auto; right: 10px; }

/* nickname row */
.hg-card-body {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 14px 4px; text-align: center;
}
.hg-card-name {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: var(--fd); font-weight: 400; font-size: 20px; line-height: 1;
  text-transform: var(--dcase); letter-spacing: var(--dsp);
  color: var(--ink); text-decoration: none;
}
.hg-card-name:hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; }
.hg-card-name svg { flex: none; opacity: 0.55; }

/* the row of artwork thumbnails under the name */
.hg-workstrip {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 0; margin: 12px 0 0; border-top: 2px solid color-mix(in srgb, var(--ink) 14%, transparent);
}
.hg-workslot {
  position: relative; display: block; padding: 0; border: none;
  border-right: 2px solid color-mix(in srgb, var(--ink) 14%, transparent);
  aspect-ratio: 1 / 1; overflow: hidden;
  background: color-mix(in srgb, var(--ink) 6%, var(--card));
}
.hg-workslot:last-child { border-right: none; }
.hg-workslot .hg-art { transition: transform 0.25s; }
.hg-workslot:hover .hg-art { transform: scale(1.08); }
.hg-workslot-more {
  display: flex; align-items: center; justify-content: center;
  font-family: var(--fd); font-size: 15px; color: var(--ink); opacity: 0.55;
}
.hg-workslot-more:hover { opacity: 1; }

/* drawer contents: blurb + tags now live here instead of on the face */
.hg-drawer-blurb { margin: 14px 15px 0; font-size: 13.5px; line-height: 1.45; font-weight: 600; opacity: 0.75; }
.hg-card-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.hg-drawer .hg-card-tags { margin: 10px 15px 0; padding: 0; }
.hg-tag {
  background: color-mix(in srgb, var(--sky) 45%, #fff);
  border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 800;
}

/* huddle strip */
.hg-strip-wrap { padding-top: 0; }
.hg-strip { display: flex; flex-wrap: wrap; gap: 10px; }
.hg-pip {
  width: 54px; height: 54px; border-radius: 50%;
  border: 3px solid var(--ink); display: grid; place-items: center;
  font-family: var(--fd); font-weight: 400; font-size: 15px; color: var(--ink);
  box-shadow: 0 calc(var(--depth) * 0.4) 0 var(--ink);
  transition: transform 0.15s;
}
.hg-pip:hover { transform: translateY(-4px) rotate(-6deg); }
.hg-pip-you {
  background: transparent; border-style: dashed; box-shadow: none;
  font-size: 12px; opacity: 0.6;
}

/* band */
.hg-band {
  position: relative; z-index: 3;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 22px;
  margin: clamp(20px, 4vw, 44px) var(--edge) 0; padding: clamp(26px, 4vw, 44px);
  background: var(--sun); border: 3px solid var(--ink); border-radius: var(--r);
  box-shadow: 0 var(--depth) 0 var(--ink);
}
.hg-band-h {
  margin: 0; font-family: var(--fd); font-weight: 400; font-size: clamp(24px, 3.4vw, 40px); line-height: 1;
  text-transform: var(--dcase); letter-spacing: var(--dsp);
}
.hg-band-b { margin: 10px 0 0; max-width: 46ch; font-size: 15px; font-weight: 600; opacity: 0.78; }
.hg-footer {
  position: relative; z-index: 3;
  padding: clamp(34px, 5vw, 60px) var(--edge); font-size: 13px; font-weight: 700; opacity: 0.55;
}

/* fab */
.hg-fab {
  position: fixed; right: 20px; bottom: 20px; z-index: 20;
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--ink); color: var(--card);
  border: 3px solid var(--ink); border-radius: 999px; padding: 12px 20px;
  font-weight: 800; font-size: 13.5px;
  box-shadow: 0 8px 22px rgba(14,42,92,0.32);
}

/* modal */
.hg-modal-scrim {
  position: fixed; inset: 0; z-index: 40; display: grid; place-items: center;
  background: rgba(14,42,92,0.42); padding: 20px; overflow-y: auto;
}
.hg-modal {
  position: relative; width: min(760px, 100%);
  background: var(--card); border: 3px solid var(--ink); border-radius: var(--r);
  box-shadow: 0 var(--depth) 0 var(--ink); padding: clamp(20px, 3vw, 32px);
}
.hg-modal-x {
  position: absolute; top: 14px; right: 14px;
  width: 36px; height: 36px; display: grid; place-items: center;
  border: 2px solid var(--ink); border-radius: 50%; background: var(--card); color: var(--ink);
}
.hg-modal-grid { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 26px; align-items: start; }
.hg-modal-art {
  border: 3px solid var(--ink); border-radius: calc(var(--r) * 0.7); overflow: hidden;
  aspect-ratio: var(--ar, 1); background: color-mix(in srgb, var(--ink) 8%, var(--card));
}
.hg-modal-art.is-pfp { aspect-ratio: 1 / 1; }
.hg-modal-art .hg-art-img { object-fit: cover; }
.hg-modal-name {
  margin: 0; font-family: var(--fd); font-weight: 400; font-size: clamp(26px, 3.4vw, 38px); line-height: 1;
  text-transform: var(--dcase); letter-spacing: var(--dsp);
}
.hg-modal-handle { margin: 6px 0 0; font-weight: 800; font-size: 14px; color: var(--gum); }
.hg-modal-blurb { margin: 14px 0 0; font-size: 15px; line-height: 1.5; font-weight: 600; opacity: 0.78; }
.hg-modal-label {
  margin: 22px 0 8px; font-size: 11px; font-weight: 900;
  letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.5;
}
.hg-works { list-style: none; margin: 0 0 22px; padding: 0; }
.hg-works li {
  display: flex; align-items: center; gap: 10px; padding: 8px 0;
  border-bottom: 2px solid color-mix(in srgb, var(--ink) 12%, transparent);
  font-size: 14px; font-weight: 700;
}
.hg-work-swatch { width: 14px; height: 14px; border-radius: 4px; border: 2px solid var(--ink); flex: none; }
.hg-work-title { flex: 1; min-width: 0; }
.hg-work-year { opacity: 0.5; font-size: 12.5px; }

/* admin */
.hg-scrim { position: fixed; inset: 0; background: rgba(14,42,92,0.35); z-index: 30; }
.hg-admin {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 31;
  width: min(410px, 100vw); display: flex; flex-direction: column;
  background: #0C1F44; color: #EAF4FF; border-left: 3px solid #0A1832;
  transform: translateX(101%); transition: transform 0.32s cubic-bezier(.2,.7,.3,1);
  font-family: 'Nunito', system-ui, sans-serif;
}
.hg-admin.is-open { transform: translateX(0); }
.hg-admin-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 20px 20px 14px; }
.hg-admin-kicker { margin: 0; font-size: 10px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: var(--sun); }
.hg-admin-title { margin: 5px 0 0; font-size: 19px; font-weight: 900; }
.hg-icon-btn { background: rgba(234,244,255,0.1); border: none; color: inherit; border-radius: 9px; padding: 7px; display: grid; place-items: center; }
.hg-tabs { display: flex; gap: 4px; padding: 0 16px 12px; }
.hg-tab {
  flex: 1; background: transparent; border: none; color: rgba(234,244,255,0.55);
  padding: 8px 2px; border-radius: 8px; font-size: 10px; font-weight: 900;
  letter-spacing: 0.03em; text-transform: uppercase;
}
.hg-tab.is-active { background: rgba(234,244,255,0.13); color: #fff; }
.hg-admin-body { flex: 1; overflow-y: auto; padding: 4px 20px 44px; }

.hg-field { display: block; margin-bottom: 13px; }
.hg-field-label { display: block; margin-bottom: 6px; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(234,244,255,0.55); }
.hg-field-hint { display: block; margin-top: 5px; font-size: 11px; color: rgba(234,244,255,0.4); }
.hg-input {
  width: 100%; background: rgba(234,244,255,0.08); color: #EAF4FF;
  border: 1px solid rgba(234,244,255,0.16); border-radius: 9px;
  padding: 9px 11px; font-family: inherit; font-size: 13px; font-weight: 600;
}
.hg-input:focus { border-color: var(--sun); outline: none; }
.hg-area { resize: vertical; line-height: 1.45; }
.hg-select-wrap { position: relative; }
.hg-select { appearance: none; padding-right: 30px; }
.hg-select-icon { position: absolute; right: 10px; top: 12px; pointer-events: none; opacity: 0.55; }
.hg-select option { background: #0C1F44; }
.hg-color { display: flex; gap: 8px; align-items: center; }
.hg-color input[type="color"] { width: 40px; height: 34px; padding: 0; border: 1px solid rgba(234,244,255,0.2); border-radius: 9px; background: none; cursor: pointer; }
.hg-color-text { text-transform: uppercase; font-size: 12px; }
.hg-range { display: flex; align-items: center; gap: 12px; }
.hg-range input[type="range"] { flex: 1; accent-color: var(--sun); }
.hg-range-val { font-size: 11.5px; font-weight: 800; min-width: 44px; text-align: right; color: rgba(234,244,255,0.65); }
.hg-toggle { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: none; color: rgba(234,244,255,0.68); padding: 8px 0; font-size: 13px; font-weight: 700; text-align: left; }
.hg-toggle-box { width: 18px; height: 18px; border-radius: 6px; display: grid; place-items: center; border: 1px solid rgba(234,244,255,0.3); flex: none; }
.hg-toggle.is-on { color: #fff; }
.hg-toggle.is-on .hg-toggle-box { background: var(--sun); border-color: var(--sun); color: #0C1F44; }
.hg-toggles { display: flex; flex-direction: column; }
.hg-group-label { margin: 18px 0 8px; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(234,244,255,0.55); }
.hg-divider { height: 1px; background: rgba(234,244,255,0.13); margin: 20px 0; }
.hg-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.hg-add {
  display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%;
  background: var(--sun); color: #0C1F44; border: none; border-radius: 10px;
  padding: 11px; margin: 4px 0 16px; font-size: 12px; font-weight: 900;
  letter-spacing: 0.05em; text-transform: uppercase;
}
.hg-add-sm { padding: 8px; font-size: 11px; margin-bottom: 4px; background: rgba(234,244,255,0.12); color: #EAF4FF; }
.hg-danger {
  display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%;
  background: transparent; color: #FF9DBB; border: 1px solid rgba(255,157,187,0.4);
  border-radius: 10px; padding: 10px; font-size: 11px; font-weight: 900;
  letter-spacing: 0.05em; text-transform: uppercase;
}
.hg-row { border: 1px solid rgba(234,244,255,0.13); border-radius: 11px; margin-bottom: 8px; background: rgba(234,244,255,0.04); }
.hg-row.is-open { border-color: color-mix(in srgb, var(--sun) 55%, transparent); }
.hg-row-head { display: flex; align-items: center; gap: 6px; padding: 9px 11px; }
.hg-row-name { flex: 1; min-width: 0; background: none; border: none; color: inherit; text-align: left; font-size: 13.5px; font-weight: 800; display: flex; flex-direction: column; gap: 2px; }
.hg-row-name em { font-style: normal; font-size: 10.5px; font-weight: 600; color: rgba(234,244,255,0.45); }
.hg-row-tools { display: flex; gap: 1px; }
.hg-row-tools button { background: none; border: none; color: rgba(234,244,255,0.4); padding: 5px; border-radius: 6px; display: grid; }
.hg-row-tools button:hover { color: #fff; background: rgba(234,244,255,0.1); }
.hg-row-body { padding: 6px 12px 14px; border-top: 1px solid rgba(234,244,255,0.1); }
.hg-piece { border: 1px solid rgba(234,244,255,0.12); border-radius: 10px; padding: 10px 11px 4px; margin-bottom: 8px; }
.hg-piece-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.hg-piece-n { flex: 1; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(234,244,255,0.5); }
.hg-star { background: none; border: none; color: rgba(234,244,255,0.35); padding: 2px; display: grid; }
.hg-star.is-on { color: var(--sun); }
.hg-piece-x { background: none; border: none; color: rgba(255,157,187,0.7); padding: 2px; display: grid; }
.hg-swatch-row { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; color: rgba(234,244,255,0.45); }
.hg-swatch-row input[type="color"] { width: 40px; height: 28px; padding: 0; border: 1px solid rgba(234,244,255,0.2); border-radius: 7px; background: none; cursor: pointer; }

/* ---- fun layer ---- */

/* night */
.hg-root.is-night { background: linear-gradient(180deg, var(--sky) 0%, var(--snow) 52%, var(--snow) 100%); }
.hg-root.is-night .hg-h1 { text-shadow: 0 0 42px color-mix(in srgb, var(--sun) 45%, transparent); }
.hg-root.is-night .hg-tag { background: color-mix(in srgb, var(--sky) 55%, transparent); color: var(--ink); }
.hg-root.is-night .hg-snow span { background: #FFFFFF; }
.hg-round-sm { width: 38px; height: 38px; }

/* snow globe shake */
.hg-root.is-shaking { animation: hgShake 0.6s cubic-bezier(.36,.07,.19,.97); }
@keyframes hgShake {
  10%, 90% { transform: translate3d(-2px, 0, 0) rotate(-0.2deg); }
  20%, 80% { transform: translate3d(4px, 0, 0) rotate(0.3deg); }
  30%, 50%, 70% { transform: translate3d(-7px, 1px, 0) rotate(-0.4deg); }
  40%, 60% { transform: translate3d(7px, -1px, 0) rotate(0.4deg); }
}
.hg-snow.is-blizzard span { animation-timing-function: linear; }
.hg-snow.is-blizzard { backdrop-filter: blur(0.4px); }

/* countdown + spin */
.hg-count-live { display: inline-flex; align-items: center; gap: 7px; }
.hg-blip {
  width: 8px; height: 8px; border-radius: 50%; background: var(--gum);
  animation: hgPulse 1.6s ease-in-out infinite;
}
@keyframes hgPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.75); } }
.hg-spin { margin-top: 18px; }

/* fish */
.hg-fish {
  display: inline-flex; align-items: center; gap: 6px;
  background: color-mix(in srgb, var(--sky) 40%, var(--card));
  border: 2px solid var(--ink); border-radius: 999px;
  padding: 6px 13px; font-size: 12.5px; font-weight: 900; color: var(--ink);
  transition: transform 0.12s;
}
.hg-fish:hover { transform: scale(1.07) rotate(-3deg); }
.hg-fish:active { transform: scale(0.93); }
.hg-fish.is-fed { background: var(--sun); }
.hg-fishpop {
  position: fixed; z-index: 60; font-size: 26px; pointer-events: none;
  transform: translate(-50%, 0); animation: hgToss 0.95s ease-out forwards;
}
@keyframes hgToss {
  0%   { opacity: 0; transform: translate(-50%, 6px) scale(0.5) rotate(0deg); }
  25%  { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -90px) scale(1.15) rotate(38deg); }
}

/* toast */
.hg-toast {
  position: fixed; z-index: 70; left: 50%; top: 26px; transform: translateX(-50%);
  background: var(--ink); color: var(--snow);
  border-radius: 999px; padding: 12px 24px;
  font-family: var(--fd); font-size: 16px; letter-spacing: 0.06em;
  text-transform: uppercase; box-shadow: 0 10px 26px rgba(0,0,0,0.3);
  animation: hgDrop 0.4s cubic-bezier(.2,1.4,.4,1);
}
@keyframes hgDrop { from { opacity: 0; transform: translate(-50%, -26px); } }

/* waddler */
.hg-waddler {
  position: fixed; bottom: 4px; left: -60px; z-index: 2; pointer-events: none;
  animation: hgWaddleAcross 46s linear infinite;
}
.hg-waddler svg { animation: hgBob 0.42s ease-in-out infinite alternate; }
.hg-waddler .hg-foot-l { animation: hgStep 0.84s ease-in-out infinite; transform-origin: center; }
.hg-waddler .hg-foot-r { animation: hgStep 0.84s ease-in-out infinite reverse; transform-origin: center; }
@keyframes hgWaddleAcross {
  0%   { transform: translateX(0); }
  70%  { transform: translateX(calc(100vw + 80px)); }
  100% { transform: translateX(calc(100vw + 80px)); }
}
@keyframes hgBob { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-3px) rotate(3deg); } }
@keyframes hgStep { 0%, 100% { transform: translateX(-2px); } 50% { transform: translateX(2px); } }

/* pfp preview */
.hg-modal-art.is-pfp { border-radius: 50%; overflow: hidden; }
.hg-pfp-btn {
  display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%;
  margin-top: 12px; background: none; border: 2px dashed var(--ink); border-radius: 999px;
  padding: 8px; font-size: 12.5px; font-weight: 800; color: var(--ink); opacity: 0.72;
}
.hg-pfp-btn:hover { opacity: 1; }

/* admin day/night switch */
.hg-modeswitch { display: flex; gap: 4px; background: rgba(234,244,255,0.08); border-radius: 10px; padding: 4px; }
.hg-modeswitch button {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: none; border: none; color: rgba(234,244,255,0.55); border-radius: 7px;
  padding: 8px; font-size: 11.5px; font-weight: 900; text-transform: capitalize;
}
.hg-modeswitch button.is-on { background: rgba(234,244,255,0.14); color: #fff; }

/* ---- hover drawer + tweets ---- */
.hg-card { position: relative; }
.hg-card.is-open { z-index: 6; }
.hg-card-line { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.hg-chev {
  flex: none; width: 28px; height: 28px; display: grid; place-items: center;
  border: 2px solid var(--ink); border-radius: 50%; background: var(--card); color: var(--ink);
  transition: transform 0.22s;
}
.hg-card.is-open .hg-chev { transform: rotate(180deg); background: var(--sun); }

/* The drawer is absolutely positioned so opening a card never reflows
   the grid — it grows over its neighbours instead. */
.hg-drawer {
  position: absolute; left: -3px; right: -3px; top: 100%;
  background: var(--card); border: 3px solid var(--ink); border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  box-shadow: 0 var(--depth) 0 var(--ink);
  display: grid; grid-template-rows: 0fr;
  opacity: 0; pointer-events: none;
  transition: grid-template-rows 0.28s cubic-bezier(.2,.8,.3,1), opacity 0.18s;
}
.hg-drawer-inner { overflow: hidden; min-height: 0; }
.hg-card.is-open .hg-drawer { grid-template-rows: 1fr; opacity: 1; pointer-events: auto; }
.hg-card.is-open { border-bottom-left-radius: 0; border-bottom-right-radius: 0; box-shadow: none; }
.hg-drawer-label {
  margin: 0; padding: 13px 15px 9px; font-size: 10px; font-weight: 900;
  letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.5;
}
.hg-drawer-foot {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 4px 15px 15px;
}
.hg-drawer-more { font-size: 12px; font-weight: 800; opacity: 0.5; }

.hg-tweet {
  display: block; margin: 0 15px 12px; padding: 12px 13px;
  border: 2px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 16px; text-decoration: none; color: var(--ink);
  background: color-mix(in srgb, var(--sky) 14%, transparent);
  transition: border-color 0.16s, transform 0.16s;
}
.hg-tweet:hover { border-color: var(--ink); transform: translateY(-2px); }
.hg-tweet-top { display: flex; align-items: center; gap: 9px; }
.hg-tweet-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex: none;
  display: grid; place-items: center;
  border: 2px solid var(--ink); font-size: 10px; font-weight: 900; color: var(--ink);
}
.hg-tweet-who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.hg-tweet-who b { font-size: 13px; }
.hg-tweet-who span { font-size: 11.5px; font-weight: 700; opacity: 0.55; }
.hg-tweet-text { margin: 10px 0 0; font-size: 13.5px; line-height: 1.45; font-weight: 600; }
.hg-tweet.is-compact .hg-tweet-text {
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.hg-tweet-date { margin: 8px 0 0; font-size: 11px; font-weight: 700; opacity: 0.45; }
.hg-tweets { margin: 0 0 20px; }
.hg-tweets .hg-tweet { margin: 0 0 10px; }

/* uploader */
.hg-uplabel { margin: 6px 0; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(234,244,255,0.55); }
.hg-upload { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
.hg-upthumb {
  width: 54px; height: 54px; flex: none; border-radius: 9px; object-fit: cover;
  border: 1px solid rgba(234,244,255,0.2); background: rgba(234,244,255,0.06);
}
.hg-upthumb-empty { display: grid; place-items: center; font-size: 10px; font-weight: 800; color: rgba(234,244,255,0.4); }
.hg-upthumb-round { border-radius: 50%; }
.hg-upload-actions { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.hg-upbtn {
  display: block; text-align: center; cursor: pointer;
  background: rgba(234,244,255,0.13); color: #EAF4FF; border-radius: 8px;
  padding: 8px; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;
}
.hg-upbtn:hover { background: rgba(234,244,255,0.2); }
.hg-upbtn input { display: none; }
.hg-upclear {
  background: none; border: 1px solid rgba(255,157,187,0.35); color: #FF9DBB;
  border-radius: 8px; padding: 6px; font-size: 10.5px; font-weight: 900; text-transform: uppercase;
}
.hg-star.is-queued { color: rgba(234,244,255,0.35); }
.hg-star.is-queued svg { opacity: 0.6; }

.hg-badge-warn { background: var(--gum); }
.hg-count-warn { background: var(--gum); }
.hg-badge-static + .hg-badge-static { margin-left: 6px; }

/* picks tab */
.hg-slots {
  display: flex; align-items: center; gap: 8px; margin: 4px 0 14px;
  font-size: 11px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase;
}
.hg-slots > span:first-child {
  background: rgba(234,244,255,0.12); border-radius: 999px; padding: 6px 12px; color: #fff;
}
.hg-slots > span:first-child.is-over { background: var(--gum); color: #2A0A1A; }
.hg-slots-note { color: rgba(234,244,255,0.45); }
.hg-pick {
  display: flex; align-items: center; gap: 9px; padding: 7px 9px; margin-bottom: 6px;
  border: 1px solid rgba(234,244,255,0.13); border-radius: 11px; background: rgba(234,244,255,0.04);
}
.hg-pick.is-over { opacity: 0.5; border-style: dashed; }
.hg-pick-n {
  width: 20px; flex: none; text-align: center;
  font-size: 12px; font-weight: 900; color: var(--sun);
}
.hg-pick.is-over .hg-pick-n { color: rgba(234,244,255,0.4); }
.hg-pick-thumb {
  width: 38px; height: 38px; flex: none; border-radius: 8px;
  background-size: cover; background-position: center;
  border: 1px solid rgba(234,244,255,0.18);
}
.hg-pick-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hg-pick-meta b {
  font-size: 12.5px; font-weight: 800;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.hg-pick-meta em { font-style: normal; font-size: 10.5px; color: rgba(234,244,255,0.45); }
.hg-pick-tools { display: flex; gap: 1px; flex: none; }
.hg-pick-tools button {
  background: none; border: none; color: rgba(234,244,255,0.4);
  padding: 4px; border-radius: 6px; display: grid;
}
.hg-pick-tools button:hover { color: #fff; background: rgba(234,244,255,0.1); }
.hg-pick-actions { display: grid; grid-template-columns: 1fr 90px; gap: 8px; margin-top: 12px; }
.hg-pick-actions .hg-danger { margin: 0; }

/* when the hero is off, the carousel heading becomes the page's opener */
.hg-root.no-hero .hg-carousel { padding-top: clamp(30px, 5vw, 58px); }
.hg-root.no-hero .hg-carousel-head .hg-h2 { font-size: clamp(34px, 6.5vw, 68px); }
.hg-head-actions { display: flex; flex-wrap: wrap; gap: 10px; }

.hg-data-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
.hg-data-row .hg-upbtn { display: grid; place-items: center; }
.hg-json {
  font-family: ui-monospace, monospace; font-size: 10.5px; line-height: 1.4;
  white-space: pre; overflow-x: auto; margin-bottom: 6px;
}

/* responsive */
@media (max-width: 900px) {
  .hg-grid { grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr)); }
  .hg-modal-grid { grid-template-columns: 1fr; }
  .hg-nav-links a { display: none; }
}
@media (max-width: 560px) {
  .hg-root { --slideH: clamp(200px, 34vh, 300px); --slideMax: 84vw; }
  .hg-grid { grid-template-columns: 1fr; }
  .hg-slide-bar { flex-direction: column; align-items: stretch; }
  .hg-band { text-align: left; }
}
@media (prefers-reduced-motion: reduce) {
  .hg-root *, .hg-admin { animation: none !important; transition: none !important; }
  .hg-snow, .hg-waddler { display: none; }
  .hg-slide.is-active { transform: scale(1) !important; }
}
`;
