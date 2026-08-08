// BROKEN Movies — consumes BROKEN API movie/series endpoints
const API = "https://broken-api-production-31d5.up.railway.app/api";
const $ = (id) => document.getElementById(id);
let currentView = "home";

function cardHtml(m) {
  const img = m.cover || m.image || "";
  const isSeries = (m.typeId === 2 || m.type === "tv" || m.type === "series");
  const type = isSeries ? "SERIES" : "MOVIE";
  const data = JSON.stringify(m).replace(/"/g, "&quot;");
  return `<div class="card" onclick="openDetail('${data}')">
    <div class="poster">
      <span class="type-tag">${type}</span>
      ${img ? `<img src="${img}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '<div class="noimg">🎬</div>'}
      ${img ? '<div class="noimg" style="display:none">🎬</div>' : ""}
    </div>
    <div class="info">
      <div class="title">${m.title || "Untitled"}</div>
      <div class="meta">
        ${m.rating ? `<span class="rating">★ ${m.rating}</span>` : ""}
        ${m.year ? `<span class="badge">${m.year}</span>` : ""}
      </div>
    </div>
  </div>`;
}

function render(items) {
  const c = $("content");
  if (!items.length) { c.innerHTML = '<div class="empty">No results found. Try another search or category.</div>'; return; }
  c.innerHTML = `<div class="grid">${items.map(cardHtml).join("")}</div>`;
}

function showLoading() { $("content").innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>'; }

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

async function go(view) {
  currentView = view;
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("genrebar").style.display = view === "genres" ? "flex" : "none";
  showLoading();
  try {
    let items = [];
    if (view === "home") {
      const d = await fetchJSON(`${API}/movie/home`);
      const sec = d.homepage || {};
      items = [...(sec.trendingNow||[]), ...(sec.nollywood||[]), ...(sec.actionMovies||[]), ...(sec.koreanDramas||[]), ...(sec.blSeries||[]), ...(sec.comedy||[])];
    } else if (view === "movies") { const d = await fetchJSON(`${API}/movie/home/trending?limit=30`); items = d.movies || []; }
    else if (view === "series") { const d = await fetchJSON(`${API}/series`); items = d.series || d.tv || []; }
    else if (view === "nollywood") { const d = await fetchJSON(`${API}/nollywood?limit=30`); items = d.movies || []; }
    else if (view === "bl") { const d = await fetchJSON(`${API}/bl?limit=30`); items = d.series || []; }
    else if (view === "kdrama") { const d = await fetchJSON(`${API}/kdrama?limit=30`); items = d.series || []; }
    else if (view === "hollywood") {
      const d = await fetchJSON(`${API}/hollywood/home`);
      const sec = d.hollywoodHomepage || {};
      items = [...(sec.popular||[]), ...(sec.action||[]), ...(sec.blockbusters||[]), ...(sec.romance||[])];
    } else if (view === "genres") {
      items = [];
      $("content").innerHTML = '<div class="empty">Pick a genre above to browse 🎭</div>';
      return;
    }
    render(items);
  } catch (e) { $("content").innerHTML = `<div class="empty">Failed to load: ${e.message}</div>`; }
}

async function genre(g) {
  showLoading();
  document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  try {
    const d = await fetchJSON(`${API}/movie/genre/${g}?limit=24`);
    render(d.movies || []);
    const chip = [...document.querySelectorAll(".chip")].find((c) => c.textContent.toLowerCase() === g);
    if (chip) chip.classList.add("active");
  } catch (e) { $("content").innerHTML = `<div class="empty">Genre failed: ${e.message}</div>`; }
}

async function search() {
  const q = $("q").value.trim();
  if (!q) return;
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.remove("active"));
  $("genrebar").style.display = "none";
  showLoading();
  try {
    const d = await fetchJSON(`${API}/search?q=${encodeURIComponent(q)}&per_page=24`);
    render(d.results || []);
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
      ${m.rating ? `<span class="rating">★ ${m.rating}</span>` : ""}
      ${m.duration ? `<span>⏱ ${m.duration}</span>` : ""}
      ${m.country ? `<span>🌍 ${m.country}</span>` : ""}
    </div>
    <div class="modal-desc">${m.description || "No description available."}</div>
    <div class="modal-actions">
      ${m.detailPath ? `<button class="btn btn-primary" onclick="loadStream('${m.detailPath}','${m.id}','${isSeries}')">▶ Watch</button>` : ""}
      ${m.detailPath ? `<button class="btn btn-download" onclick="loadDownload('${m.detailPath}','${m.id}','${isSeries}')">⬇ Download</button>` : ""}
      <button class="btn btn-close" onclick="closeModal()">Close</button>
    </div>
    <div class="player" id="player" style="display:none"></div>
    <div id="links" class="links" style="display:none"></div>`;
  $("modal").classList.add("open");
}

async function loadStream(detailPath, id, isSeries) {
  const player = $("player");
  const links = $("links");
  player.style.display = "block";
  player.innerHTML = '<div class="loading">Loading stream...</div>';
  links.style.display = "none";
  try {
    const d = await fetchJSON(`${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? "&se=1&ep=1" : ""}`);
    const src = d.streamUrl || d.m3u8 || (d.downloads && d.downloads[0] && d.downloads[0].url);
    if (!src) { player.innerHTML = '<div class="empty">No stream available. Try download.</div>'; return; }
    player.innerHTML = `<video id="video" controls autoplay style="width:100%;height:100%"></video>`;
    const video = $("video");
    if (window.Hls && Hls.isSupported()) { const hls = new Hls(); hls.loadSource(src); hls.attachMedia(video); }
    else if (video.canPlayType("application/vnd.apple.mpegurl")) { video.src = src; }
    else { video.src = src; }
  } catch (e) { player.innerHTML = `<div class="empty">Stream error: ${e.message}</div>`; }
}

async function loadDownload(detailPath, id, isSeries) {
  const links = $("links");
  links.style.display = "flex";
  links.innerHTML = '<div class="loading">Fetching links...</div>';
  try {
    const d = await fetchJSON(`${API}/download?path=${encodeURIComponent(detailPath)}&id=${id}${isSeries === "true" ? "&se=1&ep=1" : ""}`);
    const dl = d.downloads || [];
    if (dl.length) {
      links.innerHTML = '<div class="section-title" style="font-size:14px">⬇️ Available quality</div>' +
        dl.map((x) => `<a class="btn btn-download" target="_blank" href="${x.url}">Download ${x.format || "MP4"} ${x.resolution ? x.resolution + "p" : ""}</a>`).join("");
    } else if (d.streamUrl || d.m3u8) {
      links.innerHTML = `<a class="btn btn-primary" target="_blank" href="${d.streamUrl || d.m3u8}">▶ Open stream link</a>`;
    } else {
      links.innerHTML = `<div class="empty">No direct links for this title.</div><pre style="background:var(--panel2);padding:10px;border-radius:8px;font-size:11px;overflow:auto">${JSON.stringify(d, null, 2)}</pre>`;
    }
  } catch (e) { links.innerHTML = `<div class="empty">Link error: ${e.message}</div>`; }
}

function closeModal() { $("modal").classList.remove("open"); }

go("home");
