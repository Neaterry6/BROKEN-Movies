// BROKEN Movies — glassmorphism UI. Uses the dedicated same-origin backend
// (/api) when deployed, otherwise falls back to the BROKEN API.
const API_LOCAL = "/api";
const API_REMOTE = "https://api.brokenvzn.de5.net/api";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
let currentTab = "home";

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
  toast(isFav(m.id) ? "Added to My List ♥" : "Removed from My List");
  if (currentTab === "mylist") go("mylist");
}
function recordProgress(id, title, cover, typeId, type, detailPath, se, ep, pct) {
  const ex = HISTORY.find((x) => x.id === id);
  if (ex) { ex.pct = pct; ex.se = se; ex.ep = ep; ex.lastWatched = Date.now(); }
  else HISTORY.unshift({ id, title, cover, typeId, type, detailPath, se, ep, pct, lastWatched: Date.now() });
  saveHistory();
}

const isSeriesType = (m) => (m.typeId === 2 || m.typeId === 3 || m.type === "tv" || m.type === "series" || m.type === "anime");

// ===== Cards =====
function card(m) {
  if (!m) return "";
  const img = m.cover || m.image || "";
  const data = encodeURIComponent(JSON.stringify(m));
  const type = isSeriesType(m) ? "SERIES" : "MOVIE";
  const fav = isFav(m.id) ? "on" : "";
  const pct = m.pct || 0;
  const prog = pct > 0 ? `<div class="progress"><div style="width:${pct}%"></div></div>` : "";
  return `<div class="card" onclick="openDetail('${data}')">
    <button class="fav ${fav}" onclick="event.stopPropagation();toggleFav(${data})">${fav ? "♥" : "♡"}</button>
    <div class="poster">
      <span class="badge ${isSeriesType(m) ? "" : "movie"}">${type}</span>
      ${img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="noimg" style="display:none">🎬</div>` : `<div class="noimg">🎬</div>`}
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
      <button class="fplay" onclick="openDetail('${data}')">▶ Watch Now</button>
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
  let html = "";
  if (heroItems && heroItems.length) html += `<div id="featuredHost">${heroItems.slice(0, 5).map(featured).join("")}<div class="hero-dots">${heroItems.slice(0, 5).map((_, i) => `<span class="dot${i === 0 ? " active" : ""}" onclick="heroGo(${i})"></span>`).join("")}</div></div>`;
  html += sections.map((s) => row(s.title, s.items, s.more)).join("");
  $("content").innerHTML = html;
  const slides = document.querySelectorAll("#featuredHost .featured");
  slides.forEach((s, i) => (s.style.display = i === 0 ? "block" : "none"));
  if (heroItems && heroItems.length > 1) heroTimer = setInterval(() => { const ss = document.querySelectorAll("#featuredHost .featured"); if (ss.length > 1) heroGo((heroIndex + 1) % ss.length); }, 6000);
}
function renderGrid(items, title, sub) {
  const c = $("content");
  if (!items.length) { c.innerHTML = `<div class="empty">Nothing here yet. 🍿</div>`; return; }
  c.innerHTML = `${title ? `<div class="page-title">${esc(title)}</div>` : ""}${sub ? `<div class="page-sub">${esc(sub)}</div>` : ""}<div class="grid">${items.map(card).join("")}</div>`;
}

function showLoading() { $("content").innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>'; }
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
  // swipe right from left edge
  if (touchStartX < 28 && dx > 60 && Math.abs(dy) < 80) openDrawer();
  // swipe left to close
  if (dx < -60 && Math.abs(dy) < 80 && $("drawer").classList.contains("open")) closeDrawer();
}, { passive: true });

