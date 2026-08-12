// Anikoto anime scraper — recent anime, series detail, episodes, stream embeds.
// API: anikotoapi.site (free, no auth).

const BASE = "https://anikotoapi.site";

async function j(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "anime request failed");
  return json;
}

// Recent anime (home/trending feed)
async function recent(page = 1, perPage = 20) {
  const json = await j(`${BASE}/recent-anime?page=${page}&per_page=${perPage}`);
  return {
    page,
    domains: json.anikoto_domains || [],
    results: (json.data || []).map(normalizeAnime),
  };
}

// Series detail + episodes + stream embeds
async function series(id) {
  const json = await j(`${BASE}/series/${id}`);
  const data = json.data || {};
  const anime = data.anime || {};
  const episodes = data.episodes || [];
  return {
    id: anime.id,
    title: anime.title,
    alternative: anime.alternative || "",
    native: anime.native || "",
    slug: anime.slug,
    rating: anime.rating,
    poster: anime.poster,
    cover: anime.cover || anime.backdrop || null,
    isSub: anime.is_sub,
    isDub: anime.is_dub,
    description: anime.description || "",
    aired: anime.aired,
    season: anime.season,
    year: anime.year,
    genres: anime.genres || anime.terms_by_type?.genre || [],
    domains: json.anikoto_domains || [],
    episodes: episodes.map((ep) => ({
      id: ep.id,
      number: ep.number || ep.ep,
      title: ep.title || ep.name || "",
      sub: ep.embed_url?.sub || ep.url_sub || null,
      dub: ep.embed_url?.dub || ep.url_dub || null,
    })),
    totalEpisodes: episodes.length,
  };
}

function normalizeAnime(a) {
  return {
    id: a.id,
    title: a.title,
    alternative: a.alternative || "",
    native: a.native || "",
    slug: a.slug,
    rating: a.rating,
    poster: a.poster,
    cover: a.background_image || a.cover || a.backdrop || null,
    isSub: a.is_sub,
    isDub: a.is_dub,
    description: a.description || "",
    season: a.season,
    year: a.year,
    genres: a.genres || a.terms_by_type?.genre || [],
    producers: a.terms_by_type?.producers || [],
    studios: a.terms_by_type?.studios || [],
    status: a.status || null,
    duration: a.duration || null,
  };
}

module.exports = { recent, series };
