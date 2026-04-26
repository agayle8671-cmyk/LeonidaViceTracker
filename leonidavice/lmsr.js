/* ═══════════════════════════════════════════════════════════════
   LeonidaVice — lmsr.js
   ─────────────────────────────────────────────────────────────
   LMSR Automated Market Maker + Leonida Credits Wallet
   All state stored in localStorage — Supabase-ready architecture.

   LEGAL: Virtual credits only. No real-world monetary value.
   No cash-out. No real-money transactions. Fan site simulation.
═══════════════════════════════════════════════════════════════ */

// ── CONSTANTS ────────────────────────────────────────────────
const LV_LMSR = {

  // Liquidity parameter b — controls price sensitivity.
  // Lower b = more volatile (single trade moves needle more).
  // Higher b = more stable (needs community volume to shift).
  // 50 is a good starting point for a small community.
  B: 50,

  // Starting wallet balance for new users
  STARTING_BALANCE: 500,

  // Daily login reward
  DAILY_REWARD: 50,

  // Currency symbol
  SYMBOL: 'Ṁ',

  // Storage keys
  KEYS: {
    wallet:      'lv_wallet',
    positions:   'lv_positions',
    marketShares:'lv_market_shares',
    lastLogin:   'lv_last_login',
    username:    'lv_username',
    history:     'lv_trade_history',
    stats:       'lv_stats',
  },

  // ── LMSR MATH ──────────────────────────────────────────────

  // Cost function C(q) = b * ln(sum(e^(q_i/b)))
  cost(qYes, qNo) {
    const b = this.B;
    return b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b));
  },

  // Price of YES outcome = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
  priceYes(qYes, qNo) {
    const b = this.B;
    const eY = Math.exp(qYes / b);
    const eN = Math.exp(qNo / b);
    return eY / (eY + eN);
  },

  // Cost to buy `shares` of YES given current state
  costToBuy(qYes, qNo, shares, side) {
    const before = this.cost(qYes, qNo);
    const after  = side === 'yes'
      ? this.cost(qYes + shares, qNo)
      : this.cost(qYes, qNo + shares);
    return after - before;
  },

  // Shares you get for spending `credits` on a side
  sharesForCredits(qYes, qNo, credits, side) {
    // Binary search: find shares s.t. costToBuy ≈ credits
    let lo = 0, hi = credits * 10, mid;
    for (let i = 0; i < 64; i++) {
      mid = (lo + hi) / 2;
      const c = this.costToBuy(qYes, qNo, mid, side);
      if (c < credits) lo = mid; else hi = mid;
    }
    return mid;
  },

  // Payout if position resolves correctly (1 share = 1 credit)
  payout(shares) {
    return shares; // 1:1 resolution
  },

  // ── WALLET ─────────────────────────────────────────────────

  getWallet() {
    const raw = localStorage.getItem(this.KEYS.wallet);
    if (raw) return parseFloat(raw);
    // First visit — grant starting balance
    this.setWallet(this.STARTING_BALANCE);
    return this.STARTING_BALANCE;
  },

  setWallet(amount) {
    localStorage.setItem(this.KEYS.wallet, amount.toFixed(2));
    this.renderWallet();
  },

  adjustWallet(delta) {
    const current = this.getWallet();
    this.setWallet(Math.max(0, current + delta));
  },

  // ── DAILY REWARD ───────────────────────────────────────────

  claimDailyReward() {
    const last = localStorage.getItem(this.KEYS.lastLogin);
    const today = new Date().toDateString();
    if (last === today) return false; // already claimed
    localStorage.setItem(this.KEYS.lastLogin, today);
    this.adjustWallet(this.DAILY_REWARD);
    this.addToHistory({
      type: 'REWARD',
      description: 'Daily login reward',
      amount: this.DAILY_REWARD,
      date: new Date().toISOString()
    });
    return true;
  },

  // ── MARKET SHARES STATE ────────────────────────────────────
  // Tracks net shares outstanding per market (community-wide)
  // In production this would be Supabase; here it's localStorage

  getMarketShares(marketId) {
    const raw = localStorage.getItem(this.KEYS.marketShares);
    const all = raw ? JSON.parse(raw) : {};
    if (!all[marketId]) {
      // Seed from config
      const cfg = LV_CONFIG.getMarket(marketId);
      const p = cfg.yesProb;
      // Invert LMSR to find q values that produce this probability
      // p = e^(qY/b) / (e^(qY/b) + e^(qN/b))
      // With qN = 0: p = e^(qY/b) / (e^(qY/b) + 1)
      // qY = b * ln(p / (1-p))
      const b = this.B;
      const qY = b * Math.log(p / (1 - p));
      all[marketId] = { qYes: qY, qNo: 0 };
      localStorage.setItem(this.KEYS.marketShares, JSON.stringify(all));
    }
    return all[marketId];
  },

  setMarketShares(marketId, qYes, qNo) {
    const raw = localStorage.getItem(this.KEYS.marketShares);
    const all = raw ? JSON.parse(raw) : {};
    all[marketId] = { qYes, qNo };
    localStorage.setItem(this.KEYS.marketShares, JSON.stringify(all));
  },

  // Get current implied probability from LMSR state
  getImpliedProb(marketId) {
    const { qYes, qNo } = this.getMarketShares(marketId);
    return this.priceYes(qYes, qNo);
  },

  // ── USER POSITIONS ─────────────────────────────────────────

  getPositions() {
    const raw = localStorage.getItem(this.KEYS.positions);
    return raw ? JSON.parse(raw) : {};
  },

  getPosition(marketId) {
    const all = this.getPositions();
    return all[marketId] || { yesShares: 0, noShares: 0, spent: 0 };
  },

  setPosition(marketId, pos) {
    const all = this.getPositions();
    all[marketId] = pos;
    localStorage.setItem(this.KEYS.positions, JSON.stringify(all));
  },

  // ── TRADE ──────────────────────────────────────────────────

  trade(marketId, side, credits) {
    credits = parseFloat(credits);
    if (isNaN(credits) || credits <= 0) return { ok: false, error: 'Invalid amount' };

    const wallet = this.getWallet();
    if (credits > wallet) return { ok: false, error: 'Insufficient credits' };

    const { qYes, qNo } = this.getMarketShares(marketId);
    const shares = this.sharesForCredits(qYes, qNo, credits, side);
    const actualCost = this.costToBuy(qYes, qNo, shares, side);

    // Update market shares
    if (side === 'yes') {
      this.setMarketShares(marketId, qYes + shares, qNo);
    } else {
      this.setMarketShares(marketId, qYes, qNo + shares);
    }

    // Deduct from wallet
    this.adjustWallet(-actualCost);

    // Update position
    const pos = this.getPosition(marketId);
    if (side === 'yes') pos.yesShares += shares;
    else pos.noShares += shares;
    pos.spent = (pos.spent || 0) + actualCost;
    this.setPosition(marketId, pos);

    // Log trade
    const cfg = LV_CONFIG.getMarket(marketId);
    this.addToHistory({
      type: 'TRADE',
      marketId,
      question: cfg.question,
      side: side.toUpperCase(),
      shares: shares.toFixed(2),
      cost: actualCost.toFixed(2),
      newProb: this.getImpliedProb(marketId),
      date: new Date().toISOString()
    });

    // Update stats
    this.updateStats('trade');

    return {
      ok: true,
      shares: shares.toFixed(2),
      cost: actualCost.toFixed(2),
      newProb: this.getImpliedProb(marketId),
      newBalance: this.getWallet()
    };
  },

  // ── RESOLVE MARKET ─────────────────────────────────────────
  // Call this when a market settles (YES or NO wins)

  resolveMarket(marketId, outcome) {
    const pos = this.getPosition(marketId);
    const winShares = outcome === 'yes' ? pos.yesShares : pos.noShares;
    const payout = this.payout(winShares);

    if (payout > 0) {
      this.adjustWallet(payout);
      this.addToHistory({
        type: 'RESOLVE',
        marketId,
        outcome: outcome.toUpperCase(),
        payout: payout.toFixed(2),
        date: new Date().toISOString()
      });
      this.updateStats('win');
    } else {
      this.updateStats('loss');
    }

    // Clear position
    this.setPosition(marketId, { yesShares: 0, noShares: 0, spent: 0 });
    return payout;
  },

  // ── HISTORY ────────────────────────────────────────────────

  addToHistory(entry) {
    const raw = localStorage.getItem(this.KEYS.history);
    const hist = raw ? JSON.parse(raw) : [];
    hist.unshift(entry);
    if (hist.length > 100) hist.pop();
    localStorage.setItem(this.KEYS.history, JSON.stringify(hist));
  },

  getHistory() {
    const raw = localStorage.getItem(this.KEYS.history);
    return raw ? JSON.parse(raw) : [];
  },

  // ── STATS ──────────────────────────────────────────────────

  getStats() {
    const raw = localStorage.getItem(this.KEYS.stats);
    return raw ? JSON.parse(raw) : { trades: 0, wins: 0, losses: 0 };
  },

  updateStats(event) {
    const s = this.getStats();
    if (event === 'trade')  s.trades++;
    if (event === 'win')    s.wins++;
    if (event === 'loss')   s.losses++;
    localStorage.setItem(this.KEYS.stats, JSON.stringify(s));
  },

  winRate() {
    const s = this.getStats();
    const resolved = s.wins + s.losses;
    return resolved === 0 ? 0 : Math.round(s.wins / resolved * 100);
  },

  // ── USERNAME ───────────────────────────────────────────────

  getUsername() {
    let name = localStorage.getItem(this.KEYS.username);
    if (!name) {
      const adjectives = ['Vice','Leonida','Madrazzo','Bawsaq','Grassriver','Ambrosia','Gellhorn','Pisswasser'];
      const nouns      = ['Wolf','Shark','Ghost','King','Viper','Dealer','Hustler','Kingpin'];
      name = adjectives[Math.floor(Math.random()*adjectives.length)] +
             nouns[Math.floor(Math.random()*nouns.length)] +
             Math.floor(Math.random()*9000+1000);
      localStorage.setItem(this.KEYS.username, name);
    }
    return name;
  },

  // ── RENDER WALLET IN NAV ───────────────────────────────────

  renderWallet() {
    const bal = this.getWallet();
    document.querySelectorAll('.wallet-balance').forEach(el => {
      el.textContent = this.SYMBOL + bal.toLocaleString('en-US', { maximumFractionDigits: 0 });
    });
  },

  // ── INIT ───────────────────────────────────────────────────

  init() {
    // Ensure wallet exists
    this.getWallet();

    // Check daily reward
    const claimed = this.claimDailyReward();

    // Render wallet
    this.renderWallet();

    // Show daily reward toast if claimed
    if (claimed) {
      setTimeout(() => showToast('Daily reward claimed!', '+' + this.SYMBOL + this.DAILY_REWARD, 'teal'), 1200);
    }

    // Sync all market card probabilities from LMSR state
    LV_CONFIG.MARKETS.forEach(m => {
      const prob = this.getImpliedProb(m.id);
      syncMarketCardProb(m.id, prob);
    });
  }
};