async function go(tab) {
  setActive(tab);
  clearInterval(heroTimer);
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
      renderHome(sections, all);
    } else if (tab === "movies") {
      const d = await api('/movie/home/trending?limit=100');
      renderGrid(d.movies || d.results || [], "Movies", "All movies");
    } else if (tab === "anime") {
      const d = await api('/anime/top?limit=80');
      renderGrid(d.anime || d.results || d.movies || [], "Anime", "Top anime");
    } else if (tab === "nollywood") {
      const d = await api('/nollywood');
      renderGrid(d.movies || d.results || d.series || [], "Nollywood", "Nigerian films");
    } else if (tab === "kdrama") {
      const d = await api('/kdrama');
      renderGrid(d.series || d.dramas || d.results || d.movies || [], "K-Drama", "Korean dramas");
    } else if (tab === "hollywood") {
      const d = await api('/movie/home/trending?limit=100');
      renderGrid(d.movies || d.results || [], "Hollywood", "Top films");
    } else if (tab === "bl") {
      const d = await api('/bl?limit=80');
      renderGrid(d.series || d.movies || d.results || [], "BL Series", "Boys Love");
    } else if (tab === "history") {
      showHistory();
    } else if (tab === "live") {
      const d = await api('/tv-channels?limit=60');
      renderLive(d.channels || d.results || []);
    } else if (tab === "mylist") {
      renderGrid(MYLIST, "My List ♥", "Your saved titles");
    } else if (tab === "trending") {
      const d = await api('/movie/home/trending?limit=100');
      renderGrid(d.movies || [], "Trending");
    } else if (tab === "genres" || GENRE_VIEWS[tab]) {
      setCatPills(["Action", "Comedy", "Horror", "Romance", "Sci-Fi", "Drama", "Animation", "Documentary"], null, "genre");
      if (tab === "genres") { const d = await api('/movie/home/trending?limit=80'); renderGrid(d.movies || [], "Genres", "Pick a genre"); }
      else genre(tab);
    }
  } catch (e) {
    $("content").innerHTML = `<div class="empty">Failed to load: ${esc(e.message)}</div>`;
  }
}
const GENRE_VIEWS = { action: 1, comedy: 1, horror: 1, romance: 1, scifi: 1, drama: 1, animation: 1, documentary: 1 };

async function genre(g) {
  showLoading();
  setCatPills(["Action", "Comedy", "Horror", "Romance", "Sci-Fi", "Drama", "Animation", "Documentary"], g, "genre");
  try {
    const slug = g.toLowerCase().replace("sci-fi", "scifi");
    const d = await api(`/movie/genre/${slug}?limit=80`);
    renderGrid(d.movies || d.results || [], "Genre · " + g);
  } catch (e) { $("content").innerHTML = `<div class="empty">Genre failed: ${esc(e.message)}</div>`; }
}

