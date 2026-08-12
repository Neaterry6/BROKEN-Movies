// FZMOVIES source — search + details + direct download links via cookie-session chain.
// Manual cookie handling (no axios-cookiejar-support) to avoid CJS/ESM conflicts.
const cheerio = require("cheerio");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const BASE = "https://fzmovies.host";

// A tiny session that persists Set-Cookie headers across requests.
function makeSession() {
  let cookies = "";
  return async function req(url, opts = {}) {
    const headers = {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      ...(opts.headers || {}),
    };
    if (cookies) headers.Cookie = cookies;
    if (opts.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body || undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeout || 30000),
    });
    // capture set-cookie
    const sc = res.headers.get("set-cookie");
    if (sc) {
      const parts = String(sc).split(",").map((p) => p.split(";")[0].trim()).filter(Boolean);
      const known = new Set(cookies ? cookies.split(";").map((c) => c.split("=")[0].trim()) : []);
      for (const p of parts) {
        const k = p.split("=")[0].trim();
        if (!known.has(k)) { cookies = cookies ? cookies + "; " + p : p; known.add(k); }
      }
    }
    return { status: res.status, headers: res.headers, text: await res.text() };
  };
}

async function search(q, limit = 10) {
  const req = makeSession();
  const r = await req(`${BASE}/csearch.php`, {
    method: "POST",
    body: new URLSearchParams({ searchname: q, searchby: "Name", category: "All", Search: "Search" }).toString(),
  });
  const $ = cheerio.load(r.text);
  const results = [];
  $("a[href*='movie-']").each((_, a) => {
    const href = $(a).attr("href");
    const title = $(a).find("b").text().trim() || $(a).text().trim();
    if (!href || !href.includes("movie-") || !href.endsWith(".htm")) return;
    if (results.some((x) => x.url === href)) return;
    results.push({ title, url: href.startsWith("http") ? href : `${BASE}/${href}` });
  });
  return { ok: true, query: q, count: Math.min(results.length, limit), source: "fzmovies", results: results.slice(0, limit) };
}

async function details(movieUrl) {
  const req = makeSession();
  const r = await req(movieUrl);
  const $ = cheerio.load(r.text);
  const text = (sel) => $(sel).text().trim();
  const title = text("h2, h1").split("(")[0].trim() || text("title").replace(/[_-]/g, " ").trim();
  const poster = $("img[itemprop='image'], .moviedesc img").first().attr("src") || "";
  const plot = text("textcolor1[itemprop='description'], .moviedesc").slice(0, 300);
  const genre = $("a[href*='genre']").map((_, a) => $(a).text().trim()).get().join(", ");
  const imdb = $("span[itemprop='sameAs']").text().trim();
  const imdbRating = text("textcolor11");
  const downloads = [];
  $("ul.moviesfiles li, .moviesfiles li").each((_, li) => {
    const a = $(li).find("a");
    const href = a.attr("href") || "";
    const label = a.text().trim();
    const size = $(li).find("dcounter").text().trim() || "";
    if (href.includes("download1.php") || label.toLowerCase().includes(".mp4")) {
      downloads.push({ label, url: href.startsWith("http") ? href : `${BASE}/${href}`, size, resolution: label.match(/(\d{3,4}p)/i)?.[1] || null });
    }
  });
  return { ok: true, source: "fzmovies", title, poster: poster.startsWith("http") ? poster : `${BASE}${poster}`, plot, genre, imdb, imdbRating, downloads };
}

async function resolveDownload(downloadUrl, movieUrl) {
  const req = makeSession();
  // establish the session cookie from the movie page first (download keys are session-bound)
  if (movieUrl) await req(movieUrl);
  const r1 = await req(downloadUrl);
  const $1 = cheerio.load(r1.text);
  const grab = (c) => c('input[name="download1"]').val() || c('input[name=download1]').attr("value") || c('input[value^="http"]').first().attr("value");
  const direct = grab($1) || (r1.text.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g) || [])[0];
  if (direct) return { ok: true, source: "fzmovies", directUrl: direct };
  const hrefs = $1("a").map((_, a) => $1(a).attr("href")).get();
  const device = $1('a:contains("DOWNLOAD THIS MOVIE")').attr("href")
    || hrefs.find((h) => h && h.includes("download.php"))
    || hrefs.find((h) => h && /download/i.test(h));
  if (!device) throw new Error("No download link found");
  const r2 = await req(device.startsWith("http") ? device : `${BASE}/${device}`);
  const $2 = cheerio.load(r2.text);
  const url = grab($2) || (r2.text.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g) || [])[0];
  if (!url) throw new Error("Could not resolve final download URL");
  return { ok: true, source: "fzmovies", directUrl: url };
}

// Get a direct CDN link for a movie in ONE session (movie page -> download1 -> download.php).
async function getDirect(movieUrl) {
  const req = makeSession();
  const r1 = await req(movieUrl);
  const $1 = cheerio.load(r1.text);
  const dl = $1('a:contains(".mp4")').attr("href");
  if (!dl) throw new Error("No download option found");
  const r2 = await req(dl.startsWith("http") ? dl : `${BASE}/${dl}`);
  const $2 = cheerio.load(r2.text);
  const hrefs = $2("a").map((_, a) => $2(a).attr("href")).get();
  const device = $2('a:contains("DOWNLOAD THIS MOVIE")').attr("href")
    || hrefs.find((h) => h && h.includes("download.php"))
    || hrefs.find((h) => h && /download/i.test(h));
  if (!device) {
    const direct = $2('input[name="download1"]').attr("value") || (r2.text.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g) || [])[0];
    if (direct) return { ok: true, source: "fzmovies", directUrl: direct };
    throw new Error("No download link found");
  }
  const r3 = await req(device.startsWith("http") ? device : `${BASE}/${device}`);
  const $3 = cheerio.load(r3.text);
  const url = $3('input[name="download1"]').attr("value")
    || $3('input[value^="http"]').first().attr("value")
    || (r3.text.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g) || [])[0];
  if (!url) throw new Error("Could not resolve final download URL");
  return { ok: true, source: "fzmovies", directUrl: url };
}

module.exports = { search, details, resolveDownload, getDirect };
