/* ═══════════════════════════════════════════════════════════════
   LeonidaVice — app.js
   Reads all data from data-config.js (LV_CONFIG).
   Switching to live data = change DATA_MODE in data-config.js only.
═══════════════════════════════════════════════════════════════ */

// ── RUNTIME STATE ────────────────────────────────────────────
const STOCKS  = LV_CONFIG.STOCKS;
const MARKETS = LV_CONFIG.MARKETS;
const SIM     = LV_CONFIG.SIM;

const stockState  = {};   // live price state per symbol
const marketState = {};   // live probability state per market id

// ── INIT STOCK STATE ─────────────────────────────────────────
Object.entries(STOCKS).forEach(([sym, s]) => {
  const hist = [];
  let v = s.price;
  for (let i = 0; i < SIM.seedLength; i++) {
    v += (Math.random() - 0.5) * s.vol * v;
    hist.push(Math.max(0.01, v));
  }
  stockState[sym] = {
    price: s.price, prevPrice: s.price,
    open: s.price, high: s.price, low: s.price,
    momentum: 0, sentiment: 0,
    history: hist, change24h: 0, volume: 0
  };
});

// ── INIT MARKET STATE ────────────────────────────────────────
MARKETS.forEach(m => {
  marketState[m.id] = {
    yesProb: m.yesProb,
    volume:  m.volume,
    traders: m.traders
  };
});

// ══════════════════════════════════════════════════════════════
//  PRICE ENGINE
// ══════════════════════════════════════════════════════════════

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function tickStock(sym) {
  const s  = STOCKS[sym];
  const st = stockState[sym];
  const p  = st.price;

  // GBM base
  const gbm = SIM.drift / 252 + s.vol * Math.sqrt(1 / 252) * randn();

  // Momentum
  st.momentum = st.momentum * SIM.momentumDecay + gbm * 0.3;
  const mom = st.momentum * SIM.momentumWeight;

  // Mean reversion toward open
  const rev = (st.open - p) / st.open * SIM.reversionStrength;

  // News sentiment (decays each tick)
  st.sentiment *= SIM.sentimentDecay;
  const sent = st.sentiment * SIM.sentimentWeight;

  // Beta-adjusted market noise
  const mkt = (Math.random() - 0.495) * SIM.marketVolFactor * s.beta;

  const newPrice = Math.max(0.01, p * (1 + gbm + mom + rev + sent + mkt));

  st.prevPrice = p;
  st.price     = newPrice;
  st.high      = Math.max(st.high, newPrice);
  st.low       = Math.min(st.low,  newPrice);
  st.change24h = (newPrice - st.open) / st.open * 100;
  st.history.push(newPrice);
  if (st.history.length > SIM.historyLength) st.history.shift();
  st.volume += Math.floor(Math.random() * 50000 + 10000);
}

function tickMarket(id) {
  const cfg = LV_CONFIG.getMarket(id);
  const ms  = marketState[id];

  // Probability random walk with mean reversion toward 0.5
  const noise = (Math.random() - 0.5) * cfg.vol * SIM.probNoiseScale * 10;
  const revert = (0.5 - ms.yesProb) * SIM.probMeanReversion;

  // If related stock is moving strongly, nudge probability
  let stockNudge = 0;
  if (cfg.relatedSym && stockState[cfg.relatedSym]) {
    const ch = stockState[cfg.relatedSym].change24h / 100;
    stockNudge = ch * 0.05;
  }

  ms.yesProb = Math.min(0.97, Math.max(0.03,
    ms.yesProb + noise + revert + stockNudge
  ));

  // Volume trickles up
  ms.volume  += Math.floor(Math.random() * 8000 + 1000);
  ms.traders += Math.floor((Math.random() - 0.45) * 3);
  if (ms.traders < 10) ms.traders = 10;
}

// ── LIVE DATA FETCH (for when DATA_MODE = 'live') ────────────
async function fetchLiveData() {
  try {
    const res = await fetch(LV_CONFIG.LIVE_API_BASE + '/prices');
    const data = await res.json();
    data.forEach(row => {
      if (stockState[row.sym]) {
        const st = stockState[row.sym];
        st.prevPrice = st.price;
        st.price     = row.price;
        st.change24h = row.change24h;
        st.volume    = row.volume || st.volume;
        st.history.push(row.price);
        if (st.history.length > SIM.historyLength) st.history.shift();
      }
    });
  } catch (e) {
    console.warn('[LeonidaVice] Live data fetch failed, staying on simulation:', e.message);
  }
}

// ── MASTER TICK ──────────────────────────────────────────────
function masterTick() {
  if (LV_CONFIG.DATA_MODE === 'live') {
    fetchLiveData();
  } else {
    Object.keys(STOCKS).forEach(tickStock);
  }
  MARKETS.forEach(m => tickMarket(m.id));
  renderAll();
}

