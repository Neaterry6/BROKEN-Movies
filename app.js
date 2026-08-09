// BROKEN Movies — consumes BROKEN API. Netflix-style UI with hero + many movie rows.
const API = "https://api.brokenvzn.de5.net/api";
const $ = (id) => document.getElementById(id);
let currentView = "home";
// Genre views reachable via See All / nav — map view name to API genre slug
const GENRE_VIEWS = { action: "action", comedy: "comedy", horror: "horror", romance: "romance", scifi: "scifi", drama: "drama", animation: "animation", documentary: "documentary" };

// LOGIN GATE
if (!localStorage.getItem("bm_user")) {
  window.location.href = "login.html";
}
const USER = localStorage.getItem("bm_user") || "user";

// ===== PERSISTED STATE: My List + Watch History =====
let MYLIST = JSON.parse(localStorage.getItem("bm_list") || "[]");
let HISTORY = JSON.parse(localStorage.getItem("bm_history") || "[]");
function saveList() { localStorage.setItem("bm_list", JSON.stringify(MYLIST)); }
function saveHistory() { localStorage.setItem("bm_history", JSON.stringify(HISTORY.slice(0, 50))); }
function isFav(id) { return MYLIST.some((x) => x.id === id); }
function toggleFav(m) {
  if (isFav(m.id)) MYLIST = MYLIST.filter((x) => x.id !== m.id);
  else MYLIST.unshift({ id: m.id, title: m.title, cover: m.cover, rating: m.rating, year: m.year, typeId: m.typeId, type: m.type, detailPath: m.detailPath });
  saveList();
  toast(isFav(m.id) ? "Added to My List ❤️" : "Removed from My List");
  const btn = $("favBtn"); if (btn) btn.classList.toggle("on", isFav(m.id));
  if (currentView === "mylist") go("mylist");
}
function addHistory(entry) {
  HISTORY = HISTORY.filter((x) => x.id !== entry.id);
  HISTORY.unshift({ ...entry, lastWatched: Date.now() });
  saveHistory();
}
function recordProgress(id, title, cover, typeId, type, detailPath, se, ep, pct) {
  const existing = HISTORY.find((x) => x.id === id);
  if (existing) { existing.pct = pct; existing.se = se; existing.ep = ep; existing.lastWatched = Date.now(); }
  else HISTORY.unshift({ id, title, cover, typeId, type, detailPath, se, ep, pct, lastWatched: Date.now() });
  saveHistory();
}

const starSvg = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>';
const playSvg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

