# LeonidaVice Terminal — Master Project Documentation
**Version:** 2.0 | **Last Updated:** April 2026 | **GitHub:** https://github.com/agayle8671-cmyk/LeonidaViceTracker

---

## 1. WHAT THIS PROJECT IS

LeonidaVice is a **"Bloomberg Terminal for criminals"** — a premium, data-dense financial dashboard built as a fan site for GTA VI and the fictional State of Leonida. It is NOT a news blog or wiki. It is a **utility tool** players keep open on a second monitor while playing GTA VI to:

- Track simulated real-time stock prices for Leonida corporations
- Time stock buys around in-game assassination missions and heist events
- Predict outcomes of in-game events using a real prediction market engine (LMSR)
- Calculate ROI on in-game businesses and properties
- Track their virtual portfolio and compete on a leaderboard

**The core concept:** Think Polymarket.com meets Bloomberg Terminal, skinned for GTA VI's Miami Vice aesthetic.

**Design philosophy:** Utility over fluff. Premium fintech aesthetic. Photography-first. Data-dense but not cluttered. The site should feel like a $50K custom product, not a fan wiki.

---

## 2. TECH STACK

Pure HTML/CSS/JavaScript — no frameworks, no build tools, no dependencies.

| File | Purpose |
|------|---------|
| `styles.css` | Complete design system (~700 lines). Miami Vice palette. |
| `data-config.js` | Single source of truth for ALL market data. |
| `app.js` | Price simulation engine + DOM rendering. |
| `lmsr.js` | LMSR prediction market AMM + wallet system. |
| `game-loop.js` | Addiction mechanics: resolution, streaks, badges, timers. |

**Local server:** `python -m http.server 3000` from the `leonidavice/` folder.
**Launchers:** `start.bat` (double-click) or `start.ps1` (PowerShell) — both auto-open browser.

---

## 3. DESIGN SYSTEM

### Color Palette (Miami Vice × Bloomberg)
```
--bg:        #080810   (near-black with blue tint — main background)
--surface:   #0d0d1a   (card backgrounds)
--surface-2: #111120   (elevated surfaces)
--surface-3: #161628   (highest elevation)
--border:    #1e1e35   (borders)
--pink:      #ff2d78   (primary accent — hot pink)
--cyan:      #00e5ff   (secondary accent — electric cyan)
--teal:      #00d4aa   (positive/up color)
--red:       #ff4060   (negative/down color)
--gold:      #ffd166   (warnings, streaks, badges)
--text:      #eeeeff   (primary text)
--text-2:    #6868a0   (secondary text)
--text-3:    #32324a   (muted text)
```

### Typography
- Body: Inter (Google Fonts) — weights 300-900
- Numbers/tickers: JetBrains Mono — weights 400-700

### Logo
- Gradient mark (pink→cyan) with "◈" symbol
- "LEONIDAVICE" wordmark in pink→cyan gradient
- "Terminal · V2.0" subtitle in muted text

### Nav Structure
Ticker tape → Nav bar → Page content
- Nav: Logo | Dashboard Markets Properties Businesses Heists News Watchlist About | LIVE badge + count | Search | Wallet (Ṁ) | DEPOSIT button
- No stats bar (removed in V2 — cleaner)

---

## 4. FILE INVENTORY

### HTML Pages (14 total)
| File | Page | Status |
|------|------|--------|
| `index.html` | Dashboard (home) | V2 — hero, trending, featured markets, prediction markets |
| `stocks.html` | Markets / Stock Table | V2 nav, full table with sparklines |
| `stock-detail.html` | Individual Stock | Chart, prediction panel, company intel |
| `properties.html` | Properties & ROI | V2 — Unsplash photography cards |
| `businesses.html` | Business Profitability | V2 — heat bar table |
| `heists.html` | Active Heists | V2 — photography cards + MARKET PLAYS |
| `news.html` | The Wire (news feed) | V2 — thumbnail photos, source attribution |
| `market.html` | Prediction Market Detail | YES/NO panel, chart, activity feed |
| `leaderboard.html` | Leaderboard / Watchlist | Credits-based ranking |
| `portfolio.html` | My Portfolio | Wallet hero, positions, trade history |
| `calculator.html` | ROI Calculator | Business profitability calculator |
| `premium.html` | Premium Plans | 3-tier pricing (Free/Pro/Terminal) |
| `region.html` | Region Detail | Dynamic via ?r= URL param |
| `about.html` | About / Legal | Disclaimer, legal notice |

