# EMA Trader — Fix Notes & Deployment Guide

## What was fixed in this update

1. **Notifications popup REMOVED** — Signal popups were firing constantly and blocking UI. Now disabled; signals are shown inline on the chart header only.
2. **Chart cleaned up** — Removed MACD and RSI. Only EMA 9 (green) and EMA 15 (orange) remain.
3. **Backend CORS fixed** — All *.vercel.app preview URLs now accepted automatically.
4. **Offline error states** — Markets, Signals, Option Chain pages now show a clear error + link to wake Render backend, instead of being blank.

---

## Deployment: GitHub → Vercel + Render

### Step 1 — Push to GitHub
Replace files in your repo with this zip. Keep the folder structure as-is.

### Step 2 — Backend on Render
1. render.com → New Web Service → connect your GitHub repo
2. Root Directory: `backend`
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Add env var: `NODE_ENV=production`
6. Copy your URL: `https://YOUR-NAME.onrender.com`

> Free tier sleeps after 15 min. Wake it at: https://YOUR-NAME.onrender.com/api/health

### Step 3 — Frontend on Vercel
1. vercel.com → New Project → import your GitHub repo
2. Root Directory: `frontend`
3. Environment Variables:
   - VITE_API_URL = https://YOUR-NAME.onrender.com
   - VITE_WS_URL  = wss://YOUR-NAME.onrender.com/ws
4. Deploy → done!

### Step 4 — Vercel auto-redeploys on every GitHub push
Yes — once connected, every `git push` to your main branch auto-deploys to Vercel and Render (if you enable auto-deploy on Render too).

---

## Local Development
```
npm run install:all
npm run dev
```
