# EMA Trader — Strategy-Based Paper Trading Platform

## Strategy: EMA 9/15 Crossover + 30° Angle Filter

### Bull Condition (BUY LONG)
- EMA 9 > EMA 15 (EMA15 below EMA9)
- EMA15 angle ≥ 30° upward
- Confirmation candle: Bullish Engulfing / Hammer / Strong Bull Candle
- Stop Loss: Below previous candle low
- Target: 1:2 Risk:Reward

### Bear Condition (SELL SHORT)
- EMA 15 > EMA 9 (EMA15 above EMA9)
- EMA15 angle ≥ 30° downward
- Confirmation: Bearish Engulfing / Shooting Star / Strong Bear Candle
- Stop Loss: Above previous candle high
- Target: 1:2 Risk:Reward

### Sideways (NO TRADE)
- EMA15 angle < 30° → flat market → skip

## Deploy

### Frontend (Vercel)
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Env vars: `VITE_API_URL`, `VITE_WS_URL`

### Backend (Render)
- Root Directory: `backend`
- Build: `npm install --include=dev && npm run build`
- Start: `npm start`
- Env vars: `NODE_ENV=production`, `PORT=4000`, `FRONTEND_URL=<vercel-url>`
