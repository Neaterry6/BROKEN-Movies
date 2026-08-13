// BROKEN Movies backend — focused server serving ONLY the endpoints the movie
// site needs, using the actual scrapers copied from the BROKEN API repo.
// Scraping stays server-side; nothing leaks to the browser.
const express = require("express");
const cors = require("cors");
const path = require("path");

const omni = require("./omniscrape");
const liveTv = require("./live-tv");
const movies = require("./movies");
const fzmovies = require("./fzmovies");
const anikoto = require("./anikoto");
const adult = require("./adult");
const auth = require("./auth");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// Security: rate-limit + block bots/scrapers on API & admin routes.
app.use(auth.securityMw);

// Seed a default admin if none exists (admin@broken.com / admin123).
(function seedAdmin() {
  try {
    const users = auth.loadUsers();
    if (!users.some((u) => u.role === "admin")) {
      const salt = require("crypto").randomBytes(8).toString("hex");
      users.push({ id: require("crypto").randomUUID(), name: "Admin", email: "admin@broken.com", password: require("crypto").createHmac("sha256", salt).update("admin123").digest("hex"), salt, role: "admin", created: Date.now() });
      auth.saveUsers(users);
    }
  } catch (e) { console.error("seedAdmin", e.message); }
})();

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error("ERR", err.message);
  res.status(500).json({ ok: false, error: err.message || "Internal error" });
});

// ---------- Auth ----------
app.post("/api/auth/signup", wrap(async (req, res) => {
  const r = auth.signup(req.body || {});
  if (r.error) return res.status(400).json({ ok: false, error: r.error });
  res.json({ ok: true, token: r.token, user: r.user });
}));

app.post("/api/auth/login", wrap(async (req, res) => {
  const r = auth.login(req.body || {});
  if (r.error) return res.status(401).json({ ok: false, error: r.error });
  res.json({ ok: true, token: r.token, user: r.user });
}));

app.get("/api/auth/me", wrap(async (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  const u = auth.authUser(token);
  if (!u) return res.status(401).json({ ok: false, error: "Unauthorized" });
  res.json({ ok: true, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));

// ---------- Admin ----------
function requireAdmin(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  const u = auth.authUser(token);
  if (!u) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (u.role !== "admin") return res.status(403).json({ ok: false, error: "Forbidden" });
  return u;
}

app.get("/admin/stats", wrap(async (req, res) => {
  const u = requireAdmin(req, res); if (!u) return;
  const s = auth.adminStats();
  res.json({ ok: true, stats: { totalUsers: s.users, admins: s.admins }, users: s.registered.map((x) => ({ id: x.id, name: x.name, email: x.email, role: x.role, created: x.created })) });
}));

app.post("/admin/users/:id/role", wrap(async (req, res) => {
  const admin = requireAdmin(req, res); if (!admin) return;
  const users = auth.loadUsers();
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: "User not found" });
  target.role = req.body && req.body.role === "admin" ? "admin" : "user";
  auth.saveUsers(users);
  res.json({ ok: true });
}));

app.post("/admin/users/:id/delete", wrap(async (req, res) => {
  const admin = requireAdmin(req, res); if (!admin) return;
  let users = auth.loadUsers();
  users = users.filter((u) => u.id !== req.params.id);
  auth.saveUsers(users);
  res.json({ ok: true });
}));

// ---------- Core handlers the site uses ----------
const SEARCH_TYPES = { all: 0, movie: 1, tv: 2, anime: 3, short: 7 };

// Universal search (movies + tv + anime together)
app.get("/api/search", wrap(async (req, res) => {
  const { q, type = "all", page = 1 } = req.query;
  if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
  try {
    const r = await omni.search({ keyword: q, page: Number(page), perPage: Number(req.query.per_page || 60), type: SEARCH_TYPES[type] ?? 0 });
    if (r.results && r.results.length) return res.json({ ok: true, ...r });
    throw new Error("empty");
  } catch (e) {
    // Fallback: FZMovies (Nigerian/foreign movies) when OmniSave fails or returns nothing.
    const fz = await fzmovies.search(q, Number(req.query.per_page || 20));
    return res.json({ ok: true, source: "fzmovies", query: q, results: (fz.results || []).map((m) => ({ ...m, title: m.title, detailPath: m.url })) });
  }
}));

// FZMovies search fallback
app.get("/api/fzmovies/search", wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
  res.json(await fzmovies.search(q, Number(req.query.limit || 20)));
}));