function renderLive(channels) {
  const c = $("content");
  if (!channels.length) { c.innerHTML = '<div class="empty">No channels available.</div>'; return; }
  c.innerHTML = `<div class="page-title">Live TV</div><div class="page-sub">Real working channels</div><div class="live-grid">${channels.map((ch) => `
    <div class="live-card" onclick="openLive('${esc(ch.url || ch.streamUrl || "")}','${esc(ch.name || "Channel")}')">
      <div class="thumb"><span class="live-dot"></span><span style="font-size:22px">📺</span></div>
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
async function doSearch(q) {
  q = (q || "").trim();
  if (!q) return;
  showLoading();
  try {
    const d = await api(`/search?q=${encodeURIComponent(q)}&limit=60`);
    const results = d.results || d.movies || d.anime || [];
    renderGrid(results, `Results · ${q}`);
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
  const fav = isFav(m.id) ? "♥ Remove" : "♡ Save";
  try {
    if (m.detailPath) {
      try { const d = await api(`/detail?path=${encodeURIComponent(m.detailPath)}`); if (d.subject) Object.assign(m, d.subject); } catch {}
    }
    const img = m.cover || m.image || "";
    detail.innerHTML = `
      <div class="dhero">
        ${img ? `<img src="${img}" onerror="this.style.display='none'">` : ""}
        <div class="scrim"></div>
        <button class="dback" onclick="$('detail').style.display='none'">←</button>
      </div>
      <div class="dinfo">
        <div class="dtag">${isSeries ? "Series" : "Movie"}${m.year ? " · " + m.year : ""}</div>
        <h1 class="dtitle">${esc(m.title || "")}</h1>
        <div class="dmeta"><span class="rating">★ ${m.rating || "—"}</span>${m.genre ? `<span>${esc(m.genre)}</span>` : ""}</div>
        <div class="dsynopsis">${esc(m.description || m.synopsis || "")}</div>
        <div class="dbtns">
          <button class="btn btn-play" onclick="playDetail()">▶ Play</button>
          ${isSeries ? `<button class="btn btn-ghost" onclick="toggleEpPicker()">🎬 Episodes</button>` : ""}
          <button class="btn btn-dl ${fav.includes('Remove') ? 'on' : ''}" onclick="toggleFavDetail()">${fav}</button>
        </div>
        ${isSeries ? `<div id="epPicker" class="open">${epPickerHtml(m)}</div>` : ""}
        <div class="quality-row" id="qualityRow" style="display:none"></div>
      </div>`;
    window._cur = m;
    window._isSeries = isSeries;
  } catch (e) { detail.innerHTML = `<div class="empty">Detail error: ${esc(e.message)}</div>`; }
}

function epPickerHtml(m) {
  const eps = (m.episodes && m.episodes.length) ? m.episodes : Array.from({ length: (m.totalEpisodes || 12) }, (_, i) => i + 1);
  return `<div class="dsec-label">Episodes</div><div class="ep-grid">${eps.map((e, i) => {
    const n = typeof e === "object" ? (e.episode || e.number || i + 1) : e;
    return `<button class="ep-btn${i === 0 ? " active" : ""}" onclick="playEp('${m.detailPath || ""}','${m.id}','${n}',this)">EP ${n}</button>`;
  }).join("")}</div>`;
}
function toggleEpPicker() {
  const p = $("epPicker"); if (p) p.classList.toggle("open");
}
function toggleFavDetail() {
  const m = window._cur;
  if (!m) return;
  toggleFav(m);
  const fav = isFav(m.id) ? "♥ Remove" : "♡ Save";
  const b = document.querySelector(".btn-dl"); if (b) b.textContent = fav;
}

let curPlaybackId = null;
async function playDetail() {
  const m = window._cur; if (!m) return;
  curPlaybackId = m.id;
  await startPlay(m.detailPath, m.id, window._isSeries, (m.se || 1), (m.ep || 1), m.title, m.cover, m.typeId, m.type);
}
async function playEp(detailPath, id, ep, btn) {
  document.querySelectorAll(".ep-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  curPlaybackId = id;
  const m = window._cur;
  await startPlay(detailPath, id, true, 1, ep, m && m.title, m && m.cover, m && m.typeId, m && m.type);
}

async function startPlay(detailPath, id, isSeries, se, ep, title, cover, typeId, type) {
  if (!detailPath) { toast("No stream source."); return; }
  openPlayer(title || "Now Playing");
  const vw = $("videoWrap"); vw.innerHTML = '<video id="video" controls playsinline></video>';
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
function attachVideo(src, captions) {
  const v = $("video");
  if (!v) return;
  if (window.Hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(src); hls.attachMedia(v); }
  else v.src = src;
  if (captions && captions.length) {
    const en = captions.find((c) => /en|eng|english/i.test(c.language || "")) || captions[0];
    if (en && en.url) {
      const t = document.createElement("track");
      t.kind = "subtitles"; t.label = en.language || "Subs"; t.srclang = (en.language || "en").slice(0, 2); t.src = en.url; t.default = true;
      v.appendChild(t);
    }
  }
  v.addEventListener("timeupdate", () => {
    if (v.duration && curPlaybackId) {
      const pct = Math.round((v.currentTime / v.duration) * 100);
      const cur = HISTORY.find((h) => h.id === curPlaybackId);
      if (cur) { cur.pct = pct; cur.lastWatched = Date.now(); saveHistory(); }
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
  x.className = "mini-x"; x.innerHTML = "✕"; x.onclick = (e) => { e.stopPropagation(); closePlayer(true); };
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
      <button class="dback" style="position:fixed;top:14px;left:14px" onclick="$('detail').style.display='none'">←</button>
      <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#ff7a5c);display:flex;align-items:center;justify-content:center;font-size:40px;margin-bottom:16px;font-weight:800">${esc((USER[0] || "U").toUpperCase())}</div>
      <h2 style="font-size:22px;margin:0 0 4px">${esc(USER)}</h2>
      <p style="color:var(--text-dim);font-size:13px;margin:0 0 24px">${esc(localStorage.getItem("bm_email") || "movies@broken.com")}</p>
      <button class="btn btn-play" style="width:100%;max-width:300px;margin-bottom:10px" onclick="$('detail').style.display='none';go('mylist')">♥ My List (${MYLIST.length})</button>
      <button class="btn btn-ghost" style="width:100%;max-width:300px;margin-bottom:10px" onclick="$('detail').style.display='none';showHistory()">🕒 Watch History (${HISTORY.length})</button>
      <button class="btn btn-ghost" style="width:100%;max-width:300px;margin-bottom:10px" onclick="$('detail').style.display='none';go('live')">📺 Live TV</button>
      <button class="btn btn-ghost" style="width:100%;max-width:300px;color:var(--accent)" onclick="logout()">Log Out</button>
    </div>`;
}
function showHistory() {
  if (!HISTORY.length) { $("content").innerHTML = '<div class="empty">No watch history yet. 🍿</div>'; setActive("home"); return; }
  renderGrid(HISTORY.slice().sort((a, b) => b.lastWatched - a.lastWatched), "🕒 Watch History");
}
function logout() { localStorage.removeItem("bm_user"); localStorage.removeItem("bm_email"); window.location.href = "login.html"; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 2500); }

go("home");