// ══════════════════════════════════════════════════════════════
//  RENDER LAYER
// ══════════════════════════════════════════════════════════════

function renderAll() {
  Object.keys(STOCKS).forEach(sym => {
    renderTicker(sym);
    renderMovers(sym);
    renderTableRow(sym);
    renderStockDetailIfOpen(sym);
  });
  MARKETS.forEach(m => renderMarketCard(m.id));
  renderStatsBar();
}

function renderTicker(sym) {
  document.querySelectorAll('.tick').forEach(el => {
    const symEl = el.querySelector('.tick-sym');
    if (!symEl || symEl.textContent.trim() !== sym) return;
    const st = stockState[sym];
    const up = st.price >= st.prevPrice;
    el.querySelector('.tick-val').textContent  = '$' + st.price.toFixed(2);
    el.querySelector('.tick-delta').textContent = (up ? '▲' : '▼') + Math.abs(st.change24h).toFixed(2) + '%';
    el.className = 'tick ' + (up ? 'up' : 'down');
  });
}

function renderMovers(sym) {
  document.querySelectorAll('.mover-row[data-sym="' + sym + '"]').forEach(row => {
    const st = stockState[sym];
    const up = st.change24h >= 0;
    const pe = row.querySelector('.mover-price');
    const de = row.querySelector('.mover-delta');
    if (pe) pe.textContent = '$' + st.price.toFixed(2);
    if (de) {
      de.textContent = (up ? '▲ ' : '▼ ') + Math.abs(st.change24h).toFixed(1) + '%';
      de.className   = 'mover-delta ' + (up ? 'up' : 'down');
    }
  });
}

function renderTableRow(sym) {
  const row = document.querySelector('tr[data-sym="' + sym + '"]');
  if (!row) return;
  const st  = stockState[sym];
  const up  = st.change24h >= 0;
  const pe  = row.querySelector('.td-price');
  const ce  = row.querySelector('.td-change24');
  if (pe) pe.textContent = '$' + st.price.toFixed(2);
  if (ce) {
    ce.textContent = (up ? '▲ ' : '▼ ') + Math.abs(st.change24h).toFixed(2) + '%';
    ce.className   = (up ? 'td-up' : 'td-down') + ' td-change24';
  }
  const canvas = row.querySelector('.sparkline-canvas');
  if (canvas) drawSparkline(canvas, st.history.slice(-30), up);
}

function renderMarketCard(id) {
  const card = document.querySelector('.market-card[data-market-id="' + id + '"]');
  if (!card) return;
  const ms  = marketState[id];
  const yes = Math.round(ms.yesProb * 100);
  const no  = 100 - yes;

  const yesBtn  = card.querySelector('.outcome-btn.yes .outcome-pct');
  const noBtn   = card.querySelector('.outcome-btn.no  .outcome-pct');
  const bar     = card.querySelector('.bar-fill');
  const volEl   = card.querySelector('.card-vol');
  const tradeEl = card.querySelector('.card-traders');

  if (yesBtn)  yesBtn.textContent  = yes + '%';
  if (noBtn)   noBtn.textContent   = no  + '%';
  if (bar)     bar.style.width     = yes + '%';
  if (volEl)   volEl.textContent   = '$' + formatVol(ms.volume);
  if (tradeEl) tradeEl.textContent = ms.traders.toLocaleString() + ' traders';
}

function renderStatsBar() {
  // Update total market cap (sum of all stock prices * fixed share counts)
  const caps = { PSWSR:65e6, LOGOS:79e6, SNFB:46e6, DKARM:53e6, ALCRYS:97e6, LURE:49e6, AGTR:33e6, LNLOT:84e6, MGNOT:34e6, VCPROP:48e6 };
  let totalCap = 0;
  Object.entries(caps).forEach(([sym, shares]) => {
    totalCap += (stockState[sym]?.price || 0) * shares;
  });
  const capEl = document.querySelector('[data-stat="market-cap"]');
  if (capEl) capEl.textContent = '$' + (totalCap / 1e9).toFixed(2) + 'B';
}

function renderStockDetailIfOpen(sym) {
  const marker = document.getElementById('stock-detail-sym');
  if (!marker || marker.dataset.sym !== sym) return;
  const st = stockState[sym];
  const up = st.change24h >= 0;
  const pe = document.getElementById('sd-price');
  const ce = document.getElementById('sd-change');
  if (pe) pe.textContent = '$' + st.price.toFixed(2);
  if (ce) {
    ce.textContent = (up ? '▲ ' : '▼ ') + Math.abs(st.change24h).toFixed(2) + '%';
    ce.className   = 'stock-price-change ' + (up ? 'up' : 'down');
  }
  const chartCanvas = document.getElementById('stock-main-chart');
  if (chartCanvas) drawMainChart(chartCanvas, st.history, up);
}

