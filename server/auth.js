// BROKEN Movies — auth, admin, and security middleware.
// Users stored in a JSON file (users.json). Sessions are signed tokens.
// Also provides rate limiting + bot/scraper blocking.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USERS_FILE = path.join(__dirname, "users.json");
const SECRET = process.env.BM_SECRET || crypto.randomBytes(16).toString("hex");

// ---- helpers ----
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return []; }
}
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
function hashPw(p, salt) {
  return crypto.createHmac("sha256", salt).update(p).digest("hex");
}
function makeToken(userId, role) {
  const payload = JSON.stringify({ uid: userId, role, exp: Date.now() + 30 * 24 * 3600 * 1000 });
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(payload + "." + sig).toString("base64url");
}
function verifyToken(token) {
  try {
    const s = Buffer.from(token, "base64url").toString();
    const i = s.lastIndexOf(".");
    if (i < 0) return null;
    const payload = s.slice(0, i);
    const sig = s.slice(i + 1);
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (sig !== expected) return null;
    const p = JSON.parse(payload);
    if (p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

// ---- auth ----
function signup({ name, email, password }) {
  const users = loadUsers();
  const em = String(email || "").trim().toLowerCase();
  if (!name || !em || !password || password.length < 6) return { error: "Name, valid email and 6+ char password required." };
  if (users.some((u) => u.email === em)) return { error: "An account with that email already exists." };
  const salt = crypto.randomBytes(8).toString("hex");
  const user = { id: crypto.randomUUID(), name: String(name).trim(), email: em, password: hashPw(password, salt), salt, role: "user", created: Date.now(), ip: "" };
  users.push(user); saveUsers(users);
  return { ok: true, token: makeToken(user.id, user.role), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
function login({ email, password }) {
  const users = loadUsers();
  const em = String(email || "").trim().toLowerCase();
  const user = users.find((u) => u.email === em);
  if (!user || hashPw(password || "", user.salt) !== user.password) return { error: "Invalid email or password." };
  return { ok: true, token: makeToken(user.id, user.role), user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
function authUser(token) {
  const p = verifyToken(token);
  if (!p) return null;
  const user = loadUsers().find((u) => u.id === p.uid);
  return user || null;
}

// ---- security: rate limiting ----
const buckets = new Map(); // ip -> { count, reset }
const RATE_LIMIT = { windowMs: 60000, max: 120 }; // 120 req/min per IP
function rateLimit(ip) {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) { buckets.set(ip, { count: 1, reset: now + RATE_LIMIT.windowMs }); return false; }
  b.count++;
  return b.count > RATE_LIMIT.max;
}
// Bot/scraper blocklist (User-Agent substrings that are headless/scraping).
const BOT_PATTERNS = [
  "python", "curl", "wget", "scrapy", "go-http-client", "okhttp", "apache-http",
  "java/", "ruby", "node-fetch", "axios", "libwww", "lwp-", "nikto", "sqlmap",
  "nmap", "zgrab", "masscan", "headless", "phantomjs", "selenium", "pyppeteer",
  "playwright", "puppeteer", "httpx", "postman", "insomnia", "bot", "crawler",
  "spider", "semrush", "ahrefs", "petalbot", "baiduspider", "yandex", "mj12bot",
];
function isBot(ua) {
  if (!ua) return false;
  const s = ua.toLowerCase();
  return BOT_PATTERNS.some((p) => s.includes(p));
}

// Express middleware: applies rate limit + bot blocking to API requests.
function securityMw(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "0.0.0.0";
  // Block known scrapers on API + admin routes.
  if (req.path.startsWith("/api") || req.path.startsWith("/admin")) {
    if (isBot(req.headers["user-agent"])) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    if (rateLimit(ip)) {
      return res.status(429).json({ ok: false, error: "Too many requests. Slow down." });
    }
  }
  req._ip = ip;
  next();
}

// ---- admin stats ----
function adminStats() {
  const users = loadUsers();
  // Activity tracked in memory (per-user request counts).
  return { users: users.length, admins: users.filter((u) => u.role === "admin").length, registered: users };
}
function recordActivity(ip, path) {
  // lightweight in-memory activity log
  if (!global.__activity) global.__activity = [];
  global.__activity.unshift({ t: Date.now(), ip, path });
  if (global.__activity.length > 500) global.__activity.length = 500;
}

module.exports = { signup, login, authUser, securityMw, adminStats, recordActivity, loadUsers, saveUsers, verifyToken };
