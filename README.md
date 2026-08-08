# BROKEN Movies 🎬

A Netflix-style streaming website powered by the **BROKEN API**. Browse and watch **movies, TV series, anime, Nollywood, BL and K-Dramas** — with real playable streams and direct downloads.

**Live:** https://neaterry6.github.io/BROKEN-Movies/

---

## ✨ Features

- 🏠 **Homepage** — trending, nollywood, action, K-drama, BL, comedy rows + hero banner
- 🎬 Movies · 📺 TV Series · 🎌 Anime · 🇳🇬 Nollywood · 🏳️🌈 BL · 🇰🇷 K-Drama · 🎥 Hollywood
- 🎭 **Genre browsing** — action, comedy, horror, romance, scifi, drama, animation, documentary
- 🎌 **Anime genres** — action, romance, fantasy, comedy, horror, scifi, drama
- 🔍 **Universal search** — finds movies + TV + anime together
- ▶️ **Video player** — HLS + direct MP4, with **quality selector** (360/720/1080)
- 🈶 **Subtitles** — auto-attached English track, subtitle count shown
- 🎬 **Episode picker** — choose any episode for series/anime
- ❤️ **My List** — save titles (heart on every card + player)
- 🕒 **Watch History + Continue Watching** — auto-saves progress, resumes where you left off
- 📺 **Live TV** — real working channels with playable HLS streams
- 🔐 **Login / Signup** gate + profile menu

## 🔌 API Endpoints Used

- `/api/movie/home`, `/api/movie/home/trending`, `/api/movie/search`, `/api/movie/detail`, `/api/movie/download`, `/api/movie/genre/:genre`
- `/api/series`, `/api/series/download`
- `/api/anime/top`, `/api/anime/search`, `/api/anime/genre/:genre`, `/api/anime/stream`, `/api/anime/download`
- `/api/nollywood`, `/api/bl`, `/api/kdrama`, `/api/hollywood/home`, `/api/search`
- `/api/tv-channels` (Live TV)

## 🚀 Setup

The site consumes the BROKEN API. The base URL is set at the top of `index.html`:

```js
const API = "https://broken-api-production-31d5.up.railway.app/api";
```

Open `index.html` in any browser, or serve the folder with any static host.

## 🌍 Hosting

Deploy free on **GitHub Pages / Vercel / Netlify** — no backend needed.

## 👤 Demo Login

`demo@broken.com` / `broken123`