### JavaScript Files (5 total)
| File | Size | Purpose |
|------|------|---------|
| `data-config.js` | 9.8KB | All market data, simulation params, regions |
| `app.js` | 21KB | Price engine, DOM rendering, page inits |
| `lmsr.js` | 21.3KB | LMSR AMM, wallet, buy modal, trade logic |
| `game-loop.js` | 27KB | Resolution, streaks, badges, countdowns, rotation |

### Other Files
| File | Purpose |
|------|---------|
| `styles.css` | Complete design system |
| `start.bat` | Windows launcher (double-click to start server) |
| `start.ps1` | PowerShell launcher |
| `_nav.html` | Shared ticker snippet (reference only, not included) |

---

## 5. THE SIMULATION ENGINE (app.js)

### Price Model
Each stock tick combines 5 factors:

1. **GBM (Geometric Brownian Motion)** — industry-standard stochastic model
   - `gbm = drift/252 + vol * sqrt(1/252) * randn()`
   - Box-Muller transform for normal distribution

2. **Momentum** — trend-following with exponential decay
   - `momentum = momentum * 0.92 + gbm * 0.3`
   - Effect: `momentum * 0.4`

3. **Mean Reversion** — price pulls back toward open
   - `reversion = (open - price) / open * 0.002`

4. **News Sentiment** — injected by events, decays each tick
   - `sentiment *= 0.97` per tick
   - Effect: `sentiment * 0.003`
   - Call `injectNewsEvent(sym, magnitude)` to trigger

5. **Beta-adjusted market factor** — correlated market-wide moves
   - Each stock has a beta (0.4 to 1.6)

### Tick Rate
- Simulated mode: every **2500ms**
- Live mode: every **5000ms** (polling)

### Stock Registry (10 stocks)
| Ticker | Company | Sector | Beta | Vol | Mission Tie |
|--------|---------|--------|------|-----|-------------|
| PSWSR | Pisswasser Brewing | Leisure | 1.4 | 0.018 | Madrazzo Assassination (+21%) |
| LOGOS | Logos Entertainment | Media | 1.1 | 0.014 | None |
| SNFB | Sinfrontera National Bank | Finance | 0.6 | 0.007 | SNFB Heist (-4%) |
| DKARM | Duke Arms | Defense | 1.3 | 0.016 | Madrazzo Assassination (+10%) |
| ALCRYS | Allied Crystal Sugar | Energy | 0.9 | 0.011 | Multi-Target Assassination (-18%) |
| LURE | Lure & Reel Co. | Leisure | 1.0 | 0.013 | Hotel Assassination (+14%) |
| AGTR | Airgator Marine | Leisure | 1.6 | 0.022 | Grassrivers Event (-12%) |
| LNLOT | Leonida Lottery Corp. | Finance | 0.4 | 0.006 | None |
| MGNOT | Mega Noticias | Media | 0.8 | 0.010 | None |
| VCPROP | Vice City Properties | Finance | 0.7 | 0.008 | Construction Assassination (+12%) |

### Switching to Live Data (when GTA VI drops)
In `data-config.js`, change ONE line:
```js
DATA_MODE: 'live'  // was 'simulated'
LIVE_API_BASE: 'https://your-api.com/v1'
```
Your API must return: `[{ sym, price, change24h, volume }]`
Zero other code changes needed. The entire frontend adapts automatically.

---

## 6. THE PREDICTION MARKET ENGINE (lmsr.js)

### What It Is
A Polymarket-style prediction market using **LMSR (Logarithmic Market Scoring Rule)** — an Automated Market Maker that keeps YES + NO prices summing to 100% at all times.

### The Math
```
Price of YES = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
Cost to buy shares = C(q_after) - C(q_before)
C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
```
- `b = 50` (liquidity parameter — controls price sensitivity)
- Lower b = more volatile, single trade moves needle more
- Higher b = more stable, needs community volume to shift

### Currency: Leonida Credits (Ṁ)
- **Starting balance:** Ṁ500 on first visit (localStorage)
- **Daily reward:** Ṁ50 per day (claim button on portfolio page)
- **Earning:** Correct predictions pay out 1 credit per share
- **Losing:** Wrong predictions lose your stake
- **Legal:** Zero real-world monetary value. Cannot be exchanged for cash.

