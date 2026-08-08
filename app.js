// BROKEN Movies — consumes BROKEN API. Netflix-style UI with hero + many movie rows.
const API = "https://broken-api-production-31d5.up.railway.app/api";
const $ = (id) => document.getElementById(id);
let currentView = "home";

// LOGIN GATE
if (!localStorage.getItem("bm_user")) {
  window.location.href = "login.html";
}
const USER = localStorage.getItem("bm_user") || "user";

const starSvg = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>';
const playSvg = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

function posterCard(m, opts = {}) {
  const img = m.cover || m.image || "";
  const isSeries = (m.typeId === 2 || m.type === "tv" || m.type === "series");
  const type = isSeries ? "SERIES" : "MOVIE";
  const data = JSON.stringify(m).replace(/"/g, "&quot;");
  const playOverlay = opts.continueWatching ? `<div class="cplay">${playSvg}</div>` : "";
  const progress = opts.progress ? `<div class="progress"><div style="width:${opts.progress}%"></div></div>` : "";
  return `<div class="card" onclick="openDetail('${data}')">
    <div class="poster">
      <span class="type-tag">${type}</span>
      ${m.rating ? `<span class="rating-badge">${starSvg}${m.rating}</span>` : ""}
      ${opts.live ? '<span class="live-dot"></span>' : ""}
      ${playOverlay}
      ${img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '<div class="noimg">🎬</div>'}
      ${img ? '<div class="noimg" style="display:none">🎬</div>' : ""}
      ${progress}
    </div>
    <div class="cinfo">
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
      renderRows([
        { title: "Continue Watching", sub: "Pick up where you left off", count: `${s.trendingNow?.length || 1} item`, opts: { continueWatching: true, progress: 45 }, items: (s.trendingNow||[]).slice(0, 6) },
        { title: "Trending Now", sub: "Hot right now", more: "movies", opts: { live: true }, items: s.trendingNow || [] },
        { title: "Nollywood", sub: "Top Nigerian movies", more: "nollywood", items: s.nollywood || [] },
        { title: "Action Movies", sub: "Adrenaline-packed", more: "genres", items: s.actionMovies || [] },
        { title: "Korean Dramas", sub: "Latest K-Dramas", more: "kdrama", items: s.koreanDramas || [] },
        { title: "BL Series", sub: "Boys love stories", more: "bl", items: s.blSeries || [] },
        { title: "Comedy", sub: "Laugh out loud", more: "genres", items: s.comedy || [] },
      ], all);
    } else if (view === "movies") { const d = await fetchJSON(`${API}/movie/home/trending?limit=40`); renderGrid(d.movies || [], "Movies"); }
    else if (view === "series") { const d = await fetchJSON(`${API}/series`); renderGrid(d.series || d.tv || [], "TV Series"); }
    else if (view === "nollywood") { const d = await fetchJSON(`${API}/nollywood?limit=40`); renderGrid(d.movies || [], "Nollywood"); }
    else if (view === "bl") { const d = await fetchJSON(`${API}/bl?limit=40`); renderGrid(d.series || [], "BL Series"); }
    else if (view === "kdrama") { const d = await fetchJSON(`${API}/kdrama?limit=40`); renderGrid(d.series || [], "K-Dramas"); }
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
      const d = await fetchJSON(`${API}/anime/top`);
      renderGrid(d.anime || [], "Anime");
    } else if (view === "genres") {
      $("content").innerHTML = '<div class="empty">Pick a genre to browse 🎭</div>';
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
  if (m.detailPath) {
    try { const d = await fetchJSON(`${API}/detail?path=${encodeURIComponent(m.detailPath)}`); if (d.subject) Object.assign(m, d.subject); } catch {}
  }
  const img = m.cover || m.image || "";
  const isSeries = (m.typeId === 2 || m.type === "tv" || m.type === "series");
  $("modalBox").innerHTML = `
    ${img ? `<img src="${img}" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;margin-bottom:14px">` : ""}
    <h2>${m.title || ""}</h2>
    <div class="modal-meta">
      ${m.year ? `<span>📅 ${m.year}</span>` : ""}
      ${m.rating ? `<span class="star">${starSvg}${m.rating}</span>` : ""}
      ${m.duration ? `<span>⏱ ${m.duration}</span>` : ""}
      ${m.country ? `<span>🌍 ${m.country}</span>` : ""}
    </div>
    <div class="modal-desc">${m.description || "No description available."}</div>
    <div class="mactions">
      ${m.detailPath ? `<button class="btn btn-play" onclick="loadStream('${m.detailPath}','${m.id}','${isSeries}')">${playSvg}Play</button>` : ""}
      ${m.detailPath ? `<button class="btn btn-dl" onclick="loadDownload('${m.detailPath}','${m.id}','${isSeries}')"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>Download</button>` : ""}
      <button class="btn btn-close" onclick="closeModal()">Close</button>
    </div>
    <div class="player" id="player"></div>
    <div class="links" id="links"></div>`;
  $("modal").classList.add("open");
}

async function loadStream(detailPath, id, isSeries) {
  const player = $("player");
  player.style.display = "block";
  player.innerHTML = '<div class="loading">Loading stream...</div>';
  try {
    const d = await fetchJSON(`${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? "&se=1&ep=1" : ""}`);
    const src = d.streamUrl || d.m3u8 || (d.downloads && d.downloads[0] && d.downloads[0].url);
    if (!src) { player.innerHTML = '<div class="empty">No stream available.</div>'; return; }
    player.innerHTML = `<video id="video" controls autoplay style="width:100%;height:100%"></video>`;
    const video = $("video");
    if (window.Hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(src); hls.attachMedia(video); }
    else video.src = src;
  } catch (e) { player.innerHTML = `<div class="empty">Stream error: ${e.message}</div>`; }
}

async function loadDownload(detailPath, id, isSeries) {
  const links = $("links");
  links.innerHTML = '<div class="loading">Fetching links...</div>';
  try {
    const d = await fetchJSON(`${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? "&se=1&ep=1" : ""}`);
    const dl = d.downloads || [];
    if (dl.length) {
      links.innerHTML = dl.map((x) => `<a class="btn btn-dl" target="_blank" href="${x.url}">⬇ Download ${x.format || "MP4"} ${x.resolution ? x.resolution + "p" : ""}</a>`).join("");
    } else if (d.streamUrl || d.m3u8) {
      links.innerHTML = `<a class="btn btn-play" target="_blank" href="${d.streamUrl || d.m3u8}">▶ Open stream link</a>`;
    } else links.innerHTML = `<div class="empty">No links available.</div>`;
  } catch (e) { links.innerHTML = `<div class="empty">Link error: ${e.message}</div>`; }
}

function closeModal() { $("modal").classList.remove("open"); }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 2500); }
function openInfo() { toast("BROKEN Movies · powered by BROKEN API 🎬"); }
function openProfile() {
  const modal = $("modal"), box = $("modalBox");
  box.innerHTML = `
    <div style="text-align:center;padding:10px">
      <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--red),#ff4d4d);display:flex;align-items:center;justify-content:center;font-size:34px;margin:0 auto 14px">${(USER[0]||'U').toUpperCase()}</div>
      <h2>${USER}</h2>
      <p style="color:var(--muted);font-size:13px;margin-bottom:20px">${localStorage.getItem("bm_email") || "broken@movies.com"}</p>
      <button class="btn btn-play" onclick="toast('Profile coming soon 👤')">👤 My Profile</button>
      <button class="btn btn-dl" onclick="toast('Watchlist coming soon ❤️')">❤️ My Watchlist</button>
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
