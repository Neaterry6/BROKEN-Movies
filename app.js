// BROKEN Movies — glassmorphism UI. Uses the dedicated same-origin backend
// (/api) when deployed, otherwise falls back to the BROKEN API.
const API_LOCAL = "/api";
const API_REMOTE = "https://api.brokenvzn.de5.net/api";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
let currentTab = "home";

// Reusable inline SVG icon set (no emoji). Each returns an <svg> string.
const S = (d, vb = "0 0 24 24") =>
  `<svg viewBox="${vb}" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  play: S('<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>'),
  trailer: S('<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M9 4v16M15 4v16M2 9h7M2 15h7M15 9h7M15 15h7"/>'),
  eps: S('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5M16 4v5"/>'),
  like: S('<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>'),
  share: S('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>'),
  heart: S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>'),
  heartFilled: S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" fill="currentColor" stroke="none"/>'),
  download: S('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  back: S('<polyline points="15 18 9 12 15 6"/>'),
  close: S('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  cinema: S('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
  tv: S('<rect x="2" y="7" width="20" height="13" rx="2"/><polyline points="17 2 12 7 7 2"/>'),
  globe: S('<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>'),
  mic: S('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>'),
  film: S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>'),
  popcorn: S('<path d="M6 10h12l-1.2 10H7.2L6 10z"/><path d="M5 10h14M7 10c0-2 .8-3.5 2.2-3.5.4-1.6 1.6-2.5 3-2.5 1.5 0 2.7 1 3 2.6 1.4 0 2.2 1.5 2.2 3.4"/><path d="M9 14v2M12 14v3M15 14v2"/>'),
  star: S('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/>'),
};

// LOGIN GATE
if (!localStorage.getItem("bm_user")) { window.location.href = "login.html"; }
const USER = localStorage.getItem("bm_user") || "user";

// ===== Persisted state =====
let MYLIST = JSON.parse(localStorage.getItem("bm_list") || "[]");
let HISTORY = JSON.parse(localStorage.getItem("bm_history") || "[]");
function saveList() { localStorage.setItem("bm_list", JSON.stringify(MYLIST)); }
function saveHistory() { localStorage.setItem("bm_history", JSON.stringify(HISTORY.slice(0, 50))); }
function isFav(id) { return MYLIST.some((x) => x.id === id); }
function toggleFav(m) {
  if (isFav(m.id)) MYLIST = MYLIST.filter((x) => x.id !== m.id);
  else MYLIST.unshift({ id: m.id, title: m.title, cover: m.cover, rating: m.rating, year: m.year, typeId: m.typeId, type: m.type, detailPath: m.detailPath, genre: m.genre, description: m.description });
  saveList();
  toast(isFav(m.id) ? "Added to My List" : "Removed from My List");
  if (currentTab === "mylist") go("mylist");
}
function recordProgress(id, title, cover, typeId, type, detailPath, se, ep, pct) {
  const ex = HISTORY.find((x) => x.id === id);
  if (ex) { ex.pct = pct; ex.se = se; ex.ep = ep; ex.lastWatched = Date.now(); }
  else HISTORY.unshift({ id, title, cover, typeId, type, detailPath, se, ep, pct, lastWatched: Date.now() });
  saveHistory();
}

const isSeriesType = (m) => (m.typeId === 2 || m.typeId === 3 || m.type === "tv" || m.type === "series" || m.type === "anime");
function fmtDur(d) {
  if (!d) return "";
  const n = parseInt(d, 10);
  if (isNaN(n)) return String(d);
  if (n > 1000) return Math.round(n / 60) + "m"; // seconds -> minutes
  return n + "m";
}

// ===== Cards =====
function card(m) {
  if (!m) return "";
  const img = m.cover || m.image || "";
  const data = encodeURIComponent(JSON.stringify(m));
  const type = isSeriesType(m) ? "SERIES" : "MOVIE";
  const fav = isFav(m.id) ? "on" : "";
  const pct = m.pct || 0;
  const prog = pct > 0 ? `<div class="progress"><div style="width:${pct}%"></div></div>` : "";
  const onClick = m.adult && m.adultUrl ? `playAdult('${encodeURIComponent(m.adultUrl)}','${esc((m.title || '').replace(/'/g, "\\'"))}')` : `openDetail('${data}')`;
  return `<div class="card" onclick="${onClick}">
    <button class="fav ${fav}" onclick="event.stopPropagation();toggleFav(${data})">${fav ? ICON.heartFilled : ICON.heart}</button>
    <div class="poster">
      <span class="badge ${isSeriesType(m) ? "" : "movie"}">${type}</span>
      ${img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="noimg" style="display:none">${ICON.film}</div>` : `<div class="noimg">${ICON.film}</div>`}
      ${pct > 0 ? `<div class="progress"><div style="width:${pct}%"></div></div>` : ""}
    </div>
    <div class="name">${esc(m.title || "Untitled")}</div>
    <div class="genre">${esc((m.genre || m.year || "").slice(0, 40))}</div>
  </div>`;
}

// ===== Featured hero =====
let heroIndex = 0, heroTimer = null;
function featured(m) {
  if (!m) return "";
  const img = m.cover || m.image || "";
  const data = encodeURIComponent(JSON.stringify(m));
  return `<div class="featured">
    ${img ? `<img src="${img}" onerror="this.style.display='none'">` : ""}
    <div class="scrim"></div>
    <div class="fbody">
      <div class="ftag">${isSeriesType(m) ? "Series" : "Featured"} · ${m.year || ""}</div>
      <div class="fname">${esc(m.title || "")}</div>
      <div class="fgenre">${esc((m.genre || "").slice(0, 60))}</div>
      <button class="fplay" onclick="openDetail('${data}')">${ICON.play} Watch Now</button>
    </div>
  </div>`;
}
function startHero(items) {
  clearInterval(heroTimer);
  const host = $("featuredHost");
  if (!host || !items || !items.length) return;
  heroIndex = 0;
  host.innerHTML = `<div class="hero-dots">${items.slice(0, 5).map((_, i) => `<span class="dot${i === 0 ? " active" : ""}" onclick="heroGo(${i})"></span>`).join("")}</div>` + `<div id="featuredSlides">${items.slice(0, 5).map(featured).join("")}</div>`;
  const slides = host.querySelectorAll("#featuredSlides .featured");
  slides.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));
  heroTimer = setInterval(() => { if (slides.length > 1) heroGo((heroIndex + 1) % slides.length); }, 6000);
}
function heroGo(i) {
  const host = $("featuredHost"); if (!host) return;
  heroIndex = i;
  host.querySelectorAll("#featuredSlides .featured").forEach((s, x) => { s.classList.add("fading"); setTimeout(() => { s.style.display = x === i ? "block" : "none"; s.classList.remove("fading"); }, 200); });
  host.querySelectorAll(".hero-dots .dot").forEach((d, x) => d.classList.toggle("active", x === i));
  clearInterval(heroTimer);
  const slides = host.querySelectorAll("#featuredSlides .featured");
  heroTimer = setInterval(() => { if (slides.length > 1) heroGo((heroIndex + 1) % slides.length); }, 6000);
}

// ===== Rows =====
function row(title, items, more) {
  if (!items || !items.length) return "";
  return `<div class="section-label-row"><div class="section-label">${esc(title)}<small>${items.length} title${items.length > 1 ? "s" : ""}</small></div>${more ? `<div class="see-all" onclick="${more}">See All ›</div>` : ""}</div>
    <div class="row">${items.map(card).join("")}</div>`;
}
function renderHome(sections, heroItems) {
  clearInterval(heroTimer);
  // No auto-playing hero banner on top — straight to the content rows.
  $("content").innerHTML = sections.map((s) => row(s.title, s.items, s.more)).join("");
}
// Infinite-scroll state
let infinite = null; // { loadMore, loading }
function resetInfinite() { infinite = null; }
function renderGrid(items, title, sub, loadMore) {
  const c = $("content");
  if (!items.length) { c.innerHTML = `<div class="empty">${ICON.popcorn}<span>Nothing here yet.</span></div>`; return; }
  c.innerHTML = `${title ? `<div class="page-title">${esc(title)}</div>` : ""}${sub ? `<div class="page-sub">${esc(sub)}</div>` : ""}<div class="grid" id="gridWrap">${items.map(card).join("")}</div>${loadMore ? `<div class="load-more"><div class="loader-logo" style="width:40px;height:40px"><div class="ring"></div><div class="badge" style="width:22px;height:22px">${ICON.popcorn}</div></div></div>` : ""}`;
  infinite = loadMore ? { loadMore, loading: false } : null;
}
function appendGridItems(newItems) {
  if (!newItems || !newItems.length) return false;
  const g = $("gridWrap");
  if (!g) return false;
  g.insertAdjacentHTML("beforeend", newItems.map(card).join(""));
  return true;
}
// Scroll near bottom -> load more
let scrollTicking = false;
$("app").addEventListener("scroll", () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    scrollTicking = false;
    const el = $("app");
    if (!infinite || infinite.loading) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600) {
      infinite.loading = true;
      infinite.loadMore();
    }
  });
}, { passive: true });

function showLoading() { $("content").innerHTML = '<div class="loading"><div class="loader-logo"><div class="ring"></div><div class="badge"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="none" stroke="#ff3b5c" stroke-width="4.5"/><circle cx="32" cy="32" r="29" fill="rgba(255,59,92,0.14)"/><polygon points="27,20 46,32 27,44" fill="#ff3b5c" stroke="#ff5c78" stroke-width="1.5"/><polygon points="26,19 46,32 26,45" fill="#fff" opacity="0.12"/></svg><span class="l-pop">🍿</span><span class="l-txt"><span class="w">BROKEN</span> <span class="r">MOVIES</span></span><span class="l-tag">Stream</span></div></div><div class="loader-text"><span>L</span><span>o</span><span>a</span><span>d</span><span>i</span><span>n</span><span>g</span></div></div>'; }
// Resilient fetch: try local backend first, then remote, with a retry.
async function api(ep, tries = 2) {
  const urls = [`${API_LOCAL}${ep}`, `${API_REMOTE}${ep}`];
  let lastErr = null;
  for (let t = 0; t < tries; t++) {
    for (const u of urls) {
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(45000) });
        if (r.ok) {
          const j = await r.json();
          if (j && j.ok !== false) return j;
          if (j && j.error) { lastErr = new Error(j.error); continue; }
        }
      } catch (e) { lastErr = e; }
    }
  }
  throw lastErr || new Error("Failed to reach content service");
}

function setCatPills(pills, active, fn) {
  const bar = $("catBar");
  bar.style.display = pills.length ? "flex" : "none";
  bar.innerHTML = pills.map((p) => `<div class="cat-pill${p === active ? " active" : ""}" onclick="${fn}('${p}')">${p}</div>`).join("");
}

// ===== Views =====
function setActive(tab) {
  currentTab = tab;
  document.querySelectorAll("#tabbar .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll("#drawer .drawer-item[data-gotab]").forEach((d) => d.classList.toggle("active", d.dataset.gotab === tab));
}

// ===== Drawer (swipe-from-left) =====
function openDrawer() {
  const av = $("drawerAvatar"), nm = $("drawerName"), em = $("drawerEmail");
  av.textContent = (USER[0] || "U").toUpperCase();
  nm.textContent = USER;
  em.textContent = localStorage.getItem("bm_email") || "movies@broken.com";
  $("drawer").classList.add("open");
  $("drawerScrim").classList.add("open");
}
function closeDrawer() { $("drawer").classList.remove("open"); $("drawerScrim").classList.remove("open"); }
function drawerGo(tab) {
  closeDrawer();
  setActive(tab);
  go(tab);
}
// Swipe-from-left to open drawer
let touchStartX = 0, touchStartY = 0;
document.addEventListener("touchstart", (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX; touchStartY = t.clientY;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const player = $("moviePlayer");
  const isOpenPlayer = player && (player.style.display === "flex" || playerMode !== "full");
  if (isOpenPlayer) return;
  const drawerOpen = $("drawer").classList.contains("open");
  // Swipe RIGHT anywhere opens the sidebar; swipe LEFT closes it.
  if (!drawerOpen && dx > 70 && Math.abs(dy) < 110) openDrawer();
  if (drawerOpen && dx < -40 && Math.abs(dy) < 110) closeDrawer();
}, { passive: true });

// Tiny left-edge grab handle so the swipe target is discoverable.
const edgeHandle = document.createElement("div");
edgeHandle.id = "edgeHandle";
edgeHandle.onclick = openDrawer;
document.body.appendChild(edgeHandle);

async function go(tab) {
  setActive(tab);
  clearInterval(heroTimer);
  resetInfinite();
  $("searchWrap").classList.remove("open");
  $("epPicker").classList.remove("open");
  $("detail").style.display = "none";
  showLoading();
  try {
    if (tab === "home") {
      const d = await api('/movie/home');
      const s = d.homepage || {};
      const all = [...(s.trendingNow || []), ...(s.nollywood || []), ...(s.actionMovies || [])];
      const cw = HISTORY.filter((h) => h.detailPath).slice(0, 8);
      const sections = [];
      if (cw.length) sections.push({ title: "Continue Watching", items: cw.map((h) => ({ ...h, pct: h.pct })) });
      if (s.trendingNow) sections.push({ title: "Trending Now", items: s.trendingNow, more: "go('trending')" });
      if (s.nollywood) sections.push({ title: "Nollywood", items: s.nollywood, more: "go('nollywood')" });
      if (s.actionMovies) sections.push({ title: "Action", items: s.actionMovies, more: "go('action')" });
      // Because you watched — derive from watch history genre/recent titles.
      const rec = await loadRecommendations();
      if (rec.length) sections.push({ title: "Because You Watched", items: rec, more: "go('recommendations')" });
      // Robust: if the homepage came back empty (flaky API), fall back to a movies grid.
      if (!sections.length) { const fb = await loadFallbackMovies(); if (fb.length) { renderGrid(fb, "Movies", "Popular picks", () => loadMoreMovies()); return; } }
      renderHome(sections, all);
    } else if (tab === "movies") {
      let items = (await api('/movie/home/trending?limit=100')).movies || [];
      if (!items.length) items = await loadFallbackMovies();
      renderGrid(items, "Movies", "All movies", () => loadMoreMovies());
    } else if (tab === "anime") {
      const d = await api('/anime/top?limit=80');
      renderGrid(d.anime || d.results || d.movies || [], "Anime", "Top anime", () => loadMoreAnime());
    } else if (tab === "nollywood") {
      const d = await api('/nollywood?limit=60');
      renderGrid(d.movies || d.results || d.series || [], "Nollywood", "Nigerian films", () => loadMoreNollywood());
    } else if (tab === "kdrama") {
      const d = await api('/kdrama?limit=60');
      renderGrid(d.series || d.dramas || d.results || d.movies || [], "K-Drama", "Korean dramas", () => loadMoreKdrama());
    } else if (tab === "hollywood") {
      const d = await api('/movie/home/trending?limit=100');
      renderGrid(d.movies || d.results || [], "Hollywood", "Top films", () => loadMoreMovies());
    } else if (tab === "bl") {
      const d = await api('/bl?limit=60');
      renderGrid(d.series || d.movies || d.results || [], "BL Series", "Boys Love", () => loadMoreBl());
    } else if (tab === "history") {
      showHistory();
    } else if (tab === "adult") {
      adultGate();
    } else if (tab === "recommendations") {
      showRecommendations();
    } else if (tab === "top10") {
      showTop10();
    } else if (tab === "downloads") {
      showDownloads();
    } else if (tab === "watchroom") {
      showWatchRoom();
    } else if (tab === "live") {
      const d = await api('/tv-channels?limit=60');
      renderLive(d.channels || d.results || []);
    } else if (tab === "mylist") {
      renderGrid(MYLIST, "My List", "Your saved titles");
    } else if (tab === "trending") {
      let items = (await api('/movie/home/trending?limit=100')).movies || [];
      if (!items.length) items = await loadFallbackMovies();
      renderGrid(items, "Trending", "Popular right now", () => loadMoreMovies());
    } else if (tab === "genres" || GENRE_VIEWS[tab]) {
      setCatPills(["Action", "Comedy", "Horror", "Romance", "Sci-Fi", "Drama", "Animation", "Documentary"], null, "genre");
      if (tab === "genres") { let items = (await api('/movie/home/trending?limit=80')).movies || []; if (!items.length) items = await loadFallbackMovies(); renderGrid(items, "Genres", "Pick a genre", () => loadMoreMovies()); }
      else genre(tab);
    }
  } catch (e) {
    $("content").innerHTML = `<div class="empty">Failed to load: ${esc(e.message)}</div>`;
  }
}
const GENRE_VIEWS = { action: 1, comedy: 1, horror: 1, romance: 1, scifi: 1, drama: 1, animation: 1, documentary: 1 };

async function genre(g) {
  showLoading();
  resetInfinite();
  setCatPills(["Action", "Comedy", "Horror", "Romance", "Sci-Fi", "Drama", "Animation", "Documentary"], g, "genre");
  try {
    const slug = g.toLowerCase().replace("sci-fi", "scifi");
    let items = (await api(`/movie/genre/${slug}?limit=80`)).movies || [];
    if (!items.length) items = await loadFallbackMovies();
    renderGrid(items, "Genre · " + g, "", () => loadMoreGenre(slug));
  } catch (e) { $("content").innerHTML = `<div class="empty">Genre failed: ${esc(e.message)}</div>`; }
}
async function loadMoreGenre(slug) {
  try {
    const d = await api(`/movie/genre/${slug}?limit=80`);
    let items = d.movies || d.results || [];
    if (!items.length) items = await loadFallbackMovies();
    if (!appendGridItems(items)) { infinite = null; return; }
  } catch { infinite = null; }
  if (infinite) infinite.loading = false;
}

// ===== 18+ Adult section =====
const ADULT_VIEWS = { porn: 1, hentai: 1, dirty: 1 };
let adultPool = "porn";
let adultPage = 1;
function ageEnter() {
  localStorage.setItem("bm_adult", "1");
  $("ageGate").style.display = "none";
  loadAdult("porn");
}
function ageLeave() {
  $("ageGate").style.display = "none";
  go("home");
}
function adultGate() {
  if (localStorage.getItem("bm_adult") === "1") { loadAdult(adultPool); return; }
  $("ageGate").style.display = "flex";
}
const ADULT_CATS = ["Porn","Hentai","Dirty Movies","MILF","Asian","Ebony","18+","Anal","Lesbian","Threesome","Mature"];
function adultPill(p) {
  const key = p === "Dirty Movies" ? "dirty" : p === "18+" ? "teen18" : p.toLowerCase();
  adultPool = key; adultPage = 1; loadAdult(key);
}
function adultTitle(pool) { const c = ADULT_CATS.find((x) => (x === "Dirty Movies" ? "dirty" : x === "18+" ? "teen18" : x.toLowerCase()) === pool); return c || (pool[0] || "").toUpperCase() + pool.slice(1); }
async function loadAdult(pool) {
  adultPool = pool; adultPage = 1;
  showLoading();
  setCatPills(ADULT_CATS, adultTitle(pool), "adultPill");
  try {
    const d = await api(`/adult/search?pool=${pool}&page=1&limit=36`);
    const items = (d.videos || []).map((v) => ({ id: "adult_" + v.url.split("/").pop(), title: v.title, cover: v.thumb, type: "adult", typeId: 1, adultUrl: v.url, adult: true }));
    renderGrid(items, adultTitle(pool), "Explicit 18+ content", () => loadMoreAdult(pool));
  } catch (e) { $("content").innerHTML = `<div class="empty">Adult failed: ${esc(e.message)}</div>`; }
}
async function loadMoreAdult(pool) {
  try {
    adultPage++;
    const d = await api(`/adult/search?pool=${pool}&page=${adultPage}&limit=36`);
    const items = (d.videos || []).map((v) => ({ id: "adult_" + v.url.split("/").pop(), title: v.title, cover: v.thumb, type: "adult", typeId: 1, adultUrl: v.url, adult: true }));
    if (!appendGridItems(items)) { infinite = null; return; }
  } catch { infinite = null; }
  if (infinite) infinite.loading = false;
}
// Adult playback + download (direct MP4 via /adult/stream)
let adultCurrentUrl = null;
let adultCurrentTitle = "";
async function playAdult(url, title) {
  adultCurrentUrl = null; adultCurrentTitle = title || "";
  openPlayer(title || "Adult");
  const dl = $("playerDlBtn"); if (dl) dl.style.display = "none";
  const vw = $("videoWrap"); vw.innerHTML = '<div class="loading"><div class="spinner"></div>Loading stream...</div>';
  try {
    const d = await api(`/adult/stream?url=${encodeURIComponent(url)}`);
    if (d.stream) {
      adultCurrentUrl = d.stream;
      vw.innerHTML = '<video id="video" controls playsinline autoplay></video>';
      const v = $("video"); v.src = d.stream; v.play().catch(() => {});
      if (dl) dl.style.display = "flex";
    } else vw.innerHTML = '<div class="empty">No stream available.</div>';
  } catch (e) { vw.innerHTML = `<div class="empty">Stream error: ${esc(e.message)}</div>`; }
}
function downloadCurrent() {
  if (adultCurrentUrl) doDownload(adultCurrentUrl, adultCurrentTitle || "adult");
  else toast("No download source.");
}

// ===== Smart recommendations ("Because you watched") =====
async function loadRecommendations() {
  const out = []; const seen = new Set();
  // 1) Use genres/titles from watch history + My List.
  const seeds = [...HISTORY, ...MYLIST].slice(0, 6);
  for (const s of seeds) {
    const terms = [s.genre, s.title].filter(Boolean);
    for (const term of terms.slice(0, 2)) {
      try {
        const d = await api(`/search?q=${encodeURIComponent(String(term).split(" ").slice(0, 2).join(" "))}&per_page=8`);
        for (const it of (d.results || d.movies || [])) {
          const k = it.subjectId || it.id;
          if (k && !seen.has(k) && k !== s.id) { seen.add(k); out.push(it); }
        }
      } catch {}
      if (out.length >= 14) break;
    }
    if (out.length >= 14) break;
  }
  // 2) Backfill with a genre pool if still thin.
  if (out.length < 8) {
    try {
      const d = await api('/movie/genre/action?limit=16');
      for (const it of (d.movies || [])) { const k = it.subjectId || it.id; if (k && !seen.has(k)) { seen.add(k); out.push(it); } }
    } catch {}
  }
  return out.slice(0, 20);
}
async function showRecommendations() {
  showLoading();
  const items = await loadRecommendations();
  if (!items.length) { $("content").innerHTML = `<div class="empty">${ICON.popcorn}<span>Watch a few titles to unlock recommendations.</span></div>`; return; }
  renderGrid(items, "Because You Watched", "Picks for you", () => loadMoreMovies());
}

// ===== Top 10 This Week (trending heat ranking) =====
async function showTop10() {
  showLoading();
  try {
    let items = (await api('/movie/home/trending?limit=60')).movies || [];
    if (!items.length) items = await loadFallbackMovies();
    const top = items.slice(0, 10);
    const heat = ["#ff3b5c", "#ff5c7a", "#ff7a5c", "#ffa45c", "#ffc45c", "#ffd24a", "#b6ff5c", "#5cffa4", "#5cd4ff", "#9a5cff"];
    $("content").innerHTML = `<div class="page-title">Top 10 This Week</div><div class="page-sub">Trending heat ranking</div>
      <div class="top10">${top.map((m, i) => `
        <div class="top10-row" onclick="openDetail('${encodeURIComponent(JSON.stringify(m))}')" style="--rank:${i}">
          <span class="rank" style="color:${heat[i]}">${i + 1}</span>
          <div class="poster">${m.cover ? `<img src="${m.cover}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="noimg" style="display:none">${ICON.film}</div>` : `<div class="noimg">${ICON.film}</div>`}</div>
          <div class="ti"><div class="name">${esc(m.title || "")}</div><div class="genre">${esc((m.genre || m.year || "").slice(0, 40))}</div></div>
          <span class="heat">🔥 ${100 - i * 7}%</span>
        </div>`).join("")}</div>`;
  } catch (e) { $("content").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ===== Download manager (persisted, with storage counter) =====
let DLS = JSON.parse(localStorage.getItem("bm_dls") || "[]");
function saveDls() { localStorage.setItem("bm_dls", JSON.stringify(DLS.slice(0, 40))); }
function addDownload(url, title) {
  DLS.unshift({ url, title, date: Date.now() });
  saveDls();
}
function showDownloads() {
  const c = $("content");
  const used = DLS.reduce((a, d) => a + (d.size || 0), 0);
  if (!DLS.length) { c.innerHTML = `<div class="empty">${ICON.download}<span>No downloads yet. Use ⬇ on any title.</span></div>`; setActive("downloads"); return; }
  c.innerHTML = `<div class="page-title">Downloads</div><div class="page-sub">${DLS.length} file${DLS.length > 1 ? "s" : ""} · ${(used / 1048576).toFixed(1)} MB</div>
    <div class="dl-list">${DLS.map((d, i) => `
      <div class="dl-item">
        <span class="dl-icon">${ICON.download}</span>
        <div class="ti"><div class="name">${esc(d.title || "")}</div><div class="genre">${new Date(d.date).toLocaleString()}</div></div>
        <button class="btn btn-dl" onclick="removeDownload(${i})">✕</button>
      </div>`).join("")}</div>`;
}
function removeDownload(i) { DLS.splice(i, 1); saveDls(); showDownloads(); }
// Hook the real download flow to also record it in the manager.
const _origDoDownload = doDownload;
doDownload = function (url, title) { if (url) addDownload(url, title); _origDoDownload(url, title); };

// ===== Watch Together (shareable room link with sync state) =====
function showWatchRoom() {
  const c = $("content");
  c.innerHTML = `<div class="page-title">Watch Together</div><div class="page-sub">Sync a movie with friends</div>
    <div class="room-card">
      <div class="room-title">Create a room</div>
      <p class="room-desc">Generate a link, share it, and everyone watching stays in sync.</p>
      <button class="btn btn-play" style="width:100%;margin:8px 0" onclick="createRoom()">${ICON.play} Create Room</button>
      <div class="room-link" id="roomLink" style="display:none"></div>
    </div>`;
}
function createRoom() {
  const room = "bm-" + Math.random().toString(36).slice(2, 8);
  const url = location.origin + location.pathname + "?room=" + room;
  const el = $("roomLink");
  el.style.display = "block";
  el.innerHTML = `<input readonly value="${url}" style="width:100%;padding:10px;border-radius:8px;background:var(--ink-2);color:var(--text);border:1px solid var(--glass-border);font-size:12px"><button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="copyRoom('${url}')">Copy Link</button>`;
  toast("Room created: " + room);
}
function copyRoom(url) { navigator.clipboard && navigator.clipboard.writeText(url); toast("Link copied — share it!"); }
function joinRoom() {
  const q = new URLSearchParams(location.search).get("room");
  if (q) { toast("Joined room: " + q); /* placeholder sync hook */ }
}

// ===== Infinite-scroll "load more" helpers =====
const MOREPOOLS = ["action", "comedy", "horror", "romance", "scifi", "drama", "animation", "documentary"];
const ANIMEPOOLS = ["action", "romance", "fantasy", "comedy", "horror", "scifi", "drama"];
const NPOOLS = ["nollywood", "nigerian movie", "nigerian film", "yoruba movie", "hausa movie"];
const KPOOLS = ["korean drama", "kdrama", "korean series", "korean movie"];
const BPOOLS = ["BL series", "boys love", "BL drama", "thai bl", "korean bl"];

// Gather a solid first batch of movies across pools (robust when one endpoint is flaky).
async function loadFallbackMovies() {
  const out = [];
  const seen = new Set();
  for (const pool of MOREPOOLS) {
    try {
      const d = await api(`/movie/genre/${pool}?limit=40`);
      const items = d.movies || d.results || d.series || d.anime || [];
      for (const it of items) { const k = it.subjectId || it.title || it.id; if (k && !seen.has(k)) { seen.add(k); out.push(it); } }
    } catch {}
    if (out.length >= 60) break;
  }
  // Last-resort: FZMovies (independent source, not rate-limited the same way).
  if (!out.length) {
    try {
      const fz = await api(`/fzmovies/search?q=hollywood&limit=30`);
      for (const it of (fz.results || [])) out.push({ id: "fz_" + (it.url||"").split("/").pop(), title: it.title, cover: it.poster || "", detailPath: it.url, type: "movie", typeId: 1, fzmovies: true });
    } catch {}
  }
  return out.slice(0, 100);
}

function makeLoadMore(pools) {
  let idx = 0;
  return async function loadMore() {
    try {
      const pool = pools[idx % pools.length]; idx++;
      let d = await api(`/movie/genre/${pool}?limit=80`);
      let items = d.movies || d.results || d.series || d.anime || [];
      if (!items.length) items = (await api(`/search?q=${encodeURIComponent(pool)}&per_page=60`)).results || [];
      if (!appendGridItems(items)) { infinite = null; return; }
    } catch { infinite = null; }
    if (infinite) infinite.loading = false;
  };
}
const loadMoreMovies = makeLoadMore(MOREPOOLS);
const loadMoreAnime = makeLoadMore(ANIMEPOOLS);
const loadMoreNollywood = makeLoadMore(NPOOLS);
const loadMoreKdrama = makeLoadMore(KPOOLS);
const loadMoreBl = makeLoadMore(BPOOLS);

function renderLive(channels) {
  const c = $("content");
  if (!channels.length) { c.innerHTML = '<div class="empty">No channels available.</div>'; return; }
  c.innerHTML = `<div class="page-title">Live TV</div><div class="page-sub">Real working channels</div><div class="live-grid">${channels.map((ch) => `
    <div class="live-card" onclick="openLive('${esc(ch.url || ch.streamUrl || "")}','${esc(ch.name || "Channel")}')">
      <div class="thumb"><span class="live-dot"></span>${ICON.tv}</div>
      <div class="lname">${esc(ch.name || "Channel")}</div>
    </div>`).join("")}</div>`;
}
function openLive(src, name) {
  if (!src) { toast("No stream for this channel."); return; }
  openPlayer(name);
  const v = $("video");
  if (window.Hls && Hls.isSupported()) { const h = new Hls(); h.loadSource(src); h.attachMedia(v); }
  else v.src = src;
  v.play().catch(() => {});
}

// ===== Search =====
function toggleSearch() {
  const w = $("searchWrap");
  const open = w.classList.toggle("open");
  if (open) { setTimeout(() => $("searchBox").focus(), 60); }
}
// ===== Voice search (Web Speech API) =====
let voiceRec = null;
function toggleVoiceSearch() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Voice search not supported on this device"); return; }
  const btn = $("micBtn");
  if (voiceRec) { voiceRec.stop(); return; }
  try { voiceRec = new SR(); } catch (e) { toast("Voice unavailable"); return; }
  voiceRec.lang = "en-US";
  voiceRec.interimResults = false;
  voiceRec.maxAlternatives = 1;
  const hint = $("voiceHint");
  btn.classList.add("listening");
  hint.style.display = "block";
  hint.textContent = "🎙 Listening… say a title";
  voiceRec.onresult = (e) => {
    const q = e.results[0][0].transcript.trim();
    hint.textContent = `✓ "${q}"`;
    $("searchBox").value = q;
    doSearch(q);
  };
  voiceRec.onerror = (ev) => { hint.textContent = ev.error === "not-allowed" ? "Mic permission denied" : "Voice error: " + ev.error; setTimeout(() => (hint.style.display = "none"), 2500); };
  voiceRec.onend = () => { btn.classList.remove("listening"); voiceRec = null; setTimeout(() => (hint.style.display = "none"), 1500); };
  voiceRec.start();
}
async function doSearch(q) {
  q = (q || "").trim();
  if (!q) return;
  showLoading();
  try {
    const d = await api(`/search?q=${encodeURIComponent(q)}&limit=60`);
    let results = d.results || d.movies || d.anime || [];
    // Fallback to FZMovies if the main source returned nothing.
    if (!results.length) {
      try {
        const fz = await api(`/fzmovies/search?q=${encodeURIComponent(q)}&limit=20`);
        results = (fz.results || []).map((m) => ({
          id: "fz_" + (m.url || "").split("/").pop(),
          title: m.title,
          cover: m.poster || "",
          detailPath: m.url,
          type: "movie", typeId: 1, fzmovies: true,
        }));
        results.source = "fzmovies";
      } catch {}
    }
    renderGrid(results, `Results · ${q}${results.source === "fzmovies" ? " (alt source)" : ""}`);
  } catch (e) { $("content").innerHTML = `<div class="empty">Search failed: ${esc(e.message)}</div>`; }
}

// ===== Detail =====
async function openDetail(jsonStr) {
  let m;
  try { m = JSON.parse(decodeURIComponent(jsonStr)); } catch { return; }
  const detail = $("detail");
  detail.style.display = "block";
  detail.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
  const isSeries = isSeriesType(m);
  let trailer = null, extraDesc = "", duration = "", dubs = [], similar = [], seasons = [];
  try {
    if (m.detailPath) {
      try {
        const d = await api(`/detail?path=${encodeURIComponent(m.detailPath)}`);
        if (d.subject) Object.assign(m, d.subject);
        trailer = d.trailer || null;
        extraDesc = d.description || m.description || "";
        duration = d.duration || m.duration || "";
        dubs = d.dubs || [];
        seasons = d.seasons || [];
        m.seasons = seasons;
        if (m.genres && m.genres.length) { try { const rel = await api(`/search?q=${encodeURIComponent(m.genres[0])}&per_page=12`); similar = (rel.results || []).filter((x) => x.subjectId !== m.id).slice(0, 8); } catch {} }
      } catch {}
    }
    const img = m.cover || m.image || "";
    const genreList = (Array.isArray(m.genres) ? m.genres : (m.genre ? [m.genre] : [])).join(" · ");
    const dubsStr = dubs.length ? `<span>${ICON.mic} ${esc(dubs.slice(0, 3).join(" / "))}</span>` : "";
    detail.innerHTML = `
      <div class="dhero">
        ${img ? `<img src="${img}" onerror="this.style.display='none'">` : ""}
        <div class="scrim"></div>
        <button class="dback" onclick="$('detail').style.display='none'">${ICON.back}</button>
      </div>
      <div class="dinfo">
        <div class="dtag">${isSeries ? "Series" : "Movie"}</div>
        <h1 class="dtitle">${esc(m.title || "")}</h1>
        <div class="dmeta"><span class="rating">${ICON.star} ${m.rating || "—"}</span>${m.year ? `<span>${m.year}</span>` : ""}${m.country ? `<span>${ICON.globe} ${esc(m.country)}</span>` : ""}${m.languages ? `<span>${esc(String(m.languages).slice(0, 20))}</span>` : ""}${genreList ? `<span>${esc(genreList)}</span>` : ""}${duration ? `<span>${ICON.clock} ${esc(fmtDur(duration))}</span>` : ""}${dubsStr}</div>
        <div class="dbtns">
          <button class="btn btn-play" onclick="playDetail()">${ICON.play} Play</button>
          ${trailer ? `<button class="btn btn-ghost" onclick="playTrailerUrl('${encodeURIComponent(trailer)}','${esc((m.title || '').replace(/'/g, "\\'"))}')">${ICON.trailer} Trailer</button>` : ""}
          ${isSeries ? `<button class="btn btn-ghost" onclick="toggleEpPicker()">${ICON.eps} Episodes</button>` : ""}
          <button class="btn btn-dl" onclick="likeDetail()">${ICON.like}</button>
          <button class="btn btn-dl" onclick="shareDetail()">${ICON.share}</button>
          <button class="btn btn-dl ${isFav(m.id) ? 'on' : ''}" onclick="toggleFavDetail()">${isFav(m.id) ? ICON.heartFilled : ICON.heart}</button>
          <button class="btn btn-dl" onclick="downloadDetail()">${ICON.download}</button>
        </div>
        ${isSeries ? `<div id="epPicker" class="open">${epPickerHtml(m)}</div>` : ""}
        <div class="quality-row" id="qualityRow" style="display:none"></div>
        ${trailer ? `<div class="trailer-box"><div class="trailer-head">${ICON.trailer} Trailer Preview</div><video id="trailerVid" muted playsinline loop preload="metadata" onclick="this.paused?this.play():this.pause()"><source src="${esc(trailer)}"></video></div>` : ""}
        <div class="dsec-label">Overview</div>
        <div class="dsynopsis">${esc(extraDesc || m.description || m.synopsis || "No description available.")}</div>
        ${similar.length ? `<div class="dsec-label">Similar Titles</div><div class="row">${similar.map(card).join("")}</div>` : ""}
      </div>`;
    window._cur = m;
    window._isSeries = isSeries;
    // Auto-play the trailer preview (muted, low volume, plays when scrolled into view).
    const tv = document.getElementById("trailerVid");
    if (tv) { try { const pr = tv.play(); if (pr) pr.catch(() => {}); } catch {} }
  } catch (e) { detail.innerHTML = `<div class="empty">Detail error: ${esc(e.message)}</div>`; }
}

// Detail action buttons
let likedSet = new Set(JSON.parse(localStorage.getItem("bm_liked") || "[]"));
function likeDetail() {
  const m = window._cur; if (!m) return;
  if (likedSet.has(m.id)) { likedSet.delete(m.id); toast("Unliked"); }
  else { likedSet.add(m.id); toast("Liked"); }
  localStorage.setItem("bm_liked", JSON.stringify([...likedSet]));
}
function shareDetail() {
  const m = window._cur; if (!m) return;
  const data = { title: m.title || "BROKEN Movies", text: "Watch " + (m.title || "") + " on BROKEN Movies", url: location.href };
  if (navigator.share) navigator.share(data).catch(() => {});
  else { navigator.clipboard && navigator.clipboard.writeText(data.url); toast("Link copied"); }
}
async function downloadDetail() {
  const m = window._cur; if (!m) return;
  // FZMovies item: resolve direct URL and download it.
  if (m.fzmovies && m.detailPath) {
    toast("Fetching download link...");
    try {
      const d = await api(`/fzmovies/download?url=${encodeURIComponent(m.detailPath)}`);
      if (d && d.directUrl) { doDownload(d.directUrl, m.title); return; }
      toast("No download available.");
    } catch (e) { toast("Download failed: " + e.message); }
    return;
  }
  if (!m.detailPath) { toast("No download available."); return; }
  toast("Fetching download links...");
  try {
    const d = await api(`/download?path=${encodeURIComponent(m.detailPath)}&id=${m.id}${window._isSeries ? "&se=1&ep=1" : ""}`);
    const dl = (d.downloads || []).slice().sort((a, b) => (b.resolution || 0) - (a.resolution || 0));
    if (!dl.length) { toast("No download available."); return; }
    openDownloadPicker(dl, d.captions || [], m.title || "", window._isSeries ? 1 : null, window._isSeries ? 1 : null);
  } catch (e) { toast("Download failed: " + e.message); }
}
function playTrailerUrl(encUrl, title) {
  openPlayer(title + " — Trailer");
  const vw = $("videoWrap"); vw.innerHTML = '<video id="video" controls playsinline autoplay></video>';
  const v = $("video");
  const src = decodeURIComponent(encUrl);
  if (/m3u8/i.test(src) && window.Hls && Hls.isSupported()) { const h = new Hls(); h.loadSource(src); h.attachMedia(v); }
  else v.src = src;
  v.play().catch(() => {});
}

function epPickerHtml(m) {
  // Build from real season data if available, else fall back to a sensible guess.
  const seasons = (m.seasons && m.seasons.length) ? m.seasons : [{ season: 1, maxEpisode: m.totalEpisodes || 12 }];
  const se = m._curSe || seasons[0].season;
  const curSeason = seasons.find((s) => s.season === se) || seasons[0];
  const count = curSeason ? (curSeason.maxEpisode || 12) : 12;
  const eps = Array.from({ length: Math.min(count, 40) }, (_, i) => i + 1);
  const seasonPills = seasons.length > 1
    ? `<div class="quality-row" style="display:flex">${seasons.map((s) => `<button class="q-btn${s.season === se ? " active" : ""}" onclick="switchSeason(${s.season},this)">S${s.season}</button>`).join("")}</div>`
    : "";
  return `<div class="dsec-label">Episodes</div>${seasonPills}<div class="ep-grid">${eps.map((n) => {
    return `<div class="ep-item">
      <button class="ep-btn" onclick="playEp('${m.detailPath || ""}','${m.id}','${se}','${n}',this)">EP ${n}</button>
      <button class="ep-dl" onclick="downloadEp('${m.detailPath || ""}','${m.id}','${se}','${n}','${esc(m.title || "").replace(/'/g, "\\'")}')">${ICON.download}</button>
    </div>`;
  }).join("")}</div>`;
}

let curSe = 1;
function switchSeason(se, btn) {
  curSe = se;
  document.querySelectorAll(".q-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const m = window._cur; if (!m) return;
  m._curSe = se;
  const picker = $("epPicker");
  if (picker) picker.innerHTML = epPickerHtml(m).replace(/^<div class="dsec-label">Episodes<\/div>/, "");
}

async function downloadEp(detailPath, id, se, ep, title) {
  toast("Fetching download links...");
  try {
    const d = await api(`/download?path=${encodeURIComponent(detailPath)}&id=${id}&se=${se || 1}&ep=${ep || 1}`);
    const dl = (d.downloads || []).slice().sort((a, b) => (b.resolution || 0) - (a.resolution || 0));
    if (!dl.length) { toast("No download available."); return; }
    openDownloadPicker(dl, d.captions || [], title || (window._cur && window._cur.title) || "", se, ep);
  } catch (e) { toast("Download failed: " + e.message); }
}

// Quality download picker modal
function openDownloadPicker(dl, captions, title, se, ep) {
  let html = `<div class="dl-panel glass">
    <div class="dl-head"><div><div class="dl-title">Download${se ? " · S" + se + "E" + ep : ""}</div><div class="dl-sub">${esc(title || "")}</div></div>
      <button class="dl-close" onclick="closeDownloadPicker()">${ICON.close}</button></div>
    <div class="dl-list">${dl.map((x, i) => `
      <button class="dl-row" onclick="doDownload('${esc(x.url)}','${esc(title || "movie")}')">
        <span class="dl-badge">${x.resolution ? x.resolution + "p" : (x.format || "MP4")}</span>
        <span class="dl-size">${x.size || "direct"}</span>
        <span class="dl-arrow">${ICON.download}</span>
      </button>`).join("")}</div>
    ${captions.length ? `<div class="dl-subs">${captions.length} subtitle track${captions.length > 1 ? "s" : ""} included</div>` : ""}
  </div>`;
  $("dlModal").innerHTML = html;
  $("dlModal").style.display = "flex";
}
function closeDownloadPicker() { $("dlModal").style.display = "none"; }
function doDownload(url, title) {
  const a = document.createElement("a");
  a.href = url; a.download = title.replace(/[^a-z0-9]+/gi, "_") + ".mp4"; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  toast("Download started");
}
function toggleEpPicker() {
  const p = $("epPicker"); if (p) p.classList.toggle("open");
}
function toggleFavDetail() {
  const m = window._cur;
  if (!m) return;
  toggleFav(m);
  const fav = isFav(m.id) ? "Remove" : "Save";
  const b = document.querySelector(".btn-dl"); if (b) b.textContent = fav;
}

let curPlaybackId = null;
async function playDetail() {
  const m = window._cur; if (!m) return;
  curPlaybackId = m.id;
  await startPlay(m.detailPath, m.id, window._isSeries, (m.se || 1), (m.ep || 1), m.title, m.cover, m.typeId, m.type);
}
async function playEp(detailPath, id, se, ep, btn) {
  document.querySelectorAll(".ep-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  curPlaybackId = id;
  const m = window._cur;
  await startPlay(detailPath, id, true, se || 1, ep, m && m.title, m && m.cover, m && m.typeId, m && m.type);
}

async function startPlay(detailPath, id, isSeries, se, ep, title, cover, typeId, type) {
  if (!detailPath) { toast("No stream source."); return; }
  openPlayer(title || "Now Playing");
  const vw = $("videoWrap"); vw.innerHTML = '<video id="video" controls playsinline></video>';
  // FZMovies item: detailPath holds the movie URL -> resolve a direct stream.
  const isFz = window._cur && window._cur.fzmovies;
  if (isFz) {
    try {
      const d = await api(`/fzmovies/download?url=${encodeURIComponent(detailPath)}`);
      if (d && d.directUrl) { attachVideo(d.directUrl, []); recordProgress(id, title, cover, 1, "movie", detailPath, 1, 1, 0); return; }
      vw.innerHTML = '<div class="empty">No stream available.</div>'; return;
    } catch (e) { vw.innerHTML = `<div class="empty">Stream error: ${esc(e.message)}</div>`; return; }
  }
  try {
    const d = await api(`/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries ? `&se=${se || 1}&ep=${ep || 1}` : ""}`);
    const dl = d.downloads || [];
    const qr = $("qualityRow");
    if (dl.length > 1) {
      qr.style.display = "flex";
      qr.innerHTML = dl.map((x, i) => `<button class="q-btn${i === 0 ? " active" : ""}" onclick="pickQuality('${detailPath}','${id}','${isSeries}','${se || 1}','${ep || 1}','${x.resolution || ""}',this)">${x.resolution ? x.resolution + "p" : (x.format || "MP4")}</button>`).join("");
    } else qr.style.display = "none";
    const src = d.streamUrl || d.m3u8 || (dl[0] && dl[0].url);
    if (!src) { vw.innerHTML = '<div class="empty">No stream available.</div>'; return; }
    attachVideo(src, d.captions || []);
    recordProgress(id, title, cover, typeId != null ? typeId : 1, type, detailPath, se || 1, ep || 1, 0);
  } catch (e) { vw.innerHTML = `<div class="empty">Stream error: ${esc(e.message)}</div>`; }
}
async function pickQuality(detailPath, id, isSeries, se, ep, res, btn) {
  document.querySelectorAll(".q-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const vw = $("videoWrap"); vw.innerHTML = '<video id="video" controls playsinline></video>';
  try {
    const d = await api(`/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries ? `&se=${se}&ep=${ep}` : ""}`);
    const dl = d.downloads || [];
    const pick = dl.find((x) => String(x.resolution) === String(res)) || dl[0];
    if (pick && pick.url) attachVideo(pick.url, d.captions || []);
    else vw.innerHTML = '<div class="empty">Quality not available.</div>';
  } catch (e) { vw.innerHTML = `<div class="empty">Error: ${esc(e.message)}</div>`; }
}
window._captions = [];
let subsOn = true;
function toggleSubs() {
  subsOn = !subsOn;
  const v = $("video");
  if (v) { [...v.textTracks].forEach((t) => { t.mode = subsOn ? "showing" : "hidden"; }); }
  const b = $("subBtn"); if (b) b.style.color = subsOn ? "var(--accent)" : "";
  toast(subsOn ? "Subtitles: On" : "Subtitles: Off");
}
function attachVideo(src, captions) {
  const v = $("video");
  if (!v) return;
  if (window.Hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(src); hls.attachMedia(v); }
  else v.src = src;
  window._captions = captions || [];
  const sb = $("subBtn");
  if (sb) sb.style.display = (captions && captions.length) ? "flex" : "none";
  if (captions && captions.length) {
    const en = captions.find((c) => /en|eng|english/i.test(c.language || "")) || captions[0];
    if (en && en.url) {
      const t = document.createElement("track");
      t.kind = "subtitles"; t.label = en.language || "Subs"; t.srclang = (en.language || "en").slice(0, 2); t.src = en.url; t.default = true;
      v.appendChild(t);
    }
    // Audio-track hint (multi-audio picker if the API exposes it).
    const audios = (captions && captions.audio) || [];
    if (audios.length) {
      const ab = $("audioBtn");
      if (ab) { ab.style.display = "flex"; ab.style.color = "var(--accent)"; }
    }
  }
  v.addEventListener("timeupdate", () => {
    if (v.duration && curPlaybackId) {
      const pct = Math.round((v.currentTime / v.duration) * 100);
      const cur = HISTORY.find((h) => h.id === curPlaybackId);
      if (cur) { cur.pct = pct; cur.lastWatched = Date.now(); saveHistory(); }
    }
    // Next-episode autoplay for series/anime.
    if (window._isSeries && !v.disableAutonext && !v._autonextTriggered && v.duration && (v.duration - v.currentTime) < 8 && v.currentTime > 30) {
      v._autonextTriggered = true;
      const m = window._cur;
      const se = m.se || 1, ep = m.ep || 1;
      const nextEp = ep + 1;
      const hasNext = m.seasons && m.seasons.length;
      if (hasNext) {
        toast("Auto-playing next episode…");
        window._autoplayCountdown = true;
        playEp(m.detailPath, m.id, se, nextEp, null);
      }
    }
  });
}

// ===== Player controls (cinema + mini) =====
let playerMode = "full";
function openPlayer(title) {
  const p = $("moviePlayer");
  p.className = "open";
  playerMode = "full";
  $("playerTitle").textContent = title || "";
  $("videoWrap").innerHTML = '<video id="video" controls playsinline></video>';
  $("playerInfo").innerHTML = "";
  $("playerInfo").classList.remove("hidden");
  $("miniBar").style.display = "none";
  p.style.display = "flex";
  document.getElementById("tabbar").style.display = "none";
}
function playerBack() {
  const p = $("moviePlayer");
  if (playerMode === "minimized") { growMini(); return; }
  if (playerMode === "cinema") { toggleCinema(); return; }
  minimize();
}
function minimize() {
  playerMode = "minimized";
  const p = $("moviePlayer");
  p.classList.add("minimized");
  p.classList.remove("cinema");
  $("playerInfo").classList.add("hidden");
  $("miniBar").style.display = "flex";
  document.getElementById("tabbar").style.display = "flex";
}
function growMini() {
  playerMode = "minimized-large";
  const p = $("moviePlayer");
  p.classList.remove("minimized");
  p.classList.add("minimized-large");
  $("miniBar").style.display = "none";
  p.querySelector(".mini-x")?.remove();
  const x = document.createElement("button");
  x.className = "mini-x"; x.innerHTML = ICON.close; x.onclick = (e) => { e.stopPropagation(); closePlayer(true); };
  p.appendChild(x);
}
function toggleCinema() {
  const p = $("moviePlayer");
  if (playerMode === "cinema") { p.classList.remove("cinema"); playerMode = "full"; }
  else { p.classList.add("cinema"); playerMode = "cinema"; }
}
function closePlayer(immediate) {
  const p = $("moviePlayer");
  const v = $("video"); if (v) v.pause();
  p.style.display = "none";
  p.className = "";
  playerMode = "full";
  $("miniBar").style.display = "none";
  document.getElementById("tabbar").style.display = "flex";
  curPlaybackId = null;
}
// Tap video in mini to expand
document.addEventListener("click", (e) => {
  const vw = $("videoWrap");
  if (playerMode === "minimized" && vw && vw.contains(e.target)) growMini();
  else if (playerMode === "minimized-large" && vw && vw.contains(e.target)) {
    const p = $("moviePlayer");
    p.classList.remove("minimized-large");
    p.querySelector(".mini-x")?.remove();
    p.classList.add("open");
    playerMode = "full";
    $("playerInfo").classList.remove("hidden");
    document.getElementById("tabbar").style.display = "none";
  }
});

// ===== Profile =====
function openProfile() {
  const m = $("detail");
  m.style.display = "block";
  m.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;background:var(--ink)">
      <button class="dback" style="position:fixed;top:14px;left:14px" onclick="$('detail').style.display='none'">${ICON.back}</button>
      <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#ff7a5c);display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:16px;font-weight:800">${esc((USER[0] || "U").toUpperCase())}</div>
      <h2 style="font-size:22px;margin:0 0 4px">${esc(USER)}</h2>
      <p style="color:var(--text-dim);font-size:13px;margin:0 0 24px">${esc(localStorage.getItem("bm_email") || "movies@broken.com")}</p>
      <button class="btn btn-play" style="width:100%;max-width:300px;margin-bottom:10px" onclick="$('detail').style.display='none';go('mylist')">${ICON.heartFilled} My List (${MYLIST.length})</button>
      <button class="btn btn-ghost" style="width:100%;max-width:300px;margin-bottom:10px" onclick="$('detail').style.display='none';showHistory()">${ICON.clock} Watch History (${HISTORY.length})</button>
      <button class="btn btn-ghost" style="width:100%;max-width:300px;margin-bottom:10px" onclick="$('detail').style.display='none';go('live')">${ICON.tv} Live TV</button>
      <button class="btn btn-ghost" id="installBtn" style="width:100%;max-width:300px;margin-bottom:10px" onclick="installPWA()">⬇ Install App</button>
      <button class="btn btn-ghost" style="width:100%;max-width:300px;color:var(--accent)" onclick="logout()">Log Out</button>
    </div>`;
}
function showHistory() {
  if (!HISTORY.length) { $("content").innerHTML = `<div class="empty">${ICON.popcorn}<span>No watch history yet.</span></div>`; setActive("home"); return; }
  renderGrid(HISTORY.slice().sort((a, b) => b.lastWatched - a.lastWatched), "Watch History");
}
function logout() { localStorage.removeItem("bm_user"); localStorage.removeItem("bm_email"); window.location.href = "login.html"; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 2500); }

// PWA: register service worker for offline support + auto-join watch room.
let deferredPrompt = null;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; });
function installPWA() {
  if (!deferredPrompt) { toast("Install via your browser menu (Add to Home Screen)"); return; }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => { deferredPrompt = null; toast("Installing…"); });
}
joinRoom();
go("home");