function updateTraderCount() {
  document.querySelectorAll('[data-traders]').forEach(el => {
    const cur   = parseInt(el.textContent.replace(/,/g, '')) || 3841;
    const delta = Math.floor((Math.random() - 0.47) * 15);
    el.textContent = Math.max(3000, cur + delta).toLocaleString();
  });
}

// ── INJECT NEWS EVENT (callable from console or future backend) ──
function injectNewsEvent(sym, magnitude) {
  if (stockState[sym]) {
    stockState[sym].sentiment += magnitude;
    stockState[sym].momentum  += magnitude * 0.5;
  }
}

// ══════════════════════════════════════════════════════════════
//  CANVAS CHARTS
// ══════════════════════════════════════════════════════════════

function drawSparkline(canvas, data, up) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  if (!data || data.length < 2) return;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const color = up ? '#00d4aa' : '#ff4060';
  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawMainChart(canvas, data, up) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  if (!data || data.length < 2) return;
  const min = Math.min(...data) * 0.998;
  const max = Math.max(...data) * 1.002;
  const range = max - min || 1;
  const color = up ? '#00d4aa' : '#ff4060';

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(31,31,53,0.8)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (i / 4) * h;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Fill
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, up ? 'rgba(0,212,170,0.18)' : 'rgba(255,64,96,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 20) - 10;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dot at current price
  const lx = w - 2;
  const ly = h - ((data[data.length - 1] - min) / range) * (h - 20) - 10;
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,8,16,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════

function formatVol(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return n.toString();
}

function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    link.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
  });
}

function initFilterTabs() {
  document.querySelectorAll('.filter-tabs').forEach(group => {
    group.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        group.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  });
}

