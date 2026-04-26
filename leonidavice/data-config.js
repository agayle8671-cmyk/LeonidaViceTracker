/* ═══════════════════════════════════════════════════════════════
   LeonidaVice — data-config.js
   ─────────────────────────────────────────────────────────────
   THE SINGLE SOURCE OF TRUTH for all market data.

   DATA_MODE controls where prices come from:
     'simulated' → built-in GBM engine (current, pre-launch)
     'live'      → fetch from LIVE_API_BASE (post-launch, real GTA VI data)

   To switch to live data when GTA VI drops:
     1. Set DATA_MODE = 'live'
     2. Set LIVE_API_BASE to your backend endpoint
     3. Your API should return: { sym, price, change24h, volume }
     That's it. No other code changes needed.
═══════════════════════════════════════════════════════════════ */

const LV_CONFIG = {

  // ── DATA SOURCE ──────────────────────────────────────────────
  DATA_MODE: 'simulated',   // 'simulated' | 'live'
  LIVE_API_BASE: 'https://api.leonidavice.com/v1',  // future endpoint
  LIVE_POLL_MS: 5000,       // how often to fetch live data (ms)
  SIM_TICK_MS:  2500,       // how often simulation ticks (ms)

  // ── STOCK REGISTRY ───────────────────────────────────────────
  // Each entry is the canonical definition of a Leonida stock.
  // vol = daily volatility (annualised σ / sqrt(252))
  // beta = sensitivity to market-wide moves
  // assassinationPlay = true if this stock is tied to a mission event
  STOCKS: {
    PSWSR:  { name:'Pisswasser Brewing',        price:4.82,   vol:0.018, beta:1.4, sector:'Leisure',  color:'#ffd166', icon:'��', assassinationPlay:true,  missionTie:'Madrazzo Assassination',    missionEffect:+0.21 },
    LOGOS:  { name:'Logos Entertainment',       price:11.20,  vol:0.014, beta:1.1, sector:'Media',    color:'#a78bfa', icon:'🎰', assassinationPlay:false, missionTie:null,                        missionEffect:0 },
    SNFB:   { name:'Sinfrontera National Bank', price:88.40,  vol:0.007, beta:0.6, sector:'Finance',  color:'#00d4aa', icon:'🏦', assassinationPlay:false, missionTie:'SNFB Heist',                missionEffect:-0.04 },
    DKARM:  { name:'Duke Arms',                 price:34.15,  vol:0.016, beta:1.3, sector:'Defense',  color:'#ff4060', icon:'��', assassinationPlay:true,  missionTie:'Madrazzo Assassination',    missionEffect:+0.10 },
    ALCRYS: { name:'Allied Crystal Sugar',      price:22.60,  vol:0.011, beta:0.9, sector:'Energy',   color:'#ff9632', icon:'🍬', assassinationPlay:true,  missionTie:'Multi-Target Assassination',missionEffect:-0.18 },
    LURE:   { name:'Lure & Reel Co.',           price:9.77,   vol:0.013, beta:1.0, sector:'Leisure',  color:'#00e5ff', icon:'🎣', assassinationPlay:true,  missionTie:'Hotel Assassination',       missionEffect:+0.14 },
    AGTR:   { name:'Airgator Marine',           price:6.33,   vol:0.022, beta:1.6, sector:'Leisure',  color:'#00e5ff', icon:'🚤', assassinationPlay:false, missionTie:'Grassrivers Event',         missionEffect:-0.12 },
    LNLOT:  { name:'Leonida Lottery Corp.',     price:1.05,   vol:0.006, beta:0.4, sector:'Finance',  color:'#a78bfa', icon:'🎟️', assassinationPlay:false, missionTie:null,                        missionEffect:0 },
    MGNOT:  { name:'Mega Noticias',             price:18.90,  vol:0.010, beta:0.8, sector:'Media',    color:'#ff2d78', icon:'📺', assassinationPlay:false, missionTie:null,                        missionEffect:0 },
    VCPROP: { name:'Vice City Properties',      price:142.00, vol:0.008, beta:0.7, sector:'Finance',  color:'#00d4aa', icon:'🌴', assassinationPlay:true,  missionTie:'Construction Assassination', missionEffect:+0.12 }
  },

  // ── PREDICTION MARKETS ───────────────────────────────────────
  // These are the Polymarket-style community prediction questions.
  // yesProb = starting probability (0-1). Drifts live via simulation.
  // vol = how fast the probability moves (higher = more volatile market)
  // relatedSym = stock ticker this market is tied to (for cross-updates)
  MARKETS: [
    { id:'pswsr-6',          question:'Will Pisswasser stock hit $6.00 before the Madrazzo assassination?',  yesProb:0.72, vol:0.008, category:'Stocks',     tag:'Assassination Play', relatedSym:'PSWSR', volume:4200000,  traders:1840, endsIn:'46h' },
    { id:'logos-week',       question:'Logos Entertainment stock above $13 by end of week?',                 yesProb:0.61, vol:0.006, category:'Stocks',     tag:'Price Target',       relatedSym:'LOGOS', volume:1800000,  traders:920,  endsIn:'3d 12h' },
    { id:'duke-kelly',       question:'Duke Arms — most profitable business in Kelly County this week?',     yesProb:0.54, vol:0.005, category:'Businesses', tag:'Profitability',      relatedSym:'DKARM', volume:920000,   traders:480,  endsIn:'5d' },
    { id:'snfb-heist',       question:'Sinfrontera Bank — successfully heisted this session?',               yesProb:0.38, vol:0.012, category:'Events',     tag:'Heist',              relatedSym:'SNFB',  volume:3100000,  traders:2100, endsIn:'2h' },
    { id:'lure-roi',         question:'Lure & Reel — best ROI business in Mariana County?',                  yesProb:0.83, vol:0.004, category:'Properties', tag:'ROI',                relatedSym:'LURE',  volume:540000,   traders:310,  endsIn:'7d' },
    { id:'alcrys-accident',  question:'Allied Crystal — industrial accident before next patch?',              yesProb:0.29, vol:0.009, category:'Events',     tag:'Risk Event',         relatedSym:'ALCRYS',volume:2400000,  traders:1240, endsIn:'4d' },
    { id:'vcprop-150',       question:'Vice Beach penthouse — price above $150K this week?',                  yesProb:0.47, vol:0.007, category:'Properties', tag:'Price Target',       relatedSym:'VCPROP',volume:1100000,  traders:640,  endsIn:'3d' },
    { id:'agtr-dip',         question:'Airgator — stock dips below $5 after Grassrivers environmental ruling?', yesProb:0.55, vol:0.010, category:'Stocks', tag:'Assassination Play', relatedSym:'AGTR',  volume:670000,   traders:390,  endsIn:'6d' },
    { id:'mgnot-leonidaman', question:'Mega Noticias — "Leonida Man" segment airs this week?',               yesProb:0.91, vol:0.003, category:'Media',      tag:'Media Event',        relatedSym:'MGNOT', volume:310000,   traders:180,  endsIn:'5d' },
    { id:'pswsr-brewery',    question:'Pisswasser Vice-Dale expansion breaks ground before June 30?',         yesProb:0.66, vol:0.005, category:'Stocks',     tag:'Corporate',          relatedSym:'PSWSR', volume:880000,   traders:420,  endsIn:'34d' },
    { id:'snfb-rate',        question:'Sinfrontera Bank raises rates again in Q3?',                          yesProb:0.44, vol:0.004, category:'Events',     tag:'Macro',              relatedSym:'SNFB',  volume:1600000,  traders:780,  endsIn:'62d' },
    { id:'dkarm-contract',   question:'Duke Arms wins second Leonida State Police contract this year?',       yesProb:0.71, vol:0.006, category:'Businesses', tag:'Corporate',          relatedSym:'DKARM', volume:740000,   traders:360,  endsIn:'28d' }
  ],

  // ── SIMULATION PARAMETERS ────────────────────────────────────
  SIM: {
    drift:             0.0001,   // slight upward drift per tick
    momentumDecay:     0.92,     // how fast momentum fades
    momentumWeight:    0.4,      // how much momentum affects price
    reversionStrength: 0.002,    // pull toward open price
    sentimentDecay:    0.97,     // how fast news sentiment fades
    sentimentWeight:   0.003,    // how much sentiment affects price
    marketVolFactor:   0.002,    // market-wide random move amplitude
    probMeanReversion: 0.001,    // prediction market prob pulls toward 0.5
    probNoiseScale:    0.004,    // base noise on prediction market probs
    historyLength:     200,      // max price history points to keep
    seedLength:        80,       // initial history seed length
  },

  // ── REGIONS ──────────────────────────────────────────────────
  REGIONS: {
    'vice-dale': { name:'Vice-Dale County', gdp:'$2.1B', sector:'Technology & Nightlife', biz:48, props:124, color:'linear-gradient(135deg,#0d0020,#200060)', desc:'The urban core of Leonida, home to Vice City and Vice Beach. Drives technology, fashion, and nightlife sectors.' },
    'ambrosia':  { name:'Ambrosia County',  gdp:'$890M', sector:'Agriculture & Industry', biz:31, props:67,  color:'linear-gradient(135deg,#1a0a00,#3d2000)', desc:'The industrial heartland of Leonida, home to the Allied Crystal Sugar Refinery.' },
    'kelly':     { name:'Kelly County',     gdp:'$640M', sector:'Logistics & Security',   biz:22, props:45,  color:'linear-gradient(135deg,#001a0a,#003020)', desc:'Home to Port Gellhorn and a major prison complex. Hub for logistics and security stocks.' },
    'mariana':   { name:'Mariana County',   gdp:'$1.1B', sector:'Tourism & Nautical',     biz:38, props:89,  color:'linear-gradient(135deg,#001828,#003060)', desc:'Contains the Leonida Keys and the Grassrivers. Primary driver for tourism and nautical brands.' }
  },

  // ── MARKET DETAIL PAGES ──────────────────────────────────────
  // Kept here so market.html can look up by id without hardcoding
  getMarket(id) {
    return this.MARKETS.find(m => m.id === id) || this.MARKETS[0];
  }
};