### localStorage Keys
```
lv_wallet          — current balance (float)
lv_positions       — open positions per market {marketId: {yesShares, noShares, spent}}
lv_market_shares   — LMSR state per market {marketId: {qYes, qNo}}
lv_last_login      — date string for daily reward
lv_username        — auto-generated username (e.g. "ViceWolf4821")
lv_trade_history   — last 100 trades (array)
lv_stats           — {trades, wins, losses}
```

### Buy Modal
Triggered by clicking any "Buy Yes" or "Buy No" button on any market card.
- Shows live preview: shares received, avg price, max payout, new probability after trade
- Quick amount buttons: Ṁ25 / Ṁ50 / Ṁ100 / Max
- Shows existing position if user already has shares
- Legal disclaimer inline

### Supabase Migration Path
All localStorage calls are isolated in `LV_LMSR.getWallet()`, `setWallet()`, `getPositions()`, `setPosition()`, `getMarketShares()`, `setMarketShares()`. Replace these 6 methods with Supabase calls and the entire system migrates. No other changes needed.

---

## 7. THE GAME LOOP (game-loop.js)

### Market Resolution
Markets auto-resolve on a schedule (relative to page load):
- SNFB Heist: 90s → NO (security blocked it)
- PSWSR $6: 3min → YES (hit $6.02)
- Leonida Man: 5min → YES (aired)
- AGTR dip: 7min → YES (fell to $4.88)
- ALCRYS accident: 10min → NO (no incident)
- LOGOS week: 12min → NO (closed at $11.40)
- LURE ROI: 15min → YES
- VCPROP $150K: 18min → NO
- Duke Kelly: 20min → YES
- DKARM contract: 24min → YES
- PSWSR brewery: 30min → YES
- SNFB rate: 35min → NO

### Streak System
Consecutive correct predictions multiply payouts:
```
0-1 correct: 1.0x
2 correct:   1.0x
3 correct:   1.1x
4 correct:   1.2x
5 correct:   1.35x
6 correct:   1.5x
7 correct:   1.75x
8+ correct:  2.0x (MAX)
```
Streak resets on any wrong prediction. Shown in nav when ≥ 2.

### Badge Progression (5 tiers)
| Badge | Requirement |
|-------|------------|
| 🆕 Newcomer | Default |
| 💰 Hustler | 1+ win |
| 🃏 Dealer | 5 wins, 50% accuracy, Ṁ600+ balance |
| 💎 Cartel | 15 wins, 60% accuracy, Ṁ1000+ balance |
| 👑 Kingpin | 30 wins, 70% accuracy, Ṁ2000+ balance |

