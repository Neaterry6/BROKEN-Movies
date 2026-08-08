# BROKEN Movies — Streaming Website

A full movie & series streaming website powered by the **BROKEN API**.

## Live Demo
This repo is a self-contained frontend that consumes the BROKEN API movie endpoints. It includes:
- 🏠 Homepage (trending, nollywood, action, kdrama, BL, comedy)
- 🎬 Movies / 📺 Series / 🇳🇬 Nollywood / 🏳️🌈 BL / 🇰🇷 K-Drama / 🎥 Hollywood
- 🎭 Genre browsing (action, comedy, horror, romance, scifi, drama, animation, documentary)
- 🔍 Search across all titles
- ▶️ Video player (HLS + direct stream)
- ⬇️ Download links (real CDN)
- 🔗 All API endpoints consumed

## APIs Used
- `/api/movie/home` — homepage sections
- `/api/movie/home/trending` — trending movies
- `/api/movie/search` — movie search
- `/api/movie/detail` — movie detail
- `/api/movie/download` — movie download links
- `/api/movie/genre/:genre` — genre-based movies
- `/api/series` — series list + search
- `/api/series/download` — series episode links
- `/api/nollywood` — Nollywood movies
- `/api/bl` — BL series
- `/api/kdrama` — Korean dramas
- `/api/hollywood/home` — Hollywood homepage
- `/api/search` — universal search

## Setup
The site calls the BROKEN API. Set the API base at the top of `index.html`:
```js
const API = "https://broken-api-production-31d5.up.railway.app/api";
```

Open `index.html` in any browser (or serve it with any static host).

## Hosting
Deploy free on GitHub Pages / Vercel / Netlify — no backend needed.

## Creator
Made for **brokenvzn** · powered by BROKEN API