// ── TOAST NOTIFICATION ───────────────────────────────────────

function showToast(title, subtitle, color) {
  const colors = { teal:'var(--teal)', pink:'var(--pink)', red:'var(--red)', gold:'var(--gold)' };
  const toast = document.createElement('div');
  toast.className = 'lv-toast';
  toast.innerHTML = '<div class="lv-toast-title">' + title + '</div>' +
                    '<div class="lv-toast-sub" style="color:' + (colors[color]||colors.teal) + '">' + subtitle + '</div>';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('lv-toast-show'));
  setTimeout(() => {
    toast.classList.remove('lv-toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ── SYNC MARKET CARD PROBABILITY ─────────────────────────────

function syncMarketCardProb(marketId, prob) {
  const yes = Math.round(prob * 100);
  const no  = 100 - yes;
  const card = document.querySelector('[data-market-id="' + marketId + '"]');
  if (!card) return;

  card.querySelectorAll('.outcome-btn.yes .outcome-pct').forEach(el => el.textContent = yes + '%');
  card.querySelectorAll('.outcome-btn.no  .outcome-pct').forEach(el => el.textContent = no  + '%');
  card.querySelectorAll('.card-prob-pct').forEach((el, i) => {
    el.textContent = (i === 0 ? yes : no) + '%';
  });
  const fill = card.querySelector('.card-prob-fill');
  if (fill) fill.style.width = yes + '%';
  const bar = card.querySelector('.bar-fill');
  if (bar) bar.style.width = yes + '%';
}

// ── BUY MODAL ────────────────────────────────────────────────

function openBuyModal(marketId, side) {
  // Remove existing modal
  document.getElementById('lv-modal')?.remove();

  const cfg  = LV_CONFIG.getMarket(marketId);
  const ms   = LV_LMSR.getMarketShares(marketId);
  const prob = LV_LMSR.priceYes(ms.qYes, ms.qNo);
  const yes  = Math.round(prob * 100);
  const no   = 100 - yes;
  const bal  = LV_LMSR.getWallet();
  const pos  = LV_LMSR.getPosition(marketId);

  const sideColor = side === 'yes' ? 'var(--teal)' : 'var(--red)';
  const sideLabel = side === 'yes' ? 'YES' : 'NO';
  const sidePct   = side === 'yes' ? yes : no;

  const modal = document.createElement('div');
  modal.id = 'lv-modal';
  modal.innerHTML = `
    <div class="lv-modal-backdrop" onclick="document.getElementById('lv-modal').remove()"></div>
    <div class="lv-modal-box">
      <div class="lv-modal-header">
        <div>
          <div class="lv-modal-title">Predict <span style="color:${sideColor}">${sideLabel}</span></div>
          <div class="lv-modal-subtitle">${cfg.question}</div>
        </div>
        <button class="lv-modal-close" onclick="document.getElementById('lv-modal').remove()">✕</button>
      </div>

      <div class="lv-modal-prob-row">
        <div class="lv-modal-prob-item" style="color:var(--teal)">
          <div class="lv-modal-prob-label">YES</div>
          <div class="lv-modal-prob-val">${yes}%</div>
        </div>
        <div class="lv-modal-prob-bar">
          <div class="lv-modal-prob-fill" style="width:${yes}%"></div>
        </div>
        <div class="lv-modal-prob-item" style="color:var(--red)">
          <div class="lv-modal-prob-label">NO</div>
          <div class="lv-modal-prob-val">${no}%</div>
        </div>
      </div>

      <div class="lv-modal-body">
        <div class="lv-modal-field">
          <label class="lv-modal-label">Amount (Leonida Credits)</label>
          <div class="lv-modal-input-wrap">
            <span class="lv-modal-currency">Ṁ</span>
            <input type="number" id="lv-trade-amount" class="lv-modal-input"
              value="50" min="1" max="${Math.floor(bal)}" step="1"
              oninput="updateTradePreview('${marketId}','${side}')"/>
          </div>
          <div class="lv-modal-quick-btns">
            <button onclick="setTradeAmount(25)">Ṁ25</button>
            <button onclick="setTradeAmount(50)">Ṁ50</button>
            <button onclick="setTradeAmount(100)">Ṁ100</button>
            <button onclick="setTradeAmount(${Math.floor(bal)})">Max</button>
          </div>
        </div>

        <div class="lv-modal-preview" id="lv-trade-preview">
          <div class="lv-modal-preview-row">
            <span>Shares you receive</span>
            <span id="lv-preview-shares" class="lv-modal-preview-val">—</span>
          </div>
          <div class="lv-modal-preview-row">
            <span>Avg price per share</span>
            <span id="lv-preview-price" class="lv-modal-preview-val">—</span>
          </div>
          <div class="lv-modal-preview-row">
            <span>Max payout if correct</span>
            <span id="lv-preview-payout" class="lv-modal-preview-val" style="color:var(--teal)">—</span>
          </div>
          <div class="lv-modal-preview-row">
            <span>New probability</span>
            <span id="lv-preview-newprob" class="lv-modal-preview-val">—</span>
          </div>
        </div>

        ${pos.yesShares > 0 || pos.noShares > 0 ? `
        <div class="lv-modal-existing">
          <span class="lv-modal-existing-label">Your position:</span>
          ${pos.yesShares > 0 ? '<span style="color:var(--teal)">YES ' + pos.yesShares.toFixed(1) + ' shares</span>' : ''}
          ${pos.noShares  > 0 ? '<span style="color:var(--red)">NO '  + pos.noShares.toFixed(1)  + ' shares</span>' : ''}
        </div>` : ''}

        <div class="lv-modal-balance">
          Balance: <span class="wallet-balance-modal">${LV_LMSR.SYMBOL}${Math.floor(bal).toLocaleString()}</span>
        </div>
      </div>

      <div class="lv-modal-footer">
        <button class="lv-modal-cancel" onclick="document.getElementById('lv-modal').remove()">Cancel</button>
        <button class="lv-modal-confirm" style="background:${sideColor === 'var(--teal)' ? 'linear-gradient(135deg,var(--teal),var(--cyan))' : 'linear-gradient(135deg,var(--red),#c0186a)'};color:${sideColor === 'var(--teal)' ? '#080810' : '#fff'}"
          onclick="confirmTrade('${marketId}','${side}')">
          Predict ${sideLabel} →
        </button>
      </div>

      <div class="lv-modal-legal">
        ⚠ Leonida Credits have no real-world monetary value and cannot be exchanged for cash.
        This is a non-commercial fan simulation. <a href="about.html#disclaimer">Disclaimer</a>
      </div>
    </div>`;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.querySelector('.lv-modal-box').classList.add('lv-modal-open'));
  updateTradePreview(marketId, side);
}

function setTradeAmount(amount) {
  const input = document.getElementById('lv-trade-amount');
  if (input) {
    input.value = amount;
    const marketId = document.querySelector('[data-market-id]')?.dataset.marketId ||
                     new URLSearchParams(window.location.search).get('id') || 'pswsr-6';
    // Find which side modal is open for
    const title = document.querySelector('.lv-modal-title');
    const side = title?.textContent.includes('YES') ? 'yes' : 'no';
    updateTradePreview(marketId, side);
  }
}

function updateTradePreview(marketId, side) {
  const input = document.getElementById('lv-trade-amount');
  if (!input) return;
  const credits = parseFloat(input.value) || 0;
  const { qYes, qNo } = LV_LMSR.getMarketShares(marketId);
  const shares = LV_LMSR.sharesForCredits(qYes, qNo, credits, side);
  const avgPrice = credits > 0 ? (credits / shares) : 0;

  // New prob after trade
  const newQYes = side === 'yes' ? qYes + shares : qYes;
  const newQNo  = side === 'no'  ? qNo  + shares : qNo;
  const newProb = LV_LMSR.priceYes(newQYes, newQNo);
  const newYes  = Math.round(newProb * 100);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('lv-preview-shares',  shares.toFixed(2) + ' shares');
  set('lv-preview-price',   LV_LMSR.SYMBOL + avgPrice.toFixed(3));
  set('lv-preview-payout',  LV_LMSR.SYMBOL + shares.toFixed(2));
  set('lv-preview-newprob', (side === 'yes' ? newYes : 100 - newYes) + '%');
}

function confirmTrade(marketId, side) {
  const credits = parseFloat(document.getElementById('lv-trade-amount')?.value) || 0;
  const result  = LV_LMSR.trade(marketId, side, credits);

  if (!result.ok) {
    showToast('Trade failed', result.error, 'red');
    return;
  }

  // Close modal
  document.getElementById('lv-modal')?.remove();

  // Update card probability
  syncMarketCardProb(marketId, result.newProb);

  // Show success toast
  const sideLabel = side === 'yes' ? 'YES' : 'NO';
  showToast(
    'Position opened!',
    sideLabel + ' ' + result.shares + ' shares · Ṁ' + result.cost + ' spent',
    side === 'yes' ? 'teal' : 'pink'
  );

  // Update wallet display
  LV_LMSR.renderWallet();
}

// ── WIRE UP OUTCOME BUTTONS ───────────────────────────────────
// Called after DOM is ready — intercepts all Buy Yes/No clicks

function wirePredictButtons() {
  document.querySelectorAll('.outcome-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const card = this.closest('[data-market-id]');
      if (!card) return;
      const marketId = card.dataset.marketId;
      const side = this.classList.contains('yes') ? 'yes' : 'no';
      openBuyModal(marketId, side);
    });
  });
}

// ── BOOT ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  LV_LMSR.init();
  wirePredictButtons();
});