### Early Mover Bonus
If you buy a position when the probability is within 5% of the starting probability (i.e., you're early before the crowd moves it), you receive **+10% bonus shares** automatically.

### Market Rotation
After a market resolves, a replacement market slides into the feed from a pool of 8 replacement markets. Animated with a "NEW" badge.

### Countdown Timers
Every market card shows a live countdown (d/h/m/s). Turns gold < 10 min, pink + pulses < 60s. Card border glows gold when < 5 min (urgency state). Toast alert if you have a position in a closing market.

### Near-Miss Feedback
If you bet NO and the market resolves YES at 51% (or vice versa), you get a "So Close!" toast instead of a plain loss message. Designed to encourage retry behavior.

### Browser Notifications
Requests permission after 30s on first visit. Sends notification when assassination window opens, even if tab is in background.

---

## 8. THE PREDICTION MARKETS (12 active)

All defined in `data-config.js` under `MARKETS`. Each has:
- `id` — unique identifier (used in URL: `market.html?id=pswsr-6`)
- `question` — the prediction question
- `yesProb` — starting probability (0-1)
- `vol` — how fast probability moves
- `relatedSym` — stock ticker (price moves nudge probability)
- `volume`, `traders`, `endsIn` — display metadata

### Stock → Market Mapping (for stocks.html Predict buttons)
```
PSWSR  → pswsr-6          (Will PSWSR hit $6 before assassination?)
LOGOS  → logos-week       (LOGOS above $13 by end of week?)
SNFB   → snfb-heist       (SNFB successfully heisted?)
DKARM  → dkarm-contract   (Duke Arms wins second police contract?)
ALCRYS → alcrys-accident  (Allied Crystal industrial accident?)
LURE   → lure-roi         (Lure & Reel best ROI in Mariana?)
AGTR   → agtr-dip         (Airgator dips below $5?)
LNLOT  → pswsr-brewery    (Pisswasser expansion breaks ground?)
MGNOT  → mgnot-leonidaman (Leonida Man airs this week?)
VCPROP → vcprop-150       (Vice Beach penthouse above $150K?)
```

---

## 9. PAGE-BY-PAGE BREAKDOWN

### index.html (Dashboard)
- **Hero section:** Full-width left panel with live background chart (canvas), "The Bloomberg Terminal for criminals." headline with pink accent, two CTAs (OPEN TERMINAL, HEIST PLAYS). Right panel: 4 stat tiles (MCAP, Volume, Top Gainer, Top Loser).
- **Trending strip:** 4 sparkline cards for top movers.
- **Featured markets:** 3-column grid of stock cells with inline sparklines, sector filter pills.
- **Prediction markets:** 4 market cards with live YES/NO probability bars.
- **Right sidebar:** Leonida News widget, Active Heists widget, Top Movers, Quick ROI Calc.

### stocks.html (Markets)
- Full-width sortable table: star, % change, price, market cap, volume, ticker+name, sector badge, sparkline, Predict button.
- Predict buttons call `openBuyModal()` directly — no navigation.
- Sector filter pills above table.
- TABLE/GRID toggle (table only currently implemented).

### stock-detail.html (Stock Detail)
- URL: `stock-detail.html?sym=PSWSR`
- Live price + change, 5 stat tiles (open/high/low/cap/vol).
- Assassination alert box (mission tie-in info per stock).
- **Prediction panel:** Live probability bar, Predict YES/Predict NO buttons, existing position display.
- Full-width live chart (canvas, updates every 2.5s).
- Company intelligence: About + Trading Strategy per stock.
- Recent activity feed.
- Right sidebar: Related markets, all stocks list, news widget.

### properties.html (Properties & ROI)
- 3-column grid of property cards.
- Each card: **Unsplash photograph** as header, type badge overlaid, name + price overlaid.
- Body: location, appreciation %, description.
- Data row: DAILY income, APY %, PERK (e.g. "Stacks 5 passive crews").
- 12-month projection: total income, appreciation, ROI.
- Filter pills: ALL / RESIDENCE / NIGHTCLUB / WAREHOUSE / MARINA / INDUSTRIAL / RETAIL / DOCK.

### businesses.html (Business Profitability — "Underground Index")
- Clean table: Business name, category, revenue, margin %, 7-day trend, heat level (colored blocks 1-5), net/week.
- Heat blocks: red = high heat, gold = medium, teal = low.
- Category filter pills.
- Warning tip about nightclub stacking.

### heists.html (Active Heists)
- 2-column grid of heist cards.
- Each card: **Unsplash photograph** as header, difficulty badge (HARD/MEDIUM/EASY) overlaid.
- Stats: payout, crew count, time.
- Description.
- **MARKET PLAYS section:** SHORT/LONG with ticker, description, % impact.
- "Open chart →" links to stock-detail.html.

### news.html (The Wire)
- Full-width article list.
- Each article: **thumbnail photo** left, source (VICE TRIBUNE / LEONIDA DAILY / etc.), time, impact delta badge (▼ -3.40% / ▲ +2.10%), headline, excerpt, ticker tags.
- Category filter pills.
- Search input.

### market.html (Prediction Market Detail)
- URL: `market.html?id=pswsr-6`
- Large YES/NO probability display with thick bar.
- Buy Yes / Buy No action buttons.
- Price history chart (canvas).
- Recent activity feed.
- Right sidebar: Related markets, news widget.

### portfolio.html (My Portfolio)
- Wallet hero: balance (Ṁ), predictions count, win rate, username, daily claim button.
- Open prediction positions list.
- Trade history table (last 20 entries).
- How-it-works explainer.
- Legal notice about credits having no real-world value.

### leaderboard.html (Watchlist)
- Table: rank badge, player name, credits (Ṁ), weekly gain, accuracy % with bar, predictions count, badge.
- User's own row highlighted in pink at bottom, populated from localStorage.
- Filter tabs: Weekly / Monthly / All-Time.

### calculator.html (ROI Calculator)
- Form: business type, investment amount, upgrade level (1-5), county, risk tolerance.
- Results: weekly income, monthly income, break-even days, ROI%, risk-adjusted return.
- Comparison table of all 10 business types sorted by ROI.

### premium.html (Premium Plans)
- 3-tier pricing: Free / Pro ($9.99/mo) / Terminal ($24.99/mo).
- Pro card highlighted with pink border/glow.
- Feature comparison lists.
- FAQ section (5 questions).
- Note: Premium unlocks tools (charts, alerts) — NOT credits or gambling advantages.

### region.html (Region Detail)
- URL: `region.html?r=vice-dale` (or ambrosia, kelly, mariana)
- Dynamic content loaded from `LV_CONFIG.REGIONS` via JS.
- Gradient map placeholder, region stats, markets in region, top stocks.

### about.html (About / Legal)
- About section, mission, team.
- `#disclaimer` anchor: full legal copy about Leonida Credits having no monetary value.
- `#legal` anchor: Rockstar/Take-Two non-affiliation notice.

---

## 10. LEGAL COMPLIANCE

This is critical. The site must never cross into gambling territory.

### Language Rules
- ✅ Use: "Predict", "Position", "Trade", "Forecast"
- ❌ Never use: "Bet", "Gamble", "Wager", "Stake"

### Credits Rules
- Leonida Credits (Ṁ) have **zero real-world monetary value**
- Cannot be exchanged for cash
- Cannot be transferred between users
- Cannot be purchased with real money
- Cannot be used to buy real goods or services
- Premium tier unlocks **tools only** — never credits or competitive advantages

### Disclaimer (appears in every footer)
"© 2026 LeonidaVice Terminal · Fan-made · Not affiliated with Rockstar Games · Leonida Credits (Ṁ) have no real-world monetary value"

### Rockstar/Take-Two Policy
- Non-commercial fan use only
- No copyrighted game assets reproduced
- No plot spoilers
- No cheat promotion
- All company names (Pisswasser, Duke Arms, etc.) are Rockstar's intellectual property

---

## 11. PHOTOGRAPHY CREDITS

All photos are from Unsplash and Pexels (free for commercial use):

### Properties Page
- Ocean Drive Penthouse: `unsplash.com/photo-1613966667754`
- Neon Tide Nightclub: `unsplash.com/photo-1707095581724`
- Port Gellhorn Warehouse: `pexels.com/photos/6266456`
- Leonida Keys Marina: `unsplash.com/photo-1589066724013`
- Ambrosia Refinery: `unsplash.com/photo-1486325212027`
- Collins Ave Boutique: `unsplash.com/photo-1567784177951`
- Grassrivers Dock: `unsplash.com/photo-1558981852`
- Mariana Strip Mall: `unsplash.com/photo-1604335399105`

### Heists Page
- Sinfrontera Vault: `unsplash.com/photo-1601597111158`
- Ambrosia Refinery: `unsplash.com/photo-1486325212027`
- Mega Noticias Studio: `unsplash.com/photo-1707095581724`
- Duke Arms Container: `pexels.com/photos/6266456`
- Lottery Server: `unsplash.com/photo-1518611012118`
- Keys Marina: `unsplash.com/photo-1589066724013`
- Pisswasser Convoy: `unsplash.com/photo-1535007813616`
- Logos Showroom: `unsplash.com/photo-1542362567`

### News Page (thumbnails)
Various Unsplash photos matched to story topics.

---

## 12. GITHUB REPOSITORY

**URL:** https://github.com/agayle8671-cmyk/LeonidaViceTracker
**Branch:** main
**Commits:**
1. `eaaa9a1` — Initial commit (V1 full site)
2. `407d559` — LMSR prediction market system + Leonida Credits wallet
3. `05a0c42` — Complete addiction game loop
4. `bec56cf` — Wire prediction market into stocks page and stock detail
5. `c9c2b2d` — Full UI V2 overhaul (photography, new nav, hero, heist market plays)

**To push future changes:**
```bash
git add leonidavice/
git commit -m "your message"
git push origin main
```

---

## 13. IMPROVEMENT ROADMAP

### Immediate UI Polish (next session)
- [ ] Stocks page: add TABLE/GRID toggle (grid view with cards like featured markets)
- [ ] Home page: hero chart should animate continuously, not just on load
- [ ] Market cards: add a mini sparkline to each prediction market card
- [ ] Stock detail: add 1D/3D/1W timeframe tabs to the chart
- [ ] Nav: add a mobile hamburger menu
- [ ] Properties: add a "Sort by ROI" button
- [ ] All pages: smooth scroll-to-top button

### Feature Additions
- [ ] **Watchlist page** — let users star stocks and see them in a dedicated view (localStorage)
- [ ] **Price alerts** — "notify me when PSWSR hits $6" (browser notification)
- [ ] **Mission calendar** — countdown to next assassination window with exact timer
- [ ] **Portfolio chart** — line chart of portfolio value over time
- [ ] **Market search** — global search across all markets, stocks, news
- [ ] **Dark/light mode toggle** — though dark is the primary mode
- [ ] **CVD accessibility mode** — blue/orange instead of green/red for colorblind users (already in the brief)

### Backend / Phase 2 (Supabase)
- [ ] Replace localStorage with Supabase for multi-user leaderboard
- [ ] Real-time probability updates via Supabase Realtime (broadcast channel)
- [ ] User authentication (Supabase Auth)
- [ ] Stripe subscription for Premium tier
- [ ] Webhook to sync subscription status
- [ ] Row Level Security: public read on prices, authenticated read on portfolios

### When GTA VI Launches
- [ ] Set `DATA_MODE: 'live'` in `data-config.js`
- [ ] Build a lightweight backend that scrapes/receives real in-game price data
- [ ] API endpoint: `GET /v1/prices` returning `[{sym, price, change24h, volume}]`
- [ ] Update `RESOLUTION_SCHEDULE` in `game-loop.js` with real mission timestamps
- [ ] Add new stocks as Rockstar reveals more Leonida corporations

### Content Expansion
- [ ] Add eCola Bottling (ECOL), Ammu-Nation (AMMO), Whiz Wireless (WIZL) to stock registry
- [ ] Add more prediction markets (currently 12, target 30+)
- [ ] Add more heist cards as GTA VI reveals more locations
- [ ] Add more property cards (currently 8, target 15+)
- [ ] Expand news feed with auto-rotating stories

### SEO / Growth
- [ ] Add meta tags, Open Graph, Twitter Card to all pages
- [ ] Add sitemap.xml
- [ ] Add robots.txt
- [ ] Target keywords: "GTA 6 stock market", "Leonida economy", "GTA VI assassination stocks"
- [ ] Consider deploying to Vercel or Netlify for public access

---

## 14. KNOWN ISSUES / TECHNICAL DEBT

1. **Market resolution timers reset on page reload** — `lv_market_timers` in localStorage stores absolute timestamps, so timers persist across reloads. But `lv_resolved_markets` also persists, so resolved markets stay resolved. This is intentional for now.

2. **Stocks page Predict buttons** — currently call `openBuyModal()` directly. The `openBuyModal` function is defined in `lmsr.js` which loads after `app.js`. Load order: `data-config.js` → `app.js` → `lmsr.js` → `game-loop.js`. This order must be maintained on every page.

3. **Featured market rows on dashboard** — sector filter only shows/hides rows, doesn't re-sort. A full filter would require JS to rebuild the grid.

4. **The `_nav.html` file** — this is a reference snippet only, not included anywhere. It can be deleted.

5. **Stock icons** — some stocks show broken emoji in `data-config.js` (PSWSR, DKARM) due to encoding issues in the file. The icons display correctly in HTML because they're hardcoded there. The `data-config.js` icons are only used by `stock-detail.html` for the icon element.

6. **No error handling on image load** — if Unsplash/Pexels images fail to load (offline), cards show empty gray boxes. Add `onerror` fallback gradients if needed.

---

## 15. HOW TO RESUME THIS PROJECT

If starting fresh with a new AI assistant, share this file and say:

> "Read LEONIDAVICE_PROJECT_DOCS.md — this is a complete GTA VI fan site called LeonidaVice. It's a Bloomberg Terminal for criminals. Pure HTML/CSS/JS, no frameworks. The site is at leonidavice/ folder. Read the docs then help me with [your task]."

The AI will have everything it needs to continue without re-explanation.

**Key things to always remember:**
1. Load order on every page: `data-config.js` → `app.js` → `lmsr.js` → `game-loop.js`
2. All market data lives in `data-config.js` — never hardcode market data in HTML
3. The LMSR engine uses `b=50` liquidity parameter — changing this affects all market prices
4. Legal: always use "Predict/Position/Trade" — never "Bet/Gamble/Wager"
5. Credits (Ṁ) have zero real-world value — this must be stated clearly
6. The design is Miami Vice × Bloomberg: hot pink (#ff2d78), cyan (#00e5ff), teal (#00d4aa) on near-black (#080810)
