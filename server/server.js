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

const app = express();
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error("ERR", err.message);
  res.status(500).json({ ok: false, error: err.message || "Internal error" });
});

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

// ---------- Mount the full movies/anime module ----------
movies(app, wrap);

// ---------- Static site ----------
app.use(express.static(path.join(__dirname, "..")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("BROKEN Movies backend on :" + PORT));
