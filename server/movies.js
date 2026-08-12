// MOVIES — comprehensive movie/TV endpoints via OmniSave (real data + download links).
// Homepage, series, downloads, BL series, Nollywood, genres, trending, etc.
const omni = require("./omniscrape");

const SEARCH_TYPES = { all: 0, movie: 1, tv: 2, anime: 3, short: 7 };

// Curated keyword pools per category (searched live on OmniSave).
const POOLS = {
  trending: ["2024", "2025", "blockbuster", "action movie", "romance", "thriller"],
  action: ["action movie", "marvel", "fast and furious", "john wick"],
  comedy: ["comedy", "funny movie", "comedy series"],
  romance: ["romance", "romantic movie", "love story"],
  horror: ["horror", "scary movie", "thriller horror"],
  drama: ["drama", "emotional movie", "drama series"],
  scifi: ["sci-fi", "science fiction", "star wars", "interstellar"],
  animation: ["animation", "animated movie", "disney", "pixar"],
  nollywood: ["nollywood", "nigerian movie", "nigerian film", "yoruba movie", "hausa movie"],
  bl: ["BL series", "boys love", "BL drama", "thai bl"],
  korean: ["korean drama", "kdrama", "korean movie", "korean series"],
  kdrama: ["korean drama", "kdrama", "korean series"],
  tvdrama: ["tv series", "series", "drama series", "netflix series"],
  series: ["tv series", "series", "netflix series", "amazon series", "hbo series"],
  documentary: ["documentary", "docu series", "nature documentary"],
};

// Curated keyword pools for ANIME (searched live on OmniSave, type 3).
const ANIME_POOLS = {
  top: ["naruto", "one piece", "demon slayer", "jujutsu kaisen", "attack on titan", "dragon ball", "my hero academia", "spy x family", "one punch man", "solo leveling"],
  action: ["action anime", "naruto", "bleach", "sword art online"],
  fantasy: ["fantasy anime", "re zero", "mushoku tensei", "that time i got reincarnated"],
  romance: ["romance anime", "kimi ni todoke", "horimiya", "your lie in april"],
  comedy: ["comedy anime", "konosuba", "gintama", "grand blue"],
  drama: ["drama anime", "anohana", "clannad", "violet evergarden"],
  horror: ["horror anime", "tokyo ghoul", "another", "parasyte"],
  scifi: ["sci-fi anime", "steins gate", "cowboy bebop", "psycho pass"],
};

async function poolSearch(pool, type, limit = 40, page = 1) {
  const keywords = POOLS[pool] || POOLS.trending;
  const results = [];
  // pull multiple pages + all keywords to gather as many unique titles as possible
  const perKw = Math.max(3, Math.min(20, Math.ceil(limit / keywords.length / 2)));
  for (const kw of keywords) {
    for (let p = page; p <= page + 1 && results.length < limit; p++) {
      try {
        const r = await omni.search({ keyword: kw, page: p, perPage: perKw, type: SEARCH_TYPES[type] ?? 0 });
        results.push(...(r.results || []));
      } catch {}
    }
    if (results.length >= limit) break;
  }
  // dedupe by subjectId, then by title
  const seen = new Set(); const out = [];
  for (const it of results) {
    const key = it.subjectId || (it.title || "").toLowerCase().trim();
    if (key && !seen.has(key)) { seen.add(key); out.push(it); }
  }
  // Fallback: if OmniSave came back empty (rate-limited/blocked), pull from FZMovies
  // (independent source) so the app never shows an empty page.
  if (!out.length) {
    try {
      const fzm = require("./fzmovies");
      const q = (keywords[0] || "hollywood").replace(/\s+/g, " ");
      const fz = await fzm.search(q, Math.min(limit, 24));
      for (const it of (fz.results || [])) {
        out.push({ id: "fz_" + (it.url || "").split("/").pop(), title: it.title, cover: it.poster || "", detailPath: it.url, type: "movie", typeId: 1, fzmovies: true });
      }
    } catch {}
  }
  return out.slice(0, limit);
}