function posterCard(m, opts = {}) {
  const img = m.cover || m.image || "";
  const isSeries = (m.typeId === 2 || m.typeId === 3 || m.type === "tv" || m.type === "series" || m.type === "anime");
  const type = isSeries ? "SERIES" : "MOVIE";
  const data = JSON.stringify(m).replace(/"/g, "&quot;");
  const fav = isFav(m.id) ? "on" : "";
  const playOverlay = opts.continueWatching ? `<div class="cplay">${playSvg}</div>` : "";
  const pct = opts.progress != null ? opts.progress : (m.pct != null ? m.pct : 0);
  const progress = (opts.continueWatching || pct > 0) ? `<div class="progress"><div style="width:${pct}%"></div></div>` : "";
  return `<div class="card">
    <button class="fav-btn ${fav}" onclick="event.stopPropagation();toggleFav(${data})" aria-label="fav"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9C.5 8 2.5 4.5 6 4.5c2 0 3.4 1 4 2 .6-1 2-2 4-2 3.5 0 5.5 3.5 3.5 7.5C19 16.5 12 21 12 21z"/></svg></button>
    <div class="poster" onclick="openDetail('${data}')">
      <span class="type-tag">${type}</span>
      ${m.rating ? `<span class="rating-badge">${starSvg}${m.rating}</span>` : ""}
      ${opts.live ? '<span class="live-dot"></span>' : ""}
      ${playOverlay}
      ${img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '<div class="noimg">🎬</div>'}
      ${img ? '<div class="noimg" style="display:none">🎬</div>' : ""}
      ${progress}
    </div>
    <div class="cinfo" onclick="openDetail('${data}')">
      <div class="title">${m.title || "Untitled"}</div>
      <div class="sub">${m.year ? `<span>${m.year}</span>` : ""} ${m.rating ? starSvg + m.rating : ""}</div>
    </div>
  </div>`;
}

function heroHtml(m, idx) {
  if (!m) return "";
  const img = m.cover || m.image || "";
  const data = JSON.stringify(m).replace(/"/g, "&quot;");
  return `<div class="hero" style="display:${idx===0?'flex':'none'}">
    ${img ? `<img src="${img}">` : ""}
    <div class="grad"></div>
    <div class="hcontent">
      <div class="hbadges">
        ${m.rating ? `<span class="hbadge star">${starSvg}${m.rating}</span>` : ""}
        ${m.year ? `<span class="hbadge">${m.year}</span>` : ""}
      </div>
      <h1>${m.title || ""}</h1>
      <div class="hmeta">${(m.description || "").slice(0, 110)}...</div>
      <div class="hbtns">
        <button class="hbtn play" onclick="openDetail('${data}')">${playSvg} Watch Now</button>
        <button class="hbtn detail" onclick="openDetail('${data}')">ℹ Details</button>
      </div>
    </div>
  </div>`;
}

function renderRows(sections, heroItems) {
  let html = "";
  if (heroItems && heroItems.length) {
    html += `<div id="heroWrap">${heroItems.slice(0, 5).map((m, i) => heroHtml(m, i)).join("")}
      <div class="dots">${heroItems.slice(0,5).map((_, i) => `<span class="dot${i===0?' active':''}" onclick="heroGo(${i})"></span>`).join("")}</div></div>`;
  }
  html += sections.map((s) => `
    <section class="section">
      <div class="section-head">
        <div class="left"><span class="accent-line"></span><div><h2>${s.title}</h2>${s.sub ? `<p>${s.sub}</p>` : ""}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          ${s.count ? `<span class="count">${s.count}</span>` : ""}
          ${s.more ? `<button class="seeall" onclick="go('${s.more}')">See All ›</button>` : ""}
        </div>
      </div>
      <div class="row">${s.items.map((m) => posterCard(m, s.opts || {})).join("")}</div>
    </section>`).join("");
  $("content").innerHTML = html;
  if (!sections.length && !heroItems) $("content").innerHTML = '<div class="empty">Nothing here yet.</div>';
}

function renderGrid(items, title) {
  const c = $("content");
  if (!items.length) { c.innerHTML = '<div class="empty">No results found.</div>'; return; }
  c.innerHTML = `${title ? `<h2 style="font-size:20px;font-weight:800;margin-bottom:14px">${title}</h2>` : ""}<div class="grid">${items.map((m) => posterCard(m)).join("")}</div>`;
}

function showLoading() { $("content").innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>'; }

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function setActive(view) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("chips").style.display = view === "genres" ? "flex" : "none";
  $("animeChips").style.display = view === "anime" ? "flex" : "none";
  const ep = $("epicker"); if (ep) ep.style.display = "none";
}

let heroIndex = 0;
function heroGo(i) {
  heroIndex = i;
  document.querySelectorAll("#heroWrap .hero").forEach((h, x) => (h.style.display = x === i ? "flex" : "none"));
  document.querySelectorAll("#heroWrap .dot").forEach((d, x) => d.classList.toggle("active", x === i));
}

async function go(view) {
  currentView = view;
  setActive(view);
  showLoading();
  try {
    if (view === "home") {
      const d = await fetchJSON(`${API}/movie/home`);
      const s = d.homepage || {};
      const all = [...(s.trendingNow||[]), ...(s.nollywood||[]), ...(s.actionMovies||[])];
      const cw = HISTORY.filter((h) => h.detailPath).slice(0, 8);
      const rows = [];
      if (cw.length) rows.push({ title: "Continue Watching", sub: "Pick up where you left off", count: `${cw.length} item`, opts: { continueWatching: true }, items: cw });
      rows.push(
        { title: "Trending Now", sub: "Hot right now", more: "movies", opts: { live: true }, items: s.trendingNow || [] },
        { title: "Nollywood", sub: "Top Nigerian movies", more: "nollywood", items: s.nollywood || [] },
        { title: "Action Movies", sub: "Adrenaline-packed", more: "action", items: s.actionMovies || [] },
        { title: "Korean Dramas", sub: "Latest K-Dramas", more: "kdrama", items: s.koreanDramas || [] },
        { title: "BL Series", sub: "Boys love stories", more: "bl", items: s.blSeries || [] },
        { title: "Comedy", sub: "Laugh out loud", more: "comedy", items: s.comedy || [] }
      );
      renderRows(rows, all);
    } else if (view === "mylist") {
      renderGrid(MYLIST.slice().sort((a,b)=>(b.id==="x"?0:0)) , MYLIST.length ? "My List" : "");
      if (!MYLIST.length) $("content").innerHTML = '<div class="empty">Your My List is empty. Tap ❤️ on any title to save it.</div>';
    } else if (view === "live") {
      const d = await fetchJSON(`${API}/tv-channels?limit=40`);
      renderLive(d.channels || []);
    } else if (view === "movies") { const d = await fetchJSON(`${API}/movie/home/trending?limit=100`); renderGrid(d.movies || [], "Movies"); }
    else if (view === "series") { const d = await fetchJSON(`${API}/series?limit=100`); renderGrid(d.series || d.tv || [], "TV Series"); }
    else if (view === "nollywood") { const d = await fetchJSON(`${API}/nollywood?limit=100`); renderGrid(d.movies || [], "Nollywood"); }
    else if (view === "bl") { const d = await fetchJSON(`${API}/bl?limit=100`); renderGrid(d.series || [], "BL Series"); }
    else if (view === "kdrama") { const d = await fetchJSON(`${API}/kdrama?limit=100`); renderGrid(d.series || [], "K-Dramas"); }
    else if (view === "hollywood") {
      const d = await fetchJSON(`${API}/hollywood/home`);
      const s = d.hollywoodHomepage || {};
      renderRows([
        { title: "Popular", more: "movies", items: s.popular || [] },
        { title: "Action", more: "movies", items: s.action || [] },
        { title: "Blockbusters", more: "movies", items: s.blockbusters || [] },
        { title: "Romance", more: "movies", items: s.romance || [] },
      ], (s.popular || []).slice(0, 5));
    } else if (view === "anime") {
      $("animeChips").style.display = "flex";
      $("chips").style.display = "none";
      const d = await fetchJSON(`${API}/anime/top?limit=100`);
      renderGrid(d.anime || [], "Anime");
    } else if (view === "genres") {
      const d = await fetchJSON(`${API}/movie/genre/action?limit=60`);
      renderGrid(d.movies || [], "Browse by Genre");
    } else if (GENRE_VIEWS[view]) {
      const d = await fetchJSON(`${API}/movie/genre/${GENRE_VIEWS[view]}?limit=80`);
      renderGrid(d.movies || [], view[0].toUpperCase() + view.slice(1) + " Movies");
    }
  } catch (e) { $("content").innerHTML = `<div class="empty">Failed to load: ${e.message}</div>`; }
}

async function genre(g) {
  showLoading();
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  try {
    const d = await fetchJSON(`${API}/movie/genre/${g}?limit=30`);
    renderGrid(d.movies || [], g[0].toUpperCase() + g.slice(1) + " Movies");
    [...document.querySelectorAll(".chip")].find((c) => c.textContent.toLowerCase() === g)?.classList.add("active");
  } catch (e) { $("content").innerHTML = `<div class="empty">Genre failed: ${e.message}</div>`; }
}

function toggleSearch() { $("searchbar").classList.toggle("open"); }

async function search() {
  const q = $("q").value.trim();
  if (!q) return;
  setActive("");
  showLoading();
  try {
    const d = await fetchJSON(`${API}/search?q=${encodeURIComponent(q)}&per_page=30`);
    renderGrid(d.results || [], `Results for "${q}"`);
  } catch (e) { $("content").innerHTML = `<div class="empty">Search failed: ${e.message}</div>`; }
}

async function openDetail(dataStr) {
  const m = JSON.parse(dataStr);
  setCur(m);
  if (m.detailPath) {
    try { const d = await fetchJSON(`${API}/detail?path=${encodeURIComponent(m.detailPath)}`); if (d.subject) Object.assign(m, d.subject); } catch {}
  }
  const img = m.cover || m.image || "";
  const isSeries = (m.typeId === 2 || m.typeId === 3 || m.type === "tv" || m.type === "series" || m.type === "anime");
  const favOn = isFav(m.id) ? "on" : "";
  $("modalBox").innerHTML = `
    <div style="position:relative">
      ${img ? `<img src="${img}" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:14px">` : ""}
      <button id="favBtn" class="fav-btn ${favOn}" onclick="toggleFav(${JSON.stringify(m).replace(/"/g, '&quot;')})" style="position:absolute;top:10px;right:10px"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9C.5 8 2.5 4.5 6 4.5c2 0 3.4 1 4 2 .6-1 2-2 4-2 3.5 0 5.5 3.5 3.5 7.5C19 16.5 12 21 12 21z"/></svg></button>
    </div>
    <h2>${m.title || ""}</h2>
    <div class="modal-meta">
      ${m.year ? `<span>📅 ${m.year}</span>` : ""}
      ${m.rating ? `<span class="star">${starSvg}${m.rating}</span>` : ""}
      ${m.duration ? `<span>⏱ ${m.duration}</span>` : ""}
      ${m.country ? `<span>🌍 ${m.country}</span>` : ""}
    </div>
    <div class="modal-desc">${m.description || "No description available."}</div>
    <div class="mactions">
      ${m.detailPath ? `<button class="btn btn-play" onclick="loadStream('${m.detailPath}','${m.id}','${isSeries}','1','1')">${playSvg}Play</button>` : ""}
      ${m.detailPath && isSeries ? `<button class="btn btn-dl" onclick="openEpPicker('${m.detailPath}','${m.id}','${isSeries}')">🎬 Episodes</button>` : ""}
      ${m.detailPath ? `<button class="btn btn-dl" onclick="loadDownload('${m.detailPath}','${m.id}','${isSeries}','1','1')"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>Download</button>` : ""}
      <button class="btn btn-close" onclick="closeModal()">Close</button>
    </div>
    <div class="quality-row" id="qualityRow" style="display:none"></div>
    <div class="player" id="player"></div>
    <div class="links" id="links"></div>`;
  $("modal").classList.add("open");
}

let curTitle = "", curCover = "", curTypeId = 0, curType = "";
function setCur(m) { curTitle = m.title; curCover = m.cover; curTypeId = m.typeId; curType = m.type; }

async function loadStream(detailPath, id, isSeries, se, ep, title, cover, typeId, type) {
  const player = $("player");
  player.style.display = "block";
  player.innerHTML = '<div class="loading">Loading stream...</div>';
  try {
    const url = `${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? `&se=${se || 1}&ep=${ep || 1}` : ""}`;
    const d = await fetchJSON(url);
    const dl = d.downloads || [];
    // quality selector
    const qr = $("qualityRow");
    if (dl.length > 1) {
      qr.style.display = "flex";
      qr.innerHTML = dl.map((x, i) => `<button class="q-btn ${i===0?'active':''}" onclick="pickQuality('${detailPath}','${id}','${isSeries}','${se||1}','${ep||1}','${x.resolution||''}',this)">${x.resolution ? x.resolution + 'p' : x.format || 'MP4'}</button>`).join("");
    } else qr.style.display = "none";
    const src = d.streamUrl || d.m3u8 || (dl[0] && dl[0].url);
    if (!src) { player.innerHTML = '<div class="empty">No stream available.</div>'; return; }
    renderVideo(src, d.captions || []);
    addHistory({ id, title: title || curTitle, cover: cover || curCover, typeId: typeId != null ? typeId : curTypeId, type: type || curType, detailPath });
    recordProgress(id, title || curTitle, cover || curCover, typeId != null ? typeId : curTypeId, type || curType, detailPath, se || 1, ep || 1, 0);
  } catch (e) { player.innerHTML = `<div class="empty">Stream error: ${e.message}</div>`; }
}

let curSrc = "", curCaptions = [];
function pickQuality(detailPath, id, isSeries, se, ep, res, btn) {
  document.querySelectorAll(".q-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  const player = $("player");
  player.innerHTML = '<div class="loading">Loading...</div>';
  (async () => {
    const d = await fetchJSON(`${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? `&se=${se}&ep=${ep}` : ""}`);
    const dl = d.downloads || [];
    const pick = dl.find((x) => String(x.resolution) === String(res)) || dl[0];
    if (pick && pick.url) renderVideo(pick.url, d.captions || []);
    else player.innerHTML = '<div class="empty">Quality not available.</div>';
  })().catch((e) => { player.innerHTML = `<div class="empty">Error: ${e.message}</div>`; });
}

function renderVideo(src, captions) {
  curSrc = src; curCaptions = captions || [];
  const player = $("player");
  player.innerHTML = `<video id="video" controls autoplay style="width:100%;height:100%"></video>`;
  const video = $("video");
  if (window.Hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(src); hls.attachMedia(video); }
  else video.src = src;
  // subtitle track (first English caption)
  if (curCaptions.length) {
    const en = curCaptions.find((c) => /en|eng|english/i.test(c.language || "")) || curCaptions[0];
    if (en && en.url) {
      const t = document.createElement("track"); t.kind = "subtitles"; t.label = (en.language||"Subs"); t.srclang = (en.language||"en").slice(0,2); t.src = en.url; t.default = true;
      video.appendChild(t);
    }
  }
  // save progress on timeupdate
  video.addEventListener("timeupdate", () => {
    if (video.duration) {
      const pct = Math.round((video.currentTime / video.duration) * 100);
      const cur = HISTORY.find((h) => h.id === curPlaybackId);
      if (cur) { cur.pct = pct; cur.lastWatched = Date.now(); saveHistory(); }
    }
  });
}
let curPlaybackId = null;
async function loadDownload(detailPath, id, isSeries, se, ep) {
  curPlaybackId = id;
  const links = $("links");
  links.innerHTML = '<div class="loading">Fetching links...</div>';
  try {
    const url = `${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? `&se=${se||1}&ep=${ep||1}` : ""}`;
    const d = await fetchJSON(url);
    const dl = d.downloads || [];
    if (dl.length) {
      links.innerHTML = dl.map((x) => `<a class="btn btn-dl" target="_blank" rel="noopener" href="${x.url}">⬇ ${x.resolution ? x.resolution + "p" : "MP4"} ${x.format || ""} ${x.size ? '(' + Math.round(x.size/1048576) + 'MB)' : ''}</a>`).join("");
      links.innerHTML += `<div style="margin-top:8px;color:var(--muted);font-size:11px">Tip: if the CDN says 429/Too Many Requests, wait a minute and retry — the file host rate-limits.</div>`;
      if ((d.captions||[]).length) links.innerHTML += `<div style="margin-top:8px;color:var(--muted);font-size:11px">${(d.captions||[]).length} subtitle languages available</div>`;
    } else if (d.streamUrl || d.m3u8) {
      links.innerHTML = `<a class="btn btn-play" target="_blank" href="${d.streamUrl || d.m3u8}">▶ Open stream link</a>`;
    } else links.innerHTML = `<div class="empty">No links available.</div>`;
  } catch (e) { links.innerHTML = `<div class="empty">Link error: ${e.message}</div>`; }
}

async function openEpPicker(detailPath, id, isSeries) {
  const ep = $("epicker");
  ep.style.display = "block";
  ep.innerHTML = '<div class="loading">Loading episodes...</div>';
  try {
    const d = await fetchJSON(`${API}/detail?path=${encodeURIComponent(detailPath)}`);
    const seasons = d.seasons || [];
    if (!seasons.length) { ep.innerHTML = `<div class="empty">No episode info.<button class="btn btn-close" onclick="ep.style.display='none'">Close</button></div>`; return; }
    const maxEp = seasons[0] && seasons[0].maxEpisode ? seasons[0].maxEpisode : 24;
    const epNum = Math.min(maxEp, 60);
    ep.innerHTML = `<h4>Select Episode <button class="close-ep" onclick="document.getElementById('epicker').style.display='none'">✕</button></h4><div class="ep-grid">
      ${Array.from({length: epNum}, (_, i) => `<button class="ep-btn" onclick="pickEp('${detailPath}','${id}','${isSeries}',${i+1})">${i+1}</button>`).join("")}
    </div>`;
  } catch (e) { ep.innerHTML = `<div class="empty">Episode error: ${e.message}</div>`; }
}
function pickEp(detailPath, id, isSeries, n) {
  $("epicker").style.display = "none";
  loadStream(detailPath, id, isSeries, 1, n);
}

function renderLive(channels) {
  const c = $("content");
  if (!channels.length) { c.innerHTML = '<div class="empty">No channels loaded.</div>'; return; }
  c.innerHTML = `<h2 style="font-size:20px;font-weight:800;margin-bottom:14px">📺 Live TV</h2>
    <div class="live-grid">${channels.map((ch) => `
      <div class="live-card" onclick="playLive('${encodeURIComponent(ch.stream || '')}','${ch.name.replace(/'/g, '')}')">
        <div class="lc-logo">${ch.logo ? `<img src="${ch.logo}" onerror="this.remove()">` : "📺"}</div>
        <div>
          <div class="lc-name">${ch.name}</div>
          <div class="lc-meta">${(ch.country||[]).join(', ')} · ${(ch.categories||[]).slice(0,2).join(', ')}</div>
          ${ch.stream ? '<span style="color:#ff4757;font-size:11px;font-weight:700">● LIVE</span>' : '<span style="color:var(--muted);font-size:11px">no stream</span>'}
        </div>
      </div>`).join("")}</div>`;
}
function playLive(streamUrl, name) {
  const box = $("modalBox");
  box.innerHTML = `<h2>${name}</h2>
    <div class="player" id="player" style="display:block;height:220px"></div>
    <div class="mactions"><button class="btn btn-close" onclick="closeModal()">Close</button></div>`;
  $("modal").classList.add("open");
  const src = decodeURIComponent(streamUrl);
  if (!src) { $("player").innerHTML = '<div class="empty">No stream available for this channel.</div>'; return; }
  $("player").innerHTML = `<video id="video" controls autoplay style="width:100%;height:100%"></video>`;
  const video = $("video");
  if (window.Hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(src); hls.attachMedia(video); }
  else video.src = src;
}

async function animeGenre(g) {
  showLoading();
  document.querySelectorAll("#animeChips .chip").forEach((c) => c.classList.remove("active"));
  [...document.querySelectorAll("#animeChips .chip")].find((c) => c.textContent.toLowerCase() === g)?.classList.add("active");
  try {
    const d = await fetchJSON(`${API}/anime/genre/${g}?limit=60`);
    renderGrid(d.anime || [], "Anime · " + g[0].toUpperCase() + g.slice(1));
  } catch (e) { $("content").innerHTML = `<div class="empty">Anime genre failed: ${e.message}</div>`; }
}

function closeModal() { $("modal").classList.remove("open"); $("epicker").style.display = "none"; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 2500); }
function openInfo() { toast("BROKEN Movies · powered by BROKEN API 🎬"); }
function showHistory() {
  if (!HISTORY.length) { $("content").innerHTML = '<div class="empty">No watch history yet. Play something! 🍿</div>'; return; }
  renderGrid(HISTORY.slice().sort((a, b) => b.lastWatched - a.lastWatched), "🕒 Watch History");
}
function openProfile() {
  const modal = $("modal"), box = $("modalBox");
  box.innerHTML = `
    <div style="text-align:center;padding:10px">
      <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--red),#ff4d4d);display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 14px">${(USER[0]||'U').toUpperCase()}</div>
      <h2>${USER}</h2>
      <p style="color:var(--muted);font-size:13px;margin-bottom:20px">${localStorage.getItem("bm_email") || "broken@movies.com"}</p>
      <button class="btn btn-play" onclick="closeModal();go('mylist')">❤️ My List (${MYLIST.length})</button>
      <button class="btn btn-dl" onclick="closeModal();go('live')">📺 Live TV</button>
      <button class="btn btn-dl" onclick="closeModal();showHistory()">🕒 Watch History (${HISTORY.length})</button>
      <button class="btn btn-close" style="margin-top:8px" onclick="logout()">Log Out</button>
    </div>`;
  modal.classList.add("open");
}
function logout() { localStorage.removeItem("bm_user"); localStorage.removeItem("bm_email"); window.location.href = "login.html"; }

// auto-rotate hero
setInterval(() => {
  const heroes = document.querySelectorAll("#heroWrap .hero");
  if (heroes.length > 1) heroGo((heroIndex + 1) % Math.min(heroes.length, 5));
}, 6000);

go("home");
