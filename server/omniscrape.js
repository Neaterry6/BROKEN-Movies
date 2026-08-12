// OmniSave (videodownloader.site) scraper — movies, TV series, downloads.
// API: h5-api.aoneroom.com via anonymous JWT token flow.

const BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff";
const ORIGIN = "https://videodownloader.site";

let token = null;
let tokenFetched = 0;
const TOKEN_TTL = 60 * 60 * 1000; // refresh hourly

async function getToken() {
  if (token && Date.now() - tokenFetched < TOKEN_TTL) return token;
  try {
    const res = await fetch(`${BASE}/subject/search-suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-lang": "en",
        "X-Site-Domain": "videodownloader.site",
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
      },
      body: "{}",
    });
    const xuser = res.headers.get("x-user");
    if (xuser) {
      try { token = JSON.parse(xuser).token; } catch { token = xuser; }
    } else {
      // fallback: token in set-cookie
      const sc = res.headers.get("set-cookie") || "";
      const m = sc.match(/token=([^;]+)/);
      if (m) token = m[1];
    }
    tokenFetched = Date.now();
  } catch (e) {
    console.error("getToken error:", e.message);
  }
  return token;
}

async function authedHeaders(extra = {}) {
  const t = await getToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${t}`,
    "x-request-lang": "en",
    "X-Site-Domain": "videodownloader.site",
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
    ...extra,
  };
}

const TYPE_NAMES = { 0: "all", 1: "movie", 2: "tv", 3: "anime", 7: "short" };

// Normalize an OmniSave search item into a clean shape
function normalizeItem(i) {
  if (!i) return null;
  return {
    id: i.subjectId,
    title: i.title,
    type: TYPE_NAMES[i.subjectType] || "unknown",
    typeId: i.subjectType,
    releaseDate: i.releaseDate,
    year: i.releaseDate ? i.releaseDate.slice(0, 4) : null,
    rating: i.imdbRatingValue || null,
    genres: i.genre ? i.genre.split(",").map((g) => g.trim()).filter(Boolean) : [],
    cover: i.cover?.url || i.cover || null,
    description: i.description || "",
    duration: i.duration || null,
    country: i.countryName || null,
    languages: i.subtitles || "",
    hasResource: !!i.hasResource,
    detailPath: i.detailPath,
  };
}

// Search movies / TV / anime
async function search({ keyword, page = 1, perPage = 15, type = 0 }) {
  const headers = await authedHeaders();
  const res = await fetch(`${BASE}/subject/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ keyword, page, perPage, subjectType: type }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "search failed");
  const pager = json.data.pager || {};
  return {
    query: keyword,
    page: Number(pager.page || page),
    hasMore: !!pager.hasMore,
    total: pager.totalCount || 0,
    results: (json.data.items || []).map(normalizeItem).filter(Boolean),
  };
}

// Get full detail (metadata + seasons/episodes + cast)
async function detail(detailPath) {
  const headers = await authedHeaders({ Accept: "application/json" });
  const res = await fetch(`${BASE}/detail?detailPath=${encodeURIComponent(detailPath)}`, { headers });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "detail failed");
  const data = json.data || {};
  const subject = data.subject || {};
  const resource = data.resource || {};
  return {
    subject: normalizeItem(subject),
    description: subject.description,
    duration: subject.duration,
    year: subject.year || (subject.releaseDate ? subject.releaseDate.slice(0, 4) : null),
    dubs: (subject.dubs || []).map((d) => d.lanName || d.lan || d),
    staff: subject.staffList || [],
    trailer: subject.trailer?.videoAddress?.url || null,
    seasons: (resource.seasons || []).map((s) => ({
      season: s.se,
      maxEpisode: s.maxEp,
      resolutions: (s.resolutions || []).map((r) => ({ resolution: r.resolution, episodes: r.epNum })),
    })),
    source: resource.source || null,
    uploadedBy: resource.uploadBy || null,
  };
}

// Get direct download / stream links for a movie or episode
async function download(subjectId, detailPath, { se = 0, ep = 0 } = {}) {
  const headers = await authedHeaders({ Accept: "application/json" });
  const url = `${BASE}/subject/download?subjectId=${subjectId}&detailPath=${encodeURIComponent(detailPath)}&se=${se}&ep=${ep}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "download failed");
  const data = json.data || {};
  return {
    hasResource: !!data.hasResource,
    downloads: (data.downloads || []).map((d) => ({
      format: d.format || "MP4",
      resolution: d.resolution || null,
      size: d.size || null,
      url: d.url || null,
    })).filter((d) => d.url),
    captions: (data.captions || []).map((c) => ({
      language: c.lanName || c.lan,
      url: c.url,
    })).filter((c) => c.url),
  };
}

module.exports = { search, detail, download, getToken };