// Search anime (and TV shows tagged as anime) via OmniSave with "plenty" of results.
async function animePoolSearch(pool, limit = 40, page = 1) {
  const keywords = ANIME_POOLS[pool] || ANIME_POOLS.top;
  const results = [];
  const perKw = Math.max(3, Math.min(20, Math.ceil(limit / keywords.length / 2)));
  for (const kw of keywords) {
    for (let p = page; p <= page + 1 && results.length < limit; p++) {
      try {
        // OmniSave tags anime as TV (subjectType 2), so search type tv + filter to anime-looking titles
        const r = await omni.search({ keyword: kw, page: p, perPage: perKw, type: SEARCH_TYPES.tv });
        results.push(...(r.results || []));
      } catch {}
    }
    if (results.length >= limit) break;
  }
  // dedupe by subjectId then title
  const seen = new Set(); const out = [];
  for (const it of results) {
    const title = (it.title || "").toLowerCase().trim();
    const isAnimeLike = /anime|naruto|one piece|demon slayer|jujutsu|attack on titan|dragon ball|my hero|spy x family|one punch|solo leveling|bleach|sword art|tokyo ghoul|frieren|chainsaw|kimetsu|re:zero|re zero|isekai|.hack/.test(title);
    const key = it.subjectId || title;
    // Keep anime-named results OR any result that carries hasResource (for volume)
    if (key && !seen.has(key) && (isAnimeLike || it.hasResource)) { seen.add(key); out.push(it); }
  }
  return out.slice(0, limit);
}

