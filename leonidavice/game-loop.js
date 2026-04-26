/* ═══════════════════════════════════════════════════════════════
   LeonidaVice — game-loop.js
   THE ADDICTION ENGINE
   ─────────────────────────────────────────────────────────────
   Layers on top of lmsr.js. Requires: data-config.js, lmsr.js

   Systems:
   1. Market resolution + auto-close timers
   2. Streak tracker + multiplier bonuses
   3. Badge progression (5 tiers)
   4. Early mover bonus
   5. Market rotation (new markets on schedule)
   6. Countdown clocks on every card
   7. Resolution feed + animated payout
   8. Browser notification opt-in
   9. Urgency mechanics (closing soon alerts)
  10. Near-miss feedback
═══════════════════════════════════════════════════════════════ */

// ── GAME CONFIG ──────────────────────────────────────────────
const LV_GAME = {

  KEYS: {
    streak:        'lv_streak',
    lastResolve:   'lv_last_resolve',
    badges:        'lv_badges',
    earlyMover:    'lv_early_mover',
    resolvedMkts:  'lv_resolved_markets',
    notifAsked:    'lv_notif_asked',
    marketTimers:  'lv_market_timers',
    pendingResolve:'lv_pending_resolve',
  },

  // Badge tiers — unlocked by (wins, accuracy%, credits)
  BADGES: [
    { id:'newcomer',  label:'Newcomer',  icon:'🆕', color:'#44445a', minWins:0,  minAcc:0,   minBal:0     },
    { id:'hustler',   label:'Hustler',   icon:'💰', color:'#a78bfa', minWins:1,  minAcc:0,   minBal:0     },
    { id:'dealer',    label:'Dealer',    icon:'🃏', color:'#00d4aa', minWins:5,  minAcc:50,  minBal:600   },
    { id:'cartel',    label:'Cartel',    icon:'💎', color:'#00e5ff', minWins:15, minAcc:60,  minBal:1000  },
    { id:'kingpin',   label:'Kingpin',   icon:'👑', color:'#ffd166', minWins:30, minAcc:70,  minBal:2000  },
  ],

  // Streak multipliers — correct predictions in a row
  STREAK_MULTIPLIERS: [1, 1, 1.1, 1.2, 1.35, 1.5, 1.75, 2.0],

  // Market resolution schedule — seconds from page load
  // In production these would be real timestamps from Supabase
  // Here we use relative timers so markets resolve during a session
  RESOLUTION_SCHEDULE: {
    'snfb-heist':       { resolveAfterMs: 90000,  outcome: 'no',  reason: 'Security upgrade blocked the heist' },
    'pswsr-6':          { resolveAfterMs: 180000, outcome: 'yes', reason: 'PSWSR hit $6.02 — assassination window confirmed' },
    'mgnot-leonidaman': { resolveAfterMs: 300000, outcome: 'yes', reason: 'Leonida Man segment aired — 4.2M viewers' },
    'agtr-dip':         { resolveAfterMs: 420000, outcome: 'yes', reason: 'AGTR fell to $4.88 after Grassrivers ruling' },
    'alcrys-accident':  { resolveAfterMs: 600000, outcome: 'no',  reason: 'No industrial incident reported this patch' },
    'logos-week':       { resolveAfterMs: 720000, outcome: 'no',  reason: 'LOGOS closed at $11.40 — below $13 target' },
    'lure-roi':         { resolveAfterMs: 900000, outcome: 'yes', reason: 'Lure & Reel confirmed top ROI in Mariana County' },
    'vcprop-150':       { resolveAfterMs: 1080000,outcome: 'no',  reason: 'Vice Beach penthouse held at $148K this week' },
    'duke-kelly':       { resolveAfterMs: 1200000,outcome: 'yes', reason: 'Duke Arms reported highest Kelly County revenue' },
    'dkarm-contract':   { resolveAfterMs: 1440000,outcome: 'yes', reason: 'Duke Arms wins second LSP contract — $280M deal' },
    'pswsr-brewery':    { resolveAfterMs: 1800000,outcome: 'yes', reason: 'Pisswasser groundbreaking ceremony confirmed' },
    'snfb-rate':        { resolveAfterMs: 2100000,outcome: 'no',  reason: 'Sinfrontera holds rates steady in Q3' },
  },

  // ── STREAK ─────────────────────────────────────────────────

  getStreak() {
    const raw = localStorage.getItem(this.KEYS.streak);
    return raw ? JSON.parse(raw) : { current: 0, best: 0 };
  },

  updateStreak(won) {
    const s = this.getStreak();
    if (won) {
      s.current++;
      if (s.current > s.best) s.best = s.current;
    } else {
      s.current = 0;
    }
    localStorage.setItem(this.KEYS.streak, JSON.stringify(s));
    return s;
  },

  getStreakMultiplier() {
    const { current } = this.getStreak();
    const idx = Math.min(current, this.STREAK_MULTIPLIERS.length - 1);
    return this.STREAK_MULTIPLIERS[idx];
  },

  // ── BADGE ──────────────────────────────────────────────────

  getCurrentBadge() {
    const stats   = LV_LMSR.getStats();
    const bal     = LV_LMSR.getWallet();
    const winRate = LV_LMSR.winRate();
    let badge = this.BADGES[0];
    for (const b of this.BADGES) {
      if (stats.wins >= b.minWins && winRate >= b.minAcc && bal >= b.minBal) {
        badge = b;
      }
    }
    return badge;
  },

  checkBadgeUp(prevBadge) {
    const newBadge = this.getCurrentBadge();
    if (newBadge.id !== prevBadge.id) {
      // Badge upgrade!
      setTimeout(() => {
        showBigToast(
          newBadge.icon + ' Badge Unlocked!',
          'You are now a ' + newBadge.label,
          'You\'ve earned the ' + newBadge.label + ' badge. Keep predicting to climb higher.',
          'gold'
        );
      }, 1500);
      return true;
    }
    return false;
  },

  // ── EARLY MOVER BONUS ──────────────────────────────────────
  // If you buy when prob is within 5% of starting prob → bonus shares

  checkEarlyMover(marketId, side, shares) {
    const cfg     = LV_CONFIG.getMarket(marketId);
    const current = LV_LMSR.getImpliedProb(marketId);
    const start   = cfg.yesProb;
    const diff    = Math.abs(current - start);

    if (diff < 0.05) {
      // Early mover — 10% bonus shares
      const bonus = shares * 0.10;
      const pos   = LV_LMSR.getPosition(marketId);
      if (side === 'yes') pos.yesShares += bonus;
      else pos.noShares += bonus;
      LV_LMSR.setPosition(marketId, pos);
      LV_LMSR.adjustWallet(0); // trigger render
      return bonus;
    }
    return 0;
  },

  // ── MARKET RESOLUTION ──────────────────────────────────────

  getResolvedMarkets() {
    const raw = localStorage.getItem(this.KEYS.resolvedMkts);
    return raw ? JSON.parse(raw) : {};
  },

  markResolved(marketId, outcome, reason) {
    const all = this.getResolvedMarkets();
    all[marketId] = { outcome, reason, resolvedAt: Date.now() };
    localStorage.setItem(this.KEYS.resolvedMkts, JSON.stringify(all));
  },

  isResolved(marketId) {
    return !!this.getResolvedMarkets()[marketId];
  },

  resolveMarket(marketId, outcome, reason) {
    if (this.isResolved(marketId)) return; // already resolved

    const prevBadge = this.getCurrentBadge();
    const pos       = LV_LMSR.getPosition(marketId);
    const winShares = outcome === 'yes' ? pos.yesShares : pos.noShares;
    const loseShares= outcome === 'yes' ? pos.noShares  : pos.yesShares;
    const hadPosition = winShares > 0.01 || loseShares > 0.01;

    // Mark resolved
    this.markResolved(marketId, outcome, reason);

    // Update card UI
    this.renderResolvedCard(marketId, outcome, reason);

    if (!hadPosition) return; // user had no position — no payout/loss

    const multiplier = this.getStreakMultiplier();
    const won        = winShares > 0.01;

    if (won) {
      const rawPayout  = winShares;
      const bonusPay   = rawPayout * (multiplier - 1);
      const totalPayout= rawPayout + bonusPay;

      LV_LMSR.adjustWallet(totalPayout);
      LV_LMSR.addToHistory({
        type: 'RESOLVE', marketId,
        outcome: outcome.toUpperCase(),
        payout: totalPayout.toFixed(2),
        bonus: bonusPay.toFixed(2),
        multiplier: multiplier.toFixed(2),
        reason,
        date: new Date().toISOString()
      });
      LV_LMSR.updateStats('win');
      const streak = this.updateStreak(true);

      // Animated payout
      setTimeout(() => {
        showPayoutAnimation(totalPayout, marketId);
        const streakMsg = streak.current >= 3
          ? ' 🔥 ' + streak.current + '-streak! ' + multiplier.toFixed(1) + 'x multiplier'
          : '';
        showBigToast(
          '✅ Correct Prediction!',
          '+Ṁ' + totalPayout.toFixed(0) + streakMsg,
          reason,
          'teal'
        );
        if (streak.current === 3) showToast('🔥 3-Streak!', 'Multiplier active: 1.2x', 'gold');
        if (streak.current === 5) showToast('🔥 5-Streak!', 'Multiplier active: 1.5x', 'gold');
        if (streak.current === 7) showToast('🔥 7-Streak!', 'MAX MULTIPLIER: 2.0x', 'gold');
      }, 800);

    } else {
      // Lost — near-miss feedback
      const lostAmount = pos.spent || loseShares;
      LV_LMSR.addToHistory({
        type: 'RESOLVE', marketId,
        outcome: outcome.toUpperCase(),
        payout: '0',
        lost: lostAmount.toFixed(2),
        reason,
        date: new Date().toISOString()
      });
      LV_LMSR.updateStats('loss');
      this.updateStreak(false);

      const nearMiss = (outcome === 'yes' && pos.noShares > 0)
        ? LV_LMSR.getImpliedProb(marketId) > 0.45
        : LV_LMSR.getImpliedProb(marketId) < 0.55;

      setTimeout(() => {
        if (nearMiss) {
          showBigToast(
            '😬 So Close!',
            'Market resolved ' + outcome.toUpperCase() + ' — you were at ' +
            Math.round(LV_LMSR.getImpliedProb(marketId) * 100) + '%',
            reason + '. Your streak resets. Try again on the next market.',
            'pink'
          );
        } else {
          showBigToast(
            '❌ Incorrect Prediction',
            'Market resolved ' + outcome.toUpperCase(),
            reason + '. Streak reset. Ṁ' + lostAmount.toFixed(0) + ' lost.',
            'red'
          );
        }
      }, 800);
    }

    // Check badge upgrade
    setTimeout(() => this.checkBadgeUp(prevBadge), 2000);

    // Clear position
    LV_LMSR.setPosition(marketId, { yesShares: 0, noShares: 0, spent: 0 });
    LV_LMSR.renderWallet();
  },

  // ── RENDER RESOLVED CARD ───────────────────────────────────

  renderResolvedCard(marketId, outcome, reason) {
    const card = document.querySelector('[data-market-id="' + marketId + '"]');
    if (!card) return;
    card.classList.add('market-card-resolved');
    const outcomeBadge = outcome === 'yes'
      ? '<span class="resolve-badge resolve-yes">✓ YES</span>'
      : '<span class="resolve-badge resolve-no">✕ NO</span>';
    // Add resolved overlay
    const overlay = document.createElement('div');
    overlay.className = 'resolve-overlay';
    overlay.innerHTML = outcomeBadge + '<span class="resolve-reason">' + reason + '</span>';
    card.appendChild(overlay);
    // Disable buttons
    card.querySelectorAll('.outcome-btn').forEach(btn => {
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.4';
    });
  },

  // ── COUNTDOWN TIMERS ───────────────────────────────────────

  startCountdowns() {
    // Assign real expiry timestamps to markets (session-relative)
    const stored = localStorage.getItem(this.KEYS.marketTimers);
    let timers = stored ? JSON.parse(stored) : {};

    LV_CONFIG.MARKETS.forEach(m => {
      if (!timers[m.id]) {
        // Parse endsIn string to ms
        timers[m.id] = Date.now() + this.parseEndsIn(m.endsIn);
      }
    });
    localStorage.setItem(this.KEYS.marketTimers, JSON.stringify(timers));

    // Tick every second
    setInterval(() => this.tickCountdowns(timers), 1000);
  },

  parseEndsIn(str) {
    // "46h" → ms, "3d 12h" → ms, "2h" → ms
    let ms = 0;
    const days  = str.match(/(\d+)d/);
    const hours = str.match(/(\d+)h/);
    const mins  = str.match(/(\d+)m/);
    if (days)  ms += parseInt(days[1])  * 86400000;
    if (hours) ms += parseInt(hours[1]) * 3600000;
    if (mins)  ms += parseInt(mins[1])  * 60000;
    return ms || 3600000; // default 1h
  },

  tickCountdowns(timers) {
    const now = Date.now();
    LV_CONFIG.MARKETS.forEach(m => {
      const expiry = timers[m.id];
      if (!expiry) return;
      const remaining = expiry - now;
      const card = document.querySelector('[data-market-id="' + m.id + '"]');
      if (!card) return;

      const countdownEl = card.querySelector('.card-countdown');
      if (!countdownEl) return;

      if (remaining <= 0) {
        countdownEl.textContent = 'Resolving…';
        countdownEl.style.color = 'var(--pink)';
        return;
      }

      const h = Math.floor(remaining / 3600000);
      const min = Math.floor((remaining % 3600000) / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);

      let display;
      if (h > 24) {
        display = '⏱ ' + Math.floor(h/24) + 'd ' + (h%24) + 'h';
      } else if (h > 0) {
        display = '⏱ ' + h + 'h ' + min + 'm';
      } else if (min > 0) {
        display = '⏱ ' + min + 'm ' + sec + 's';
        if (min < 10) countdownEl.style.color = 'var(--gold)';
      } else {
        display = '⏱ ' + sec + 's';
        countdownEl.style.color = 'var(--pink)';
        countdownEl.style.animation = 'pulse-text 0.5s ease-in-out infinite';
      }
      countdownEl.textContent = display;

      // Urgency: closing in < 5 min → add urgency class
      if (remaining < 300000 && !card.classList.contains('market-card-urgent')) {
        card.classList.add('market-card-urgent');
        // Show urgency toast once
        if (!card.dataset.urgencyShown) {
          card.dataset.urgencyShown = '1';
          const cfg = LV_CONFIG.getMarket(m.id);
          const pos = LV_LMSR.getPosition(m.id);
          if (pos.yesShares > 0.01 || pos.noShares > 0.01) {
            showToast('⚡ Closing Soon!', cfg.question.substring(0,40) + '…', 'gold');
          }
        }
      }
    });
  },

  // ── RESOLUTION SCHEDULER ───────────────────────────────────

  scheduleResolutions() {
    Object.entries(this.RESOLUTION_SCHEDULE).forEach(([marketId, cfg]) => {
      if (this.isResolved(marketId)) return;
      setTimeout(() => {
        this.resolveMarket(marketId, cfg.outcome, cfg.reason);
      }, cfg.resolveAfterMs);
    });
  },

  // ── MARKET ROTATION ────────────────────────────────────────
  // After a market resolves, queue a replacement

  REPLACEMENT_MARKETS: [
    { id:'pswsr-patch',    question:'Will Pisswasser stock rise 10%+ after the next Rockstar patch?',    yesProb:0.58, vol:0.007, category:'Stocks',     tag:'Patch Play',         relatedSym:'PSWSR', volume:620000,  traders:290,  endsIn:'48h' },
    { id:'snfb-q4',        question:'Sinfrontera Bank reports positive Q4 earnings?',                    yesProb:0.74, vol:0.005, category:'Events',     tag:'Earnings',           relatedSym:'SNFB',  volume:980000,  traders:440,  endsIn:'72h' },
    { id:'dkarm-war',      question:'Duke Arms stock above $40 if Leonida crime wave event triggers?',   yesProb:0.62, vol:0.009, category:'Stocks',     tag:'Event Play',         relatedSym:'DKARM', volume:1100000, traders:520,  endsIn:'36h' },
    { id:'alcrys-recovery',question:'Allied Crystal recovers above $25 within 7 days of accident?',     yesProb:0.41, vol:0.008, category:'Stocks',     tag:'Recovery Play',      relatedSym:'ALCRYS',volume:740000,  traders:360,  endsIn:'7d'  },
    { id:'vcprop-q3',      question:'Vice City Properties announces new development in Q3?',             yesProb:0.55, vol:0.006, category:'Properties', tag:'Corporate',          relatedSym:'VCPROP',volume:830000,  traders:390,  endsIn:'5d'  },
    { id:'agtr-rebound',   question:'Airgator stock rebounds above $7 after environmental ruling?',      yesProb:0.38, vol:0.010, category:'Stocks',     tag:'Recovery Play',      relatedSym:'AGTR',  volume:490000,  traders:220,  endsIn:'4d'  },
    { id:'lnlot-jackpot',  question:'Leonida Lottery jackpot exceeds Ṁ100M this month?',                yesProb:0.67, vol:0.004, category:'Events',     tag:'Lottery',            relatedSym:'LNLOT', volume:310000,  traders:180,  endsIn:'30d' },
    { id:'mgnot-viral',    question:'Mega Noticias "Leonida Man" clip goes viral (10M+ views)?',         yesProb:0.44, vol:0.008, category:'Media',      tag:'Viral Event',        relatedSym:'MGNOT', volume:560000,  traders:260,  endsIn:'14d' },
  ],

  queueReplacement(resolvedId) {
    // Find a replacement not already in config or resolved
    const resolved = this.getResolvedMarkets();
    const existing = LV_CONFIG.MARKETS.map(m => m.id);
    const candidate = this.REPLACEMENT_MARKETS.find(m =>
      !existing.includes(m.id) && !resolved[m.id]
    );
    if (!candidate) return;

    // Add to config
    LV_CONFIG.MARKETS.push(candidate);

    // Inject card into feed after 3s
    setTimeout(() => this.injectMarketCard(candidate), 3000);
  },

  injectMarketCard(market) {
    const grid = document.querySelector('.market-grid');
    if (!grid) return;

    const yes = Math.round(market.yesProb * 100);
    const no  = 100 - yes;

    const card = document.createElement('div');
    card.className = 'market-card market-card-new';
    card.dataset.marketId = market.id;
    card.innerHTML = `
      <div class="card-badge" style="background:rgba(0,212,170,0.12);color:var(--teal);border-color:rgba(0,212,170,0.2)">🆕 NEW</div>
      <div class="card-header">
        <div class="card-icon-wrap" style="background:rgba(0,229,255,0.08)">📊</div>
        <div class="card-title-block">
          <h3 class="card-title">${market.question}</h3>
          <div class="card-meta">
            <span class="card-tag">${market.category}</span>
            <span class="card-tag">${market.tag}</span>
          </div>
        </div>
      </div>
      <div class="card-prob-row">
        <div class="card-prob-yes"><span class="card-prob-label">Yes</span><span class="card-prob-pct" style="color:var(--teal)">${yes}%</span></div>
        <div class="card-prob-bar-wrap"><div class="card-prob-bar"><div class="card-prob-fill" style="width:${yes}%"></div></div></div>
        <div class="card-prob-no"><span class="card-prob-pct" style="color:var(--red)">${no}%</span><span class="card-prob-label">No</span></div>
      </div>
      <div class="card-outcomes">
        <a href="market.html?id=${market.id}" class="outcome-btn yes"><span class="outcome-label">Buy Yes</span><span class="outcome-pct">${yes}%</span></a>
        <a href="market.html?id=${market.id}" class="outcome-btn no"><span class="outcome-label">Buy No</span><span class="outcome-pct">${no}%</span></a>
      </div>
      <div class="card-footer-stats">
        <span class="card-vol">$${(market.volume/1e6).toFixed(1)}M Vol.</span>
        <span class="card-traders">${market.traders} traders</span>
        <span class="card-countdown card-ends">⏱ ${market.endsIn}</span>
      </div>`;

    grid.prepend(card);
    // Wire up buttons
    card.querySelectorAll('.outcome-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const side = this.classList.contains('yes') ? 'yes' : 'no';
        openBuyModal(market.id, side);
      });
    });

    // Animate in
    requestAnimationFrame(() => card.classList.add('market-card-new-visible'));
    showToast('🆕 New Market', market.question.substring(0,50) + '…', 'cyan');
  },

  // ── BROWSER NOTIFICATIONS ──────────────────────────────────

  async requestNotifications() {
    if (!('Notification' in window)) return;
    if (localStorage.getItem(this.KEYS.notifAsked)) return;
    localStorage.setItem(this.KEYS.notifAsked, '1');

    // Show prompt after 30s
    setTimeout(async () => {
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          showToast('🔔 Notifications on', 'We\'ll alert you when assassination windows open', 'teal');
        }
      }
    }, 30000);
  },

  sendNotification(title, body) {
    if (Notification.permission !== 'granted') return;
    new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28">◈</text></svg>'
    });
  },

  // ── RENDER BADGE IN NAV ────────────────────────────────────

  renderBadge() {
    const badge = this.getCurrentBadge();
    document.querySelectorAll('.user-badge-nav').forEach(el => {
      el.textContent = badge.icon + ' ' + badge.label;
      el.style.color = badge.color;
    });
    document.querySelectorAll('.user-badge-display').forEach(el => {
      el.innerHTML = '<span style="color:' + badge.color + '">' + badge.icon + ' ' + badge.label + '</span>';
    });
  },

  // ── RENDER STREAK IN NAV ───────────────────────────────────

  renderStreak() {
    const { current } = this.getStreak();
    const mult = this.getStreakMultiplier();
    document.querySelectorAll('.streak-display').forEach(el => {
      if (current >= 2) {
        el.textContent = '🔥 ' + current + (mult > 1 ? ' (' + mult.toFixed(1) + 'x)' : '');
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  },

  // ── INIT ───────────────────────────────────────────────────

  init() {
    this.renderBadge();
    this.renderStreak();
    this.startCountdowns();
    this.scheduleResolutions();
    this.requestNotifications();

    // Render resolved state on any already-resolved markets
    const resolved = this.getResolvedMarkets();
    Object.entries(resolved).forEach(([id, data]) => {
      this.renderResolvedCard(id, data.outcome, data.reason);
    });

    // Upgrade confirmTrade to include early mover check
    const origConfirm = window.confirmTrade;
    window.confirmTrade = function(marketId, side) {
      const credits = parseFloat(document.getElementById('lv-trade-amount')?.value) || 0;
      const { qYes, qNo } = LV_LMSR.getMarketShares(marketId);
      const shares = LV_LMSR.sharesForCredits(qYes, qNo, credits, side);
      origConfirm(marketId, side);
      // Check early mover after trade
      setTimeout(() => {
        const bonus = LV_GAME.checkEarlyMover(marketId, side, shares);
        if (bonus > 0.01) {
          showToast('⚡ Early Mover Bonus!', '+' + bonus.toFixed(1) + ' bonus shares', 'cyan');
        }
        LV_GAME.renderBadge();
        LV_GAME.renderStreak();
      }, 200);
    };

    // Assassination window notification
    setTimeout(() => {
      this.sendNotification(
        '🎯 LeonidaVice — Assassination Window OPEN',
        'Madrazzo target confirmed. PSWSR position closing in 3h. Buy now.'
      );
    }, 5000);
  }
};

// ── BIG TOAST (resolution events) ────────────────────────────

function showBigToast(title, subtitle, body, color) {
  const colors = { teal:'var(--teal)', pink:'var(--pink)', red:'var(--red)', gold:'var(--gold)', cyan:'var(--cyan)' };
  const c = colors[color] || colors.teal;
  const toast = document.createElement('div');
  toast.className = 'lv-big-toast';
  toast.innerHTML =
    '<div class="lv-big-toast-icon" style="color:' + c + '">' +
      (color === 'teal' ? '✅' : color === 'gold' ? '🔥' : color === 'cyan' ? '⚡' : '❌') +
    '</div>' +
    '<div class="lv-big-toast-content">' +
      '<div class="lv-big-toast-title">' + title + '</div>' +
      '<div class="lv-big-toast-sub" style="color:' + c + '">' + subtitle + '</div>' +
      (body ? '<div class="lv-big-toast-body">' + body + '</div>' : '') +
    '</div>' +
    '<button class="lv-big-toast-close" onclick="this.parentElement.remove()">✕</button>';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('lv-big-toast-show'));
  setTimeout(() => {
    toast.classList.remove('lv-big-toast-show');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

// ── PAYOUT ANIMATION ─────────────────────────────────────────

function showPayoutAnimation(amount, marketId) {
  const card = document.querySelector('[data-market-id="' + marketId + '"]');
  const anchor = card || document.querySelector('.wallet-nav-item') || document.body;
  const rect = anchor.getBoundingClientRect();

  const el = document.createElement('div');
  el.className = 'payout-float';
  el.textContent = '+Ṁ' + Math.round(amount).toLocaleString();
  el.style.left = (rect.left + rect.width / 2) + 'px';
  el.style.top  = (rect.top + window.scrollY) + 'px';
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('payout-float-go'));
  setTimeout(() => el.remove(), 1800);

  // Also flash the wallet
  document.querySelectorAll('.wallet-balance').forEach(el => {
    el.classList.add('wallet-flash');
    setTimeout(() => el.classList.remove('wallet-flash'), 600);
  });
}

// ── BOOT ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Inject countdown spans into card footer stats
  document.querySelectorAll('.market-card[data-market-id]').forEach(card => {
    const marketId = card.dataset.marketId;
    const cfg = LV_CONFIG.getMarket(marketId);
    if (!cfg) return;

    // Replace static ends text with live countdown
    const endsEl = card.querySelector('.card-ends');
    if (endsEl) {
      endsEl.classList.add('card-countdown');
    } else {
      const footer = card.querySelector('.card-footer-stats');
      if (footer) {
        const span = document.createElement('span');
        span.className = 'card-ends card-countdown';
        span.textContent = '⏱ ' + cfg.endsIn;
        footer.appendChild(span);
      }
    }

    // Show position badge if user has a position
    const pos = LV_LMSR.getPosition(marketId);
    if (pos.yesShares > 0.01 || pos.noShares > 0.01) {
      const meta = card.querySelector('.card-meta');
      if (meta && !meta.querySelector('.card-position-badge')) {
        const badge = document.createElement('span');
        badge.className = 'card-position-badge ' + (pos.yesShares > 0.01 ? 'yes-pos' : 'no-pos');
        badge.textContent = pos.yesShares > 0.01
          ? '▲ YES ' + pos.yesShares.toFixed(0) + ' shares'
          : '▼ NO '  + pos.noShares.toFixed(0)  + ' shares';
        meta.appendChild(badge);
      }
    }
  });

  // Init game loop
  LV_GAME.init();
});
