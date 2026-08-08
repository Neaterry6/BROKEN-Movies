// BROKEN Movies — consumes BROKEN API. Netflix-style UI with real SVG icons.
const API = "https://broken-api-production-31d5.up.railway.app/api";
const $ = (id) => document.getElementById(id);
let currentView = "home";

const starSvg = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>';

function posterCard(m, row) {
  const img = m.cover || m.image || "";
  const isSeries = (m.typeId === 2 || m.type === "tv" || m.type === "series");
  const type = isSeries ? "SERIES" : "MOVIE";
  const data = JSON.stringify(m).replace(/"/g, "&quot;");
  return `<div class="card" onclick="openDetail('${data}')">
    <div class="poster">
      <span class="type-tag">${type}</span>
      ${m.rating ? `<span class="rating-badge">${starSvg}${m.rating}</span>` : ""}
      ${row === "nowplaying" ? '<span class="live-dot"></span>' : ""}
      ${img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '<div class="noimg">🎬</div>'}
      ${img ? '<div class="noimg" style="display:none">🎬</div>' : ""}
    </div>
    <div class="cinfo">
      <div class="title">${m.title || "Untitled"}</div>
      <div class="sub">${m.year ? `<span>${m.year}</span>` : ""} ${m.rating ? starSvg + m.rating : ""}</div>
    </div>
  </div>`;
}

function renderRows(sections) {
  $("content").innerHTML = sections.map((s) => `
    <section class="section">
      <div class="section-head">
        <div><h2>${s.title}</h2>${s.sub ? `<p>${s.sub}</p>` : ""}</div>
        ${s.more ? `<button class="seeall" onclick="go('${s.more}')">See All ›</button>` : ""}
      </div>
      <div class="row">${s.items.map((m) => posterCard(m, s.row)).join("")}</div>
    </section>`).join("");
  if (!sections.length) $("content").innerHTML = '<div class="empty">Nothing here yet.</div>';
}

function renderGrid(items) {
  const c = $("content");
  if (!items.length) { c.innerHTML = '<div class="empty">No results found.</div>'; return; }
  c.innerHTML = `<div class="grid">${items.map((m) => posterCard(m)).join("")}</div>`;
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

async function go(view) {
  currentView = view;
  setActive(view);
  showLoading();
  try {
    if (view === "home") {
      const d = await fetchJSON(`${API}/movie/home`);
      const s = d.homepage || {};
      renderRows([
        { title: "Trending Now", sub: "Hot right now", more: "movies", row: "nowplaying", items: s.trendingNow || [] },
        { title: "Nollywood", sub: "Top Nigerian movies", more: "nollywood", items: s.nollywood || [] },
        { title: "Action Movies", sub: "Adrenaline-packed", more: "movies", items: s.actionMovies || [] },
        { title: "Korean Dramas", sub: "Latest K-Dramas", more: "kdrama", items: s.koreanDramas || [] },
        { title: "BL Series", sub: "Boys love stories", more: "bl", items: s.blSeries || [] },
        { title: "Comedy", sub: "Laugh out loud", more: "genres", items: s.comedy || [] },
      ]);
    } else if (view === "movies") { const d = await fetchJSON(`${API}/movie/home/trending?limit=30`); renderGrid(d.movies || []); }
    else if (view === "series") {
      const d = await fetchJSON(`${API}/series`);
      renderGrid(d.series || d.tv || []);
    } else if (view === "nollywood") { const d = await fetchJSON(`${API}/nollywood?limit=30`); renderGrid(d.movies || []); }
    else if (view === "bl") { const d = await fetchJSON(`${API}/bl?limit=30`); renderGrid(d.series || []); }
    else if (view === "kdrama") { const d = await fetchJSON(`${API}/kdrama?limit=30`); renderGrid(d.series || []); }
    else if (view === "hollywood") {
      const d = await fetchJSON(`${API}/hollywood/home`);
      const s = d.hollywoodHomepage || {};
      renderRows([
        { title: "Popular", more: "movies", items: s.popular || [] },
        { title: "Action", more: "movies", items: s.action || [] },
        { title: "Blockbusters", more: "movies", items: s.blockbusters || [] },
        { title: "Romance", more: "movies", items: s.romance || [] },
      ]);
    } else if (view === "genres") {
      $("content").innerHTML = '<div class="empty">Pick a genre to browse 🎭</div>';
    }
  } catch (e) { $("content").innerHTML = `<div class="empty">Failed to load: ${e.message}</div>`; }
}

async function genre(g) {
  showLoading();
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  try {
    const d = await fetchJSON(`${API}/movie/genre/${g}?limit=24`);
    renderGrid(d.movies || []);
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
    const d = await fetchJSON(`${API}/search?q=${encodeURIComponent(q)}&per_page=24`);
    renderGrid(d.results || []);
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
      ${m.detailPath ? `<button class="btn btn-play" onclick="loadStream('${m.detailPath}','${m.id}','${isSeries}')"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play</button>` : ""}
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
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2500);
}
function openInfo() { toast("BROKEN Movies · powered by BROKEN API 🎬"); }

go("home");