module.exports = (app, wrap) => {
  // ===== MOVIE HOMEPAGE =====
  app.get("/api/movie/home", wrap(async (req, res) => {
    // add a trending/action fallback pool for backfilling empty sections
    const [trending, nollywood, action, korean, bl, comedy, fallback] = await Promise.allSettled([
      poolSearch("trending", "movie", 40),
      poolSearch("nollywood", "movie", 30),
      poolSearch("action", "movie", 30),
      poolSearch("korean", "tv", 30),
      poolSearch("bl", "tv", 30),
      poolSearch("comedy", "movie", 30),
      poolSearch("trending", "movie", 60),
    ]);
    const section = (v) => (v.status === "fulfilled" ? v.value : []);
    const fb = section(fallback);
    const dedupeFill = (arr, from) => {
      const out = (arr || []).slice();
      const seen = new Set(out.map((x) => x.subjectId || (x.title || "").toLowerCase().trim()));
      for (const it of from || []) {
        const k = it.subjectId || (it.title || "").toLowerCase().trim();
        if (k && !seen.has(k)) { seen.add(k); out.push(it); }
        if (out.length >= 30) break;
      }
      return out;
    };
    res.json({
      ok: true,
      homepage: {
        trendingNow: section(trending),
        nollywood: dedupeFill(section(nollywood), fb),
        actionMovies: dedupeFill(section(action), fb),
        koreanDramas: dedupeFill(section(korean), fb),
        blSeries: dedupeFill(section(bl), fb),
        comedy: dedupeFill(section(comedy), fb),
      },
    });
  }));

  // ===== BL HOMEPAGE =====
  app.get("/api/bl/home", wrap(async (req, res) => {
    const [thai, korean, japanese, chinese, popular, newbl] = await Promise.allSettled([
      poolSearch("bl", "tv", 10), poolSearch("korean", "tv", 8),
      omni.search({ keyword: "BL japan", page: 1, perPage: 8, type: SEARCH_TYPES.tv }).then((r) => r.results),
      omni.search({ keyword: "BL china", page: 1, perPage: 8, type: SEARCH_TYPES.tv }).then((r) => r.results),
      omni.search({ keyword: "BL series", page: 1, perPage: 10, type: SEARCH_TYPES.tv }).then((r) => r.results),
      omni.search({ keyword: "boys love", page: 1, perPage: 8, type: SEARCH_TYPES.tv }).then((r) => r.results),
    ]);
    const s = (v) => (v.status === "fulfilled" ? v.value : []);
    res.json({ ok: true, blHomepage: { trendingBL: s(thai), korean: s(korean), japanese: s(japanese), chinese: s(chinese), popular: s(popular), latest: s(newbl) } });
  }));

  // ===== HOLLYWOOD HOMEPAGE =====
  app.get("/api/hollywood/home", wrap(async (req, res) => {
    const [popular, blockbuster, action, romance, thriller, sciFi] = await Promise.allSettled([
      poolSearch("trending", "movie", 10), poolSearch("action", "movie", 8),
      omni.search({ keyword: "hollywood blockbuster", page: 1, perPage: 8, type: SEARCH_TYPES.movie }).then((r) => r.results),
      omni.search({ keyword: "hollywood romance", page: 1, perPage: 8, type: SEARCH_TYPES.movie }).then((r) => r.results),
      poolSearch("horror", "movie", 8),
      poolSearch("scifi", "movie", 8),
    ]);
    const s = (v) => (v.status === "fulfilled" ? v.value : []);
    res.json({ ok: true, hollywoodHomepage: { popular: s(popular), action: s(action), blockbusters: s(blockbuster), romance: s(romance), thriller: s(thriller), sciFi: s(sciFi) } });
  }));

  // ===== MOVIE HOMEPAGE (flat list for easier consumption) =====
  app.get("/api/movie/home/trending", wrap(async (req, res) => {
    res.json({ ok: true, category: "trending", movies: await poolSearch("trending", "movie", Math.min(Number(req.query.limit || 60), 120)) });
  }));

  // ===== MOVIE SEARCH (dedicated) =====
  app.get("/api/movie/search", wrap(async (req, res) => {
    const { q, page = 1, per_page = 15 } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
    const r = await omni.search({ keyword: q, page: Number(page), perPage: Number(per_page), type: SEARCH_TYPES.movie });
    res.json({ ok: true, ...r });
  }));

  // ===== SERIES SEARCH / TV =====
  app.get("/api/series", wrap(async (req, res) => {
    const page = Number(req.query.page || 1);
    if (req.query.q) {
      const r = await omni.search({ keyword: req.query.q, page, perPage: Number(req.query.per_page || 15), type: SEARCH_TYPES.tv });
      return res.json({ ok: true, category: "series", ...r });
    }
    const results = await Promise.allSettled(POOLS.tvdrama.map((q) => omni.search({ keyword: q, page: 1, perPage: 4, type: SEARCH_TYPES.tv })));
    const series = [];
    results.forEach((r) => { if (r.status === "fulfilled") series.push(...r.value.results); });
    res.json({ ok: true, category: "series", series: series.slice(0, 30) });
  }));
  app.get("/api/series/search", wrap(async (req, res) => {
    const { q, page = 1, per_page = 15 } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
    const r = await omni.search({ keyword: q, page: Number(page), perPage: Number(per_page), type: SEARCH_TYPES.tv });
    res.json({ ok: true, category: "series", ...r });
  }));

  // ===== ANIME (real data + downloads via OmniSave) =====
  app.get("/api/anime/home", wrap(async (req, res) => {
    const [top, action, romance, fantasy, comedy, horror] = await Promise.allSettled([
      animePoolSearch("top", 40), animePoolSearch("action", 30),
      animePoolSearch("romance", 30), animePoolSearch("fantasy", 30),
      animePoolSearch("comedy", 30), animePoolSearch("horror", 30),
    ]);
    const s = (v) => (v.status === "fulfilled" ? v.value : []);
    res.json({
      ok: true,
      animeHomepage: { topAnime: s(top), actionAnime: s(action), romanceAnime: s(romance), fantasyAnime: s(fantasy), comedyAnime: s(comedy), horrorAnime: s(horror) },
    });
  }));

  app.get("/api/anime/top", wrap(async (req, res) => {
    res.json({ ok: true, category: "anime", anime: await animePoolSearch("top", Math.min(Number(req.query.limit || 100), 200)) });
  }));

  app.get("/api/anime/all", wrap(async (req, res) => {
    res.json({ ok: true, category: "anime", anime: await animePoolSearch("top", Math.min(Number(req.query.limit || 100), 200)) });
  }));

  app.get("/api/anime/search", wrap(async (req, res) => {
    const { q, page = 1, per_page = 30 } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
    const r = await omni.search({ keyword: q, page: Number(page), perPage: Math.min(Number(per_page), 60), type: SEARCH_TYPES.tv });
    res.json({ ok: true, category: "anime", ...r });
  }));

  app.get("/api/anime/genre/:genre", wrap(async (req, res) => {
    const { genre } = req.params;
    const pool = ANIME_POOLS[genre] ? genre : "top";
    res.json({ ok: true, genre, anime: await animePoolSearch(pool, Math.min(Number(req.query.limit || 60), 150)) });
  }));

  app.get("/api/anime/detail", wrap(async (req, res) => {
    const { path: p } = req.query;
    if (!p) return res.status(400).json({ ok: false, error: "Missing 'path'" });
    res.json({ ok: true, ...(await omni.detail(p)) });
  }));

  app.get("/api/anime/download", wrap(async (req, res) => {
    const { path: p, id, se = 1, ep = 1 } = req.query;
    if (!p || !id) return res.status(400).json({ ok: false, error: "Missing 'path' and 'id'" });
    const r = await omni.download(id, p, { se: Number(se), ep: Number(ep) });
    res.json({ ok: true, ...r });
  }));

  app.get("/api/anime/stream", wrap(async (req, res) => {
    const { path: p, id, se = 1, ep = 1 } = req.query;
    if (!p || !id) return res.status(400).json({ ok: false, error: "Missing 'path' and 'id'" });
    const r = await omni.download(id, p, { se: Number(se), ep: Number(ep) });
    // Provide the best (highest) playable stream URL for direct <video> playback
    const byRes = (r.downloads || []).slice().sort((a, b) => (b.resolution || 0) - (a.resolution || 0));
    res.json({ ok: true, ...r, streamUrl: (byRes[0] && byRes[0].url) || null });
  }));

  // ===== BL SERIES =====
  app.get("/api/bl", wrap(async (req, res) => {
    res.json({ ok: true, category: "BL series", series: await poolSearch("bl", "tv", Math.min(Number(req.query.limit || 60), 120)) });
  }));
  app.get("/api/bl/search", wrap(async (req, res) => {
    const { q, page = 1, per_page = 15 } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
    const r = await omni.search({ keyword: `BL ${q}`, page: Number(page), perPage: Number(per_page), type: SEARCH_TYPES.tv });
    res.json({ ok: true, category: "BL series", ...r });
  }));

  // ===== NOLLYWOOD =====
  app.get("/api/nollywood", wrap(async (req, res) => {
    res.json({ ok: true, category: "Nollywood", movies: await poolSearch("nollywood", "movie", Math.min(Number(req.query.limit || 60), 120)) });
  }));
  app.get("/api/nollywood/search", wrap(async (req, res) => {
    const { q, page = 1, per_page = 15 } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: "Missing 'q'" });
    const r = await omni.search({ keyword: q, page: Number(page), perPage: Number(per_page), type: SEARCH_TYPES.movie });
    res.json({ ok: true, category: "Nollywood", ...r });
  }));

  // ===== KOREAN DRAMA =====
  app.get("/api/kdrama", wrap(async (req, res) => {
    res.json({ ok: true, category: "Korean dramas", series: await poolSearch("kdrama", "tv", Math.min(Number(req.query.limit || 60), 120)) });
  }));

  // ===== GENRE-BASED MOVIES =====
  app.get("/api/movie/genre/:genre", wrap(async (req, res) => {
    const { genre } = req.params;
    res.json({ ok: true, genre, movies: await poolSearch(genre, "movie", Math.min(Number(req.query.limit || 60), 120)) });
  }));

  // ===== MOVIE DETAIL =====
  app.get("/api/movie/detail", wrap(async (req, res) => {
    const { path: p } = req.query;
    if (!p) return res.status(400).json({ ok: false, error: "Missing 'path'" });
    res.json({ ok: true, ...(await omni.detail(p)) });
  }));

  // ===== MOVIE DOWNLOAD =====
  app.get("/api/movie/download", wrap(async (req, res) => {
    const { path: p, id, se = 0, ep = 0 } = req.query;
    if (!p || !id) return res.status(400).json({ ok: false, error: "Missing 'path' and 'id'" });
    const r = await omni.download(id, p, { se: Number(se), ep: Number(ep) });
    res.json({ ok: true, ...r });
  }));

  // ===== SERIES DOWNLOAD =====
  app.get("/api/series/download", wrap(async (req, res) => {
    const { path: p, id, se = 1, ep = 1 } = req.query;
    if (!p || !id) return res.status(400).json({ ok: false, error: "Missing 'path' and 'id'" });
    const r = await omni.download(id, p, { se: Number(se), ep: Number(ep) });
    res.json({ ok: true, ...r });
  }));
};