function initSearch() {
  const input = document.querySelector('.search-input');
  if (!input) return;
  input.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.market-card').forEach(card => {
      card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
    document.querySelectorAll('#stocks-table tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

function calcROI() {
  const type   = document.getElementById('biz-type')?.value;
  const invest = parseFloat(document.getElementById('invest-amt')?.value) || 1750000;
  const rates  = { 'Nightclub':0.0042,'Bunker':0.0058,'Coke Lab':0.0071,'Counterfeit Cash':0.0035,'Weed Farm':0.0028 };
  const weekly = invest * (rates[type] || 0.004);
  const el = document.getElementById('result-val');
  if (el) el.textContent = '$' + weekly.toLocaleString('en-US', { maximumFractionDigits:0 });
}

function calcROIPage() {
  const type    = document.getElementById('calc-biz-type')?.value;
  const invest  = parseFloat(document.getElementById('calc-invest')?.value) || 1750000;
  const level   = parseInt(document.getElementById('calc-level')?.value) || 3;
  const rates   = { 'Nightclub':0.0042,'Bunker':0.0058,'Coke Lab':0.0071,'Counterfeit Cash':0.0035,'Weed Farm':0.0028,'Meth Lab':0.0065,'Document Forgery':0.0022,'Gunrunning':0.0055,'Import/Export':0.0080,'MC Club':0.0030 };
  const weekly  = invest * (rates[type] || 0.004) * (0.7 + level * 0.12);
  const monthly = weekly * 4.33;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('res-weekly',    '$' + weekly.toLocaleString('en-US', { maximumFractionDigits:0 }));
  set('res-monthly',   '$' + monthly.toLocaleString('en-US', { maximumFractionDigits:0 }));
  set('res-breakeven', Math.ceil(invest / weekly) + ' days');
  set('res-roi',       (weekly / invest * 100).toFixed(2) + '%');
  set('res-risk-adj',  '$' + (weekly * 0.82).toLocaleString('en-US', { maximumFractionDigits:0 }));
}

// ── PAGE-SPECIFIC INITS ──────────────────────────────────────

function initRegionPage() {
  const r = new URLSearchParams(window.location.search).get('r') || 'vice-dale';
  const d = LV_CONFIG.REGIONS[r] || LV_CONFIG.REGIONS['vice-dale'];
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('region-name', d.name); set('region-name-map', d.name); set('region-h1', d.name);
  set('region-gdp', d.gdp); set('region-sector', d.sector);
  set('region-biz', d.biz); set('region-props', d.props); set('region-desc', d.desc);
  const mapEl = document.getElementById('region-map-bg');
  if (mapEl) mapEl.style.background = d.color;
  document.title = d.name + ' — LeonidaVice';
  setTimeout(() => {
    ['region-gdp','region-sector','region-biz','region-props'].forEach(id => {
      const src = document.getElementById(id);
      if (!src) return;
      [id + '-card', id + '-widget'].forEach(tid => {
        const el = document.getElementById(tid);
        if (el) el.textContent = src.textContent;
      });
    });
  }, 100);
}

function initMarketPage() {
  const id = new URLSearchParams(window.location.search).get('id') || 'pswsr-6';
  const m  = LV_CONFIG.getMarket(id);
  const ms = marketState[id] || { yesProb: m.yesProb, volume: m.volume };
  const yes = Math.round(ms.yesProb * 100);
  const set = (eid, v) => { const el = document.getElementById(eid); if (el) el.textContent = v; };
  set('market-title', m.question);
  set('market-yes-pct', yes + '%');
  set('market-no-pct', (100 - yes) + '%');
  set('market-vol', '$' + formatVol(ms.volume));
  set('market-tag', m.category); set('market-tag-badge', m.category);
  set('market-end', m.endsIn);
  const bar = document.getElementById('market-prob-bar');
  if (bar) bar.style.width = yes + '%';
  document.title = m.question + ' — LeonidaVice';
  const chartCanvas = document.getElementById('market-chart');
  if (chartCanvas) {
    const st = stockState[m.relatedSym] || stockState['PSWSR'];
    drawMainChart(chartCanvas, st.history, st.change24h >= 0);
  }
}

function initStockDetailPage() {
  const sym = (new URLSearchParams(window.location.search).get('sym') || 'PSWSR').toUpperCase();
  const s   = STOCKS[sym];
  const st  = stockState[sym];
  if (!s || !st) return;
  const marker = document.getElementById('stock-detail-sym');
  if (marker) marker.dataset.sym = sym;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sd-sym', sym); set('sd-name', s.name); set('sd-sector', s.sector);
  set('sd-price', '$' + st.price.toFixed(2));
  set('sd-open',  '$' + st.open.toFixed(2));
  set('sd-high',  '$' + st.high.toFixed(2));
  set('sd-low',   '$' + st.low.toFixed(2));
  set('sd-cap',   '$' + (st.price * 1e8 / 1e6).toFixed(0) + 'M');
  set('sd-vol',   '$' + (st.volume / 1e6).toFixed(1) + 'M');
  const ce = document.getElementById('sd-change');
  if (ce) {
    const up = st.change24h >= 0;
    ce.textContent = (up ? '▲ ' : '▼ ') + Math.abs(st.change24h).toFixed(2) + '%';
    ce.className   = 'stock-price-change ' + (up ? 'up' : 'down');
  }
  const iconEl = document.getElementById('sd-icon');
  if (iconEl) { iconEl.textContent = s.icon; iconEl.style.background = s.color + '22'; }
  document.title = sym + ' — ' + s.name + ' — LeonidaVice';
  const chartCanvas = document.getElementById('stock-main-chart');
  if (chartCanvas) drawMainChart(chartCanvas, st.history, st.change24h >= 0);
}

// ══════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  initFilterTabs();
  initSearch();

  // Draw initial sparklines
  document.querySelectorAll('.sparkline-canvas[data-sym]').forEach(canvas => {
    const sym = canvas.dataset.sym;
    const st  = stockState[sym];
    if (st) drawSparkline(canvas, st.history.slice(-30), st.change24h >= 0);
  });

  // Page-specific
  if (document.getElementById('region-name'))      initRegionPage();
  if (document.getElementById('market-title'))     initMarketPage();
  if (document.getElementById('stock-detail-sym')) initStockDetailPage();

  // Start engines
  const tickMs = LV_CONFIG.DATA_MODE === 'live' ? LV_CONFIG.LIVE_POLL_MS : LV_CONFIG.SIM_TICK_MS;
  setInterval(masterTick, tickMs);
  setInterval(updateTraderCount, 4000);

  // Random news events (simulated mode only)
  if (LV_CONFIG.DATA_MODE === 'simulated') {
    const scheduleNewsEvent = () => {
      const syms = Object.keys(STOCKS);
      const sym  = syms[Math.floor(Math.random() * syms.length)];
      injectNewsEvent(sym, (Math.random() - 0.5) * 0.4);
      setTimeout(scheduleNewsEvent, 30000 + Math.random() * 60000);
    };
    setTimeout(scheduleNewsEvent, 30000);
  }

  // Log data mode to console for transparency
  console.log('[LeonidaVice] Data mode:', LV_CONFIG.DATA_MODE,
    LV_CONFIG.DATA_MODE === 'live' ? '— fetching from ' + LV_CONFIG.LIVE_API_BASE : '— simulation engine active');
});