// FZMovies direct download / stream (by movie URL)
app.get("/api/fzmovies/download", wrap(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: "Missing 'url'" });
  res.json(await fzmovies.getDirect(url));
}));

// FZMovies details
app.get("/api/fzmovies/detail", wrap(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: "Missing 'url'" });
  res.json(await fzmovies.details(url));
}));

// Anime fallback source — Anikoto (recent anime + series episodes)
app.get("/api/anime/recent", wrap(async (req, res) => {
  res.json(await anikoto.recent(Number(req.query.page || 1), Number(req.query.per_page || 24)));
}));

app.get("/api/anime/series", wrap(async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: "Missing 'id'" });
  res.json(await anikoto.series(id));
}));

// Detail by path
app.get("/api/detail", wrap(async (req, res) => {
  const { path: p } = req.query;
  if (!p) return res.status(400).json({ ok: false, error: "Missing 'path'" });
  res.json({ ok: true, ...(await omni.detail(p)) });
}));

// Download / stream links
app.get("/api/download", wrap(async (req, res) => {
  const { path: p, id, se = 0, ep = 0 } = req.query;
  if (!p || !id) return res.status(400).json({ ok: false, error: "Missing 'path' and 'id'" });
  res.json({ ok: true, ...(await omni.download(id, p, { se: Number(se), ep: Number(ep) })) });
}));

// Live TV channels
app.get("/api/tv-channels", wrap(async (req, res) => {
  const { country, category, limit } = req.query;
  let channels = liveTv.catalog;
  if (category && category !== "all") channels = liveTv.byCategory(category);
  channels = channels.slice(0, Number(limit || 60));
  res.json({ ok: true, count: channels.length, channels });
}));

// TV live streams
app.get("/api/tv/live", wrap(async (req, res) => {
  const { q, category, id } = req.query;
  if (id) { const ch = liveTv.get(id); return ch ? res.json({ ok: true, channel: ch }) : res.status(404).json({ ok: false, error: "Not found" }); }
  const list = q ? liveTv.search(q) : liveTv.byCategory(category);
  res.json({ ok: true, count: list.length, category: category || "all", channels: list });
}));

// HLS proxy so m3u8 streams play through one origin (avoids CORS/mixed-content)
app.get("/api/tv/live/proxy", wrap(async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: "Missing 'url'" });
  const target = decodeURIComponent(url);
  if (!/^https?:\/\//.test(target)) return res.status(400).json({ ok: false, error: "Invalid url" });
  const r = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" } });
  if (!r.ok) return res.status(502).json({ ok: false, error: "Upstream " + r.status });
  const body = await r.text();
  const base = target.substring(0, target.lastIndexOf("/") + 1);
  const rewritten = body.replace(/^(?!https?:\/\/)(.+)$/gm, (m) => {
    const t = m.trim();
    if (!t || t.startsWith("#")) return m;
    return "/api/tv/live/proxy?url=" + encodeURIComponent(base + t);
  });
  res.set("Content-Type", "application/vnd.apple.mpegurl");
  res.set("Cache-Control", "no-store");
  res.send(rewritten);
}));

// ---------- Adult (18+) content: porn / hentai / dirty movies via XNXX ----------
app.get("/api/adult/search", wrap(async (req, res) => {
  const { pool = "porn", page = 1, limit = 36 } = req.query;
  if (!adult.POOLS[pool]) return res.status(400).json({ ok: false, error: "Unknown pool" });
  res.json({ ok: true, ...(await adult.searchPool(pool, Number(page), Number(limit))) });
}));

app.get("/api/adult/stream", wrap(async (req, res) => {
  const { url } = req.query;
  if (!url || !/^https?:\/\/(www\.)?xnxx\.com\//.test(url)) return res.status(400).json({ ok: false, error: "Invalid URL" });
  res.json({ ok: true, ...(await adult.videoStream(url)) });
}));

app.get("/api/adult/categories", wrap(async (req, res) => {
  res.json({ ok: true, categories: adult.CATEGORIES });
}));

// ---------- Mount the full movies/anime module ----------
movies(app, wrap);

// ---------- Static site ----------
app.use(express.static(path.join(__dirname, "..")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("BROKEN Movies backend on :" + PORT));
