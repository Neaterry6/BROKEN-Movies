// Adult content module — XNXX scrapes for porn / hentai / erotic ("dirty") movies.
// Search is paginated (endless scroll), each result has a direct MP4 stream.
const XNXX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const BASE = "https://www.xnxx.com";

// Curated search pools so each 18+ tab shows endless, varied content.
const POOLS = {
  porn: ["porn", "milf", "blowjob", "amateur", "big ass", "teen", "anal", "bbc", "stepmom", "lesbian", "threesome", "creampie", "gangbang", "fetish"],
  hentai: ["hentai", "hentai 3d", "hentai uncensored", "hentai cosplay", "rule34", "hentai anime", "ahegao", "tentacle hentai", "milf hentai"],
  dirty: ["milf", "stepmom", "cheating wife", "erotic massage", "sexy secretary", "housewife", "office affair", "redhead", "latina", "ebony"],
  milf: ["milf", "stepmom", "milf mature", "horny milf", "mature milf"],
  asian: ["asian", "japanese", "korean", "thai", "chinese girl"],
  ebony: ["ebony", "black girl", "black beauty", "chocolate"],
  teen18: ["barely legal", "18 year old", "legal teen", "college girl"],
  anal: ["anal", "anal sex", "anal creampie", "dp"],
  lesbian: ["lesbian", "lesbian scissoring", "girl on girl", "strap on"],
  threesome: ["threesome", "threesome mff", "threesome mfm", "gangbang"],
  mature: ["mature", "milf mature", "granny", "cougar", "horny mom"],
};
// Named curated categories (shown as pills so 18+ is browsable, not one pool).
const CATEGORIES = [
  { key: "porn", name: "Porn" },
  { key: "hentai", name: "Hentai" },
  { key: "dirty", name: "Dirty Movies" },
  { key: "milf", name: "MILF" },
  { key: "asian", name: "Asian" },
  { key: "ebony", name: "Ebony" },
  { key: "teen18", name: "18+" },
  { key: "anal", name: "Anal" },
  { key: "lesbian", name: "Lesbian" },
  { key: "threesome", name: "Threesome" },
  { key: "mature", name: "Mature" },
];

async function fetchHtml(url, ref) {
  const r = await fetch(url, {
    headers: { "User-Agent": XNXX_UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9", ...(ref ? { Referer: ref } : {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("XNXX " + r.status);
  return r.text();
}

function decodeEntities(s) {
  return (s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&period;/g, ".").replace(/&comma;/g, ",");
}

// Search a pool (paginated). Returns { pool, page, videos: [{title, url, thumb}] }
async function searchPool(pool, page = 1, limit = 36) {
  const poolList = POOLS[pool] || POOLS.porn;
  const term = poolList[(page - 1) % poolList.length];
  const url = `${BASE}/search/${encodeURIComponent(term)}/${Math.max(1, Math.ceil((page - 1) / poolList.length) + 1)}`;
  const html = await fetchHtml(url, `${BASE}/`);
  const links = [...html.matchAll(/href="(\/video-[^"]+)"/g)].map((m) => m[1]);
  const thumbs = [...html.matchAll(/data-src="(https:[^"]+\.(?:jpg|jpeg|png)[^"]*)"/g)].map((m) => m[1]);
  const seen = new Set();
  const videos = [];
  for (let i = 0; i < links.length && videos.length < limit; i++) {
    const href = links[i];
    if (seen.has(href)) continue;
    seen.add(href);
    videos.push({
      url: BASE + href,
      title: decodeEntities(href.split("/").pop().split("_").join(" ").replace(/\.$/, "")),
      thumb: thumbs[i] || "",
      duration: "",
    });
  }
  return { pool, term, page, count: videos.length, videos };
}

// Get direct MP4 stream + thumb for a video page.
async function videoStream(url) {
  const html = await fetchHtml(url, `${BASE}/`);
  const mp4s = [...html.matchAll(/https:\/\/[^"']+\.mp4\?[^"']*/g)].map((m) => m[0].replace(/,$/, ""));
  const uniq = [...new Set(mp4s)];
  // prefer 720p/1080p
  const hq = uniq.find((u) => /720p|1080p/.test(u)) || uniq[uniq.length - 1] || uniq[0] || null;
  const t = html.match(/<title>([^<]+)/);
  const thumbM = html.match(/(https:\/\/[^"']+\.(?:jpg|jpeg|png)[^"']*)/);
  return {
    url,
    title: t ? decodeEntities(t[1].replace(/\s*-\s*XNXX\.COM/i, "")) : "",
    stream: hq,
    sources: uniq,
    thumb: thumbM ? thumbM[1] : "",
  };
}

module.exports = { searchPool, videoStream, POOLS, CATEGORIES };
