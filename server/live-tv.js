// LIVE TV API — direct m3u8 streams curated from the channel database.
const fs = require("fs");
const path = require("path");

let CHANNELS = [];
try {
  CHANNELS = JSON.parse(fs.readFileSync(path.join(__dirname, "live-tv-data.json"), "utf8"));
} catch (e) {
  CHANNELS = [];
}

// Give each channel a stable id + a category guess from its name.
const CATEGORY_RULES = [
  [/cartoon|toon|disney|nick|kids|pbs|jr|tiny.?pop|popkid/i, "Kids & Cartoons"],
  [/bollywood|shemaroo|anandtv|hindi|movie|film|action|western|classic|nostalgia|halltime|cinema/i, "Movies"],
  [/news|cnn|fox|bbc|ntv|aljazeera|sky news/i, "News"],
  [/sport|espn|football|tennis|cricket/i, "Sports"],
  [/music|mtv|vox|radio/i, "Music"],
  [/entertain|channel|tv|drama|series|reality/i, "Entertainment"],
];

function categorize(name) {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(name)) return cat;
  }
  return "Other";
}

const catalog = CHANNELS.map((c, i) => {
  const name = c.name || "Channel " + (i + 1);
  return {
    id: "ltv_" + (i + 1),
    name,
    source: c.source || "",
    category: categorize(name),
    url: c.url,
  };
});

function search(q) {
  const term = (q || "").toLowerCase().trim();
  if (!term) return catalog;
  return catalog.filter((c) => c.name.toLowerCase().includes(term) || c.source.includes(term) || c.category.toLowerCase().includes(term));
}

function byCategory(cat) {
  const t = (cat || "").toLowerCase().trim();
  if (!t || t === "all") return catalog;
  return catalog.filter((c) => c.category.toLowerCase() === t);
}

function get(id) {
  return catalog.find((c) => c.id === id) || null;
}

function categories() {
  const map = {};
  catalog.forEach((c) => { map[c.category] = (map[c.category] || 0) + 1; });
  return Object.entries(map).map(([name, count]) => ({ name, count }));
}

module.exports = { catalog, categories, search, byCategory, get };
